import { SetMetadata } from '@nestjs/common';
import { Perfil } from '../generated/prisma/enums';

export const PUBLICO = 'publico';
/** Marca uma rota que não exige login (ex.: login e cadastro). */
export const Publico = () => SetMetadata(PUBLICO, true);

export const PERFIS = 'perfis';
/** Restringe a rota a alguns perfis. ADMIN sempre tem acesso. */
export const Perfis = (...perfis: Perfil[]) => SetMetadata(PERFIS, perfis);
