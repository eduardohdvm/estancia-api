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
import { StatusPedido } from '../generated/prisma/enums';

export class ItemPedidoDto {
  @IsUUID()
  produtoId: string;

  @IsNumber()
  @Min(0.001, { message: 'A quantidade deve ser maior que zero' })
  quantidade: number;

  /** Se não vier, usa o preço de venda do produto. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precoUnitario?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;
}

export class SalvarPedidoDto {
  @IsUUID()
  clienteId: string;

  @IsOptional()
  @IsUUID()
  depositoId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Adicione pelo menos um item' })
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];

  @IsOptional() @IsNumber() @Min(0) desconto?: number;
  @IsOptional() @IsNumber() @Min(0) frete?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(48)
  parcelas?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class FaturarPedidoDto {
  /** Vencimento da 1ª parcela. As demais vencem a cada 30 dias. Padrão: hoje + 30 dias. */
  @IsOptional()
  @IsDateString()
  primeiroVencimento?: string;

  @IsOptional()
  @IsUUID()
  contaBancariaId?: string;
}

export class FiltroPedidoDto extends PaginacaoDto {
  @IsOptional()
  @IsEnum(StatusPedido)
  status?: StatusPedido;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
