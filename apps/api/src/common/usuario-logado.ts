import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';

/** Dados do usuário que vêm dentro do token JWT. */
export interface UsuarioLogado {
  id: string;
  empresaId: string;
  nome: string;
  email: string;
  perfil: Perfil;
}

/** Injeta o usuário logado no parâmetro do controller: `@Usuario() usuario: UsuarioLogado`. */
export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioLogado => {
  return ctx.switchToHttp().getRequest().usuario;
});
