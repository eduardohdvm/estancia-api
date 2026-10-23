import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';
import { StatusLancamento, TipoLancamento } from '../generated/prisma/enums';

export class CriarLancamentoDto {
  @IsEnum(TipoLancamento)
  tipo: TipoLancamento;

  @IsString()
  @MinLength(2, { message: 'Informe a descrição' })
  descricao: string;

  @IsNumber()
  @Min(0.01, { message: 'O valor deve ser maior que zero' })
  valor: number;

  /** Vencimento da 1ª parcela (AAAA-MM-DD). */
  @IsDateString()
  vencimento: string;

  /** Divide o valor em parcelas mensais. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  parcelas?: number;

  @IsOptional() @IsUUID() pessoaId?: string;
  @IsOptional() @IsUUID() categoriaId?: string;
  @IsOptional() @IsUUID() contaBancariaId?: string;
  @IsOptional() @IsString() observacoes?: string;
}

export class AtualizarLancamentoDto extends PartialType(CriarLancamentoDto) {}

export class BaixarLancamentoDto {
  /** Valor efetivamente pago/recebido (com juros ou desconto). Padrão: valor do título. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  valorPago?: number;

  /** Data do pagamento (AAAA-MM-DD). Padrão: hoje. */
  @IsOptional()
  @IsDateString()
  pagoEm?: string;

  @IsOptional()
  @IsUUID()
  contaBancariaId?: string;
}

export class FiltroLancamentoDto extends PaginacaoDto {
  @IsOptional() @IsEnum(TipoLancamento) tipo?: TipoLancamento;
  @IsOptional() @IsEnum(StatusLancamento) status?: StatusLancamento;
  @IsOptional() @IsUUID() pessoaId?: string;
  @IsOptional() @IsUUID() contaBancariaId?: string;
  @IsOptional() @IsDateString() vencimentoDe?: string;
  @IsOptional() @IsDateString() vencimentoAte?: string;

  /** `true` lista apenas os títulos em aberto já vencidos. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  vencidos?: boolean;
}

export class ContaBancariaDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da conta' })
  nome: string;

  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() agencia?: string;
  @IsOptional() @IsString() conta?: string;
  @IsOptional() @IsNumber() saldoInicial?: number;
  @IsOptional() @IsBoolean() ativa?: boolean;
}

export class CategoriaFinanceiraDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome da categoria' })
  nome: string;

  @IsEnum(TipoLancamento)
  tipo: TipoLancamento;
}
