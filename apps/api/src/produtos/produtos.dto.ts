import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength, ValidateIf } from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';

const vazioParaNull = () => Transform(({ value }) => (value === '' ? null : value));

export class CriarProdutoDto {
  @IsString()
  @MinLength(1, { message: 'Informe o código' })
  codigo: string;

  @IsString()
  @MinLength(2, { message: 'Informe o nome' })
  nome: string;

  @IsOptional() @vazioParaNull() @IsString() codigoBarras?: string | null;
  @IsOptional() @vazioParaNull() @IsString() descricao?: string | null;
  @IsOptional() @IsString() unidade?: string;

  @IsOptional()
  @vazioParaNull()
  @ValidateIf((o) => o.categoriaId !== null)
  @IsUUID()
  categoriaId?: string | null;

  @IsOptional() @IsNumber() @Min(0) precoCusto?: number;
  @IsOptional() @IsNumber() @Min(0) precoVenda?: number;
  @IsOptional() @IsNumber() @Min(0) estoqueMinimo?: number;
  @IsOptional() @IsBoolean() servico?: boolean;

  // Dados fiscais
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.ncm !== null) @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value)) @Matches(/^\d{8}$/, { message: 'NCM deve ter 8 dígitos' }) ncm?: string | null;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.cest !== null) @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value)) @Matches(/^\d{7}$/, { message: 'CEST deve ter 7 dígitos' }) cest?: string | null;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.cfop !== null) @Matches(/^5\d{3}$/, { message: 'CFOP deve ser de venda dentro do estado (5xxx); para outros estados o sistema troca para 6xxx' }) cfop?: string | null;
  @IsOptional() @vazioParaNull() @ValidateIf((o) => o.csosn !== null) @IsIn(['101', '102', '103', '300', '400', '500', '900'], { message: 'CSOSN não suportado' }) csosn?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(8) origem?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

export class AtualizarProdutoDto extends PartialType(CriarProdutoDto) {}

export class FiltroProdutoDto extends PaginacaoDto {
  @IsOptional()
  @IsUUID()
  categoriaId?: string;

  /** `true` lista só produtos com saldo abaixo do estoque mínimo. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  estoqueBaixo?: boolean;
}

export class CategoriaDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da categoria' })
  nome: string;
}
