import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsIn, IsOptional, IsString, Length, Matches, MinLength, ValidateIf } from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';
import { TipoPessoa } from '../generated/prisma/enums';

/** Campos de texto vazios viram null para não gravar "" no banco. */
const vazioParaNull = () => Transform(({ value }) => (value === '' ? null : value));

export class CriarPessoaDto {
  @IsOptional()
  @IsEnum(TipoPessoa)
  tipo?: TipoPessoa;

  @IsString()
  @MinLength(2, { message: 'Informe o nome' })
  nome: string;

  @IsOptional() @vazioParaNull() @IsString() nomeFantasia?: string | null;
  @IsOptional() @vazioParaNull() @IsString() documento?: string | null;

  @IsOptional()
  @vazioParaNull()
  @ValidateIf((o) => o.email !== null)
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string | null;

  @IsOptional() @vazioParaNull() @IsString() telefone?: string | null;
  @IsOptional() @vazioParaNull() @IsString() cep?: string | null;
  @IsOptional() @vazioParaNull() @IsString() endereco?: string | null;
  @IsOptional() @vazioParaNull() @IsString() numero?: string | null;
  @IsOptional() @vazioParaNull() @IsString() complemento?: string | null;
  @IsOptional() @vazioParaNull() @IsString() bairro?: string | null;
  @IsOptional() @vazioParaNull() @IsString() cidade?: string | null;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.codigoMunicipio !== null) @Matches(/^\d{7}$/, { message: 'Código do município (IBGE) deve ter 7 dígitos' }) codigoMunicipio?: string | null;
  @IsOptional() @vazioParaNull() @IsString() inscricaoEstadual?: string | null;

  @IsOptional()
  @vazioParaNull()
  @ValidateIf((o) => o.uf !== null)
  @Length(2, 2, { message: 'UF deve ter 2 letras' })
  uf?: string | null;

  @IsOptional() @vazioParaNull() @IsString() observacoes?: string | null;
  @IsOptional() @IsBoolean() cliente?: boolean;
  @IsOptional() @IsBoolean() fornecedor?: boolean;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class AtualizarPessoaDto extends PartialType(CriarPessoaDto) {}

export class FiltroPessoaDto extends PaginacaoDto {
  @IsOptional()
  @IsIn(['cliente', 'fornecedor'])
  papel?: 'cliente' | 'fornecedor';
}
