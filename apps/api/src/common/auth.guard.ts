import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Perfil } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PERFIS, PUBLICO } from './decorators';
import { UsuarioLogado } from './usuario-logado';

/** Por quanto tempo a situação do usuário (ativo e perfil) lida do banco vale antes de ser relida. */
const CACHE_MS = 60_000;

type Situacao = { ativo: boolean; perfil: Perfil; lidoEm: number };

/**
 * Guard global: exige token válido e confere o perfil quando a rota usa @Perfis.
 * O perfil e o "ativo" vêm do banco (com cache curto), não do token: desativar ou trocar
 * o perfil de alguém vale em até 1 minuto, sem esperar o token expirar.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cache = new Map<string, Situacao>();

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');

    let usuario: UsuarioLogado;
    try {
      usuario = await this.jwt.verifyAsync<UsuarioLogado>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente');
    }

    const situacao = await this.situacao(usuario.id);
    if (!situacao?.ativo) throw new UnauthorizedException('Usuário desativado. Fale com o administrador');
    req.usuario = { ...usuario, perfil: situacao.perfil };

    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(PERFIS, alvos);
    if (perfis?.length && situacao.perfil !== 'ADMIN' && !perfis.includes(situacao.perfil)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta função');
    }
    return true;
  }

  private async situacao(id: string): Promise<Situacao | null> {
    const agora = Date.now();
    const guardada = this.cache.get(id);
    if (guardada && agora - guardada.lidoEm < CACHE_MS) return guardada;

    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { ativo: true, perfil: true, empresa: { select: { ativa: true } } },
    });
    if (!usuario) {
      this.cache.delete(id);
      return null;
    }
    const nova = { ativo: usuario.ativo && usuario.empresa.ativa, perfil: usuario.perfil, lidoEm: agora };
    this.cache.set(id, nova);
    return nova;
  }
}
