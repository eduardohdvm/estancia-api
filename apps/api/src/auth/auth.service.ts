import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsuarioLogado } from '../common/usuario-logado';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { LoginDto, RegistrarDto } from './auth.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, senha }: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: email.toLowerCase() },
      include: { empresa: true },
    });
    const ok = usuario && usuario.ativo && usuario.empresa.ativa && (await bcrypt.compare(senha, usuario.senhaHash));
    if (!ok) throw new UnauthorizedException('E-mail ou senha incorretos');
    return this.sessao(usuario);
  }

  /** Cria uma nova empresa (cliente do SaaS) com o usuário administrador e os cadastros iniciais. */
  async registrar(dto: RegistrarDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }
    const senhaHash = await bcrypt.hash(dto.senha, 10);

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
