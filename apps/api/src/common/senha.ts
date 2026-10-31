import bcrypt from 'bcryptjs';

/** Custo do bcrypt para senhas novas. Hashes antigos (custo 10) continuam válidos no login. */
export const CUSTO_BCRYPT = 12;

export const hashSenha = (senha: string) => bcrypt.hash(senha, CUSTO_BCRYPT);
