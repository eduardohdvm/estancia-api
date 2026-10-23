import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Perfil } from '../generated/prisma/enums';

export class CriarUsuarioDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres' })
  senha: string;

  @IsEnum(Perfil)
  perfil: Perfil;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class AtualizarUsuarioDto extends PartialType(CriarUsuarioDto) {}
