import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';
import { StatusCompra } from '../generated/prisma/enums';

export class ItemCompraDto {
  @IsUUID()
  produtoId: string;

  @IsNumber()
  @Min(0.001, { message: 'A quantidade deve ser maior que zero' })
  quantidade: number;

  /** Se não vier, usa o preço de custo atual do produto. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  custoUnitario?: number;
}

export class SalvarCompraDto {
  @IsUUID()
  fornecedorId: string;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Adicione pelo menos um item' })
  @ValidateNested({ each: true })
  @Type(() => ItemCompraDto)
  itens: ItemCompraDto[];

  @IsOptional() @IsNumber() @Min(0) desconto?: number;
  @IsOptional() @IsNumber() @Min(0) frete?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  parcelas?: number;

  @IsOptional()
  @IsDateString()
  previsaoEntrega?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class ReceberCompraDto {
  /** Vencimento da 1ª parcela a pagar. As demais vencem a cada 30 dias. Padrão: hoje + 30 dias. */
  @IsOptional()
  @IsDateString()
  primeiroVencimento?: string;

  @IsOptional()
  @IsUUID()
  contaBancariaId?: string;
}

export class FiltroCompraDto extends PaginacaoDto {
  @IsOptional()
  @IsEnum(StatusCompra)
  status?: StatusCompra;

  @IsOptional()
  @IsUUID()
  fornecedorId?: string;
}
