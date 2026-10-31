import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { LimiteTentativas } from '../common/limite';
import { hashSenha } from '../common/senha';
import { UsuarioLogado } from '../common/usuario-logado';
import { Email, EmailService } from '../email/email.module';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { EsqueciSenhaDto, LoginDto, PrimeiroAcessoDto, RedefinirSenhaDto, RegistrarDto } from './auth.dto';

const VALIDADE_LINK_MS = 60 * 60 * 1000; // 1 hora
const limitePorIp = new LimiteTentativas(20, 15 * 60 * 1000);
const limitePorEmail = new LimiteTentativas(3, 15 * 60 * 1000);
// Login: freia força bruta por IP e por conta.
const loginPorIp = new LimiteTentativas(30, 15 * 60 * 1000);
const loginPorEmail = new LimiteTentativas(10, 15 * 60 * 1000);

const escaparHtml = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Endereço público do site, usado nos links dos e-mails. */
const urlDoSite = () => (process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function emailRecuperacao(nome: string, para: string, link: string): Email {
  const primeiroNome = nome.split(' ')[0];
  return {
    para,
    assunto: 'Verissimo ERP - criar uma senha nova',
    texto: `Olá, ${primeiroNome}!\n\nRecebemos um pedido para criar uma senha nova no Verissimo ERP.\nAbra o link abaixo (vale por 1 hora):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0f172a">
  <h2 style="color:#4f46e5">Verissimo ERP</h2>
  <p>Olá, ${escaparHtml(primeiroNome)}!</p>
  <p>Recebemos um pedido para criar uma senha nova. Clique no botão abaixo (o link vale por 1 hora):</p>
  <p style="margin:28px 0"><a href="${link}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Criar senha nova</a></p>
  <p style="font-size:13px;color:#64748b">Se o botão não funcionar, copie este endereço no navegador:<br>${link}</p>
  <p style="font-size:13px;color:#64748b">Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>
</div>`,
  };
}

type UsuarioComEmpresa = {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  perfil: UsuarioLogado['perfil'];
  empresa: { nome: string; plano: string };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  async login({ email, senha }: LoginDto, ip: string) {
    email = email.toLowerCase();
    loginPorIp.registrar(ip);
    loginPorEmail.registrar(email);
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { empresa: true },
    });
    const ok = usuario && usuario.ativo && usuario.empresa.ativa && (await bcrypt.compare(senha, usuario.senhaHash));
    if (!ok) throw new UnauthorizedException('E-mail ou senha incorretos');
    return this.sessao(usuario);
  }

  /** O primeiro acesso só existe enquanto o sistema não tem nenhum usuário. */
  async primeiroAcessoDisponivel() {
    return { disponivel: (await this.prisma.usuario.count()) === 0 };
  }

  /**
   * Cria a empresa Estância Maciel e o primeiro administrador. Funciona uma única vez:
   * depois que existe qualquer usuário, a rota responde 404. O lock garante que dois
   * pedidos simultâneos não criem dois administradores.
   */
  async primeiroAcesso(dto: PrimeiroAcessoDto) {
    const usuario = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estancia:primeiro-acesso'))`;
      if ((await tx.usuario.count()) > 0) throw new NotFoundException('O administrador já foi criado. Entre com seu e-mail e senha.');
      const existente = await tx.empresa.findFirst({ where: { nome: 'Estância Maciel' } });
      const empresa = existente ?? (await tx.empresa.create({ data: { nome: 'Estância Maciel' } }));
      if (!existente) await criarCadastrosIniciais(tx, empresa.id);
      return tx.usuario.create({
        data: { empresaId: empresa.id, nome: dto.nome, email: dto.email.toLowerCase(), senhaHash: await hashSenha(dto.senha), perfil: 'ADMIN' },
        include: { empresa: true },
      });
    });
    return this.sessao(usuario);
  }

  /** Cria uma nova empresa (cliente do SaaS) com o usuário administrador e os cadastros iniciais. */
  async registrar(dto: RegistrarDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }
    const senhaHash = await hashSenha(dto.senha);

    const usuario = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({ data: { nome: dto.empresa, cnpj: dto.cnpj || null, email } });
      await criarCadastrosIniciais(tx, empresa.id);
      return tx.usuario.create({
        data: { empresaId: empresa.id, nome: dto.nome, email, senhaHash, perfil: 'ADMIN' },
        include: { empresa: true },
      });
    });
    return this.sessao(usuario);
  }

  /**
   * Envia o link para criar uma senha nova. A resposta é sempre a mesma, exista o e-mail
   * ou não, para ninguém usar esta tela para descobrir quem tem conta.
   */
  async esqueciSenha({ email }: EsqueciSenhaDto, ip: string) {
    email = email.toLowerCase();
    limitePorIp.registrar(ip);
    limitePorEmail.registrar(email);

    const usuario = await this.prisma.usuario.findUnique({ where: { email }, include: { empresa: true } });
    if (usuario?.ativo && usuario.empresa.ativa) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.$transaction([
        // Pedir de novo invalida os links anteriores.
        this.prisma.recuperacaoSenha.deleteMany({ where: { usuarioId: usuario.id, usadoEm: null } }),
        this.prisma.recuperacaoSenha.create({
          data: { usuarioId: usuario.id, tokenHash: hashToken(token), expiraEm: new Date(Date.now() + VALIDADE_LINK_MS) },
        }),
      ]);
      // Sem esperar o envio: o tempo de resposta não pode denunciar que o e-mail existe.
      void this.email.enviar(emailRecuperacao(usuario.nome, usuario.email, `${urlDoSite()}/redefinir-senha/?token=${token}`)).catch((erro) =>
        this.logger.error(`Falha ao enviar e-mail de recuperação para ${usuario.email}: ${erro}`),
      );
    }
    return { mensagem: 'Se este e-mail estiver cadastrado, você vai receber um link para criar uma senha nova.' };
  }

  /** Troca a senha usando o link recebido por e-mail (vale uma vez, por 1 hora). */
  async redefinirSenha({ token, senha }: RedefinirSenhaDto) {
    const pedido = await this.prisma.recuperacaoSenha.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!pedido || pedido.usadoEm || pedido.expiraEm < new Date()) {
      throw new BadRequestException('Este link é inválido ou expirou. Peça um novo em "Esqueci minha senha".');
    }
    await this.prisma.$transaction([
      this.prisma.usuario.update({ where: { id: pedido.usuarioId }, data: { senhaHash: await hashSenha(senha) } }),
      this.prisma.recuperacaoSenha.update({ where: { id: pedido.id }, data: { usadoEm: new Date() } }),
    ]);
    return { mensagem: 'Senha alterada. Entre com a senha nova.' };
  }

  async eu(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { empresa: true },
    });
    return perfilPublico(usuario);
  }

  private async sessao(usuario: UsuarioComEmpresa) {
    const payload: UsuarioLogado = {
      id: usuario.id,
      empresaId: usuario.empresaId,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    return { token: await this.jwt.signAsync(payload), usuario: perfilPublico(usuario) };
  }
}

