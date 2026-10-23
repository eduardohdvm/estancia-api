import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  senha: string;
}

export class EsqueciSenhaDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;
}

export class RedefinirSenhaDto {
  @IsString()
  @MinLength(20, { message: 'Link inválido' })
  token: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres' })
  senha: string;
}

export class RegistrarDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da empresa' })
  empresa: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsString()
  @MinLength(2, { message: 'Informe seu nome' })
  nome: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres' })
  senha: string;
}
