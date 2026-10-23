import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength, ValidateIf } from 'class-validator';
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