function perfilPublico({ id, nome, email, perfil, empresaId, empresa }: UsuarioComEmpresa) {
  return { id, nome, email, perfil, empresa: { id: empresaId, nome: empresa.nome, plano: empresa.plano } };
}

/** Cadastros que toda empresa nova já recebe pronta para uso. */
export async function criarCadastrosIniciais(tx: Tx, empresaId: string) {
  await tx.deposito.create({ data: { empresaId, nome: 'Principal', padrao: true } });
  await tx.contaBancaria.create({ data: { empresaId, nome: 'Caixa' } });
  await tx.categoriaFinanceira.createMany({
    data: [
      { empresaId, nome: 'Vendas', tipo: 'RECEBER' },
      { empresaId, nome: 'Serviços prestados', tipo: 'RECEBER' },
      { empresaId, nome: 'Outras receitas', tipo: 'RECEBER' },
      { empresaId, nome: 'Fornecedores', tipo: 'PAGAR' },
      { empresaId, nome: 'Aluguel', tipo: 'PAGAR' },
      { empresaId, nome: 'Salários', tipo: 'PAGAR' },
      { empresaId, nome: 'Impostos', tipo: 'PAGAR' },
      { empresaId, nome: 'Água, luz e internet', tipo: 'PAGAR' },
      { empresaId, nome: 'Outras despesas', tipo: 'PAGAR' },
    ],
  });
}
