import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, ValidateNested } from 'class-validator';
import { PaginacaoDto } from '../common/paginacao';
import { FormaPagamento, StatusCaixa, TipoMovimentoCaixa } from '../generated/prisma/enums';
import { ItemPedidoDto } from '../vendas/vendas.dto';

export class AbrirCaixaDto {
  /** Dinheiro que já está na gaveta na abertura (troco). */
  @IsNumber()
  @Min(0)
  valorAbertura: number;

  /** Conta financeira onde as vendas entram. Padrão: a primeira conta ativa (Caixa). */
  @IsOptional()
  @IsUUID()
  contaBancariaId?: string;
}

export class MovimentoCaixaDto {
  @IsEnum(TipoMovimentoCaixa)
  tipo: TipoMovimentoCaixa;

  @IsNumber()
  @Min(0.01, { message: 'O valor deve ser maior que zero' })
  valor: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class PagamentoDto {
  @IsEnum(FormaPagamento)
  forma: FormaPagamento;

  /** Valor entregue pelo cliente. Em dinheiro pode ser maior que o total (gera troco). */
  @IsNumber()
  @Min(0.01)
  valor: number;
}

export class VendaPdvDto {
  /** Sem cliente, a venda vai para "Consumidor final". */
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Adicione pelo menos um item' })
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  itens: ItemPedidoDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  desconto?: number;

  /** CPF/CNPJ do consumidor para sair na NFC-e ("CPF na nota"). */
  @IsOptional()
  @Matches(/^(\d{11}|\d{14})$/, { message: 'CPF/CNPJ na nota deve ter 11 ou 14 dígitos' })
  documentoNota?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe a forma de pagamento' })
  @ValidateNested({ each: true })
  @Type(() => PagamentoDto)
  pagamentos: PagamentoDto[];
}

export class FecharCaixaDto {
  /** Dinheiro contado na gaveta no fechamento. */
  @IsNumber()
  @Min(0)
  valorFechamento: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class FiltroCaixaDto extends PaginacaoDto {
  @IsOptional()
  @IsEnum(StatusCaixa)
  status?: StatusCaixa;
}
