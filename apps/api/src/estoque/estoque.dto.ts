import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';
import { TipoMovimento } from '../generated/prisma/enums';

export class CriarMovimentoDto {
  @IsUUID()
  produtoId: string;

  @IsUUID()
  depositoId: string;

  @IsEnum(TipoMovimento)
  tipo: TipoMovimento;

  /** Em ENTRADA e SAIDA é a quantidade movimentada; em AJUSTE é o novo saldo contado. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantidade: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  custoUnitario?: number;

  @IsOptional()
  @IsString()
  observacao?: string;
}

export class FiltroMovimentoDto extends PaginacaoDto {
  @IsOptional() @IsUUID() produtoId?: string;
  @IsOptional() @IsUUID() depositoId?: string;
  @IsOptional() @IsEnum(TipoMovimento) tipo?: TipoMovimento;
}

export class DepositoDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome do depósito' })
  nome: string;

  @IsOptional()
  @IsBoolean()
  padrao?: boolean;
}
