import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Perfil } from '../generated/prisma/enums';
import { PERFIS, PUBLICO } from './decorators';
import { UsuarioLogado } from './usuario-logado';

/** Guard global: exige token válido e confere o perfil quando a rota usa @Perfis. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const alvos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLICO, alvos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Faça login para continuar');

    try {
      req.usuario = await this.jwt.verifyAsync<UsuarioLogado>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada, faça login novamente');
    }

    const perfis = this.reflector.getAllAndOverride<Perfil[] | undefined>(PERFIS, alvos);
    const usuario: UsuarioLogado = req.usuario;
    if (perfis?.length && usuario.perfil !== 'ADMIN' && !perfis.includes(usuario.perfil)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta função');
    }
    return true;
  }
}
