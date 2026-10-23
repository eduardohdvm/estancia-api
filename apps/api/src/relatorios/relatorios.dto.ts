import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class FiltroRelatorioDto {
  /** Início do período (AAAA-MM-DD). Padrão: primeiro dia do mês atual. */
  @IsOptional()
  @IsDateString()
  de?: string;

  /** Fim do período (AAAA-MM-DD). Padrão: hoje. */
  @IsOptional()
  @IsDateString()
  ate?: string;

  /** Só vendas da tela de pedidos ou só do PDV. Padrão: todas. */
  @IsOptional()
  @IsIn(['PEDIDO', 'PDV'])
  origem?: 'PEDIDO' | 'PDV';

  /** Agrupamento do relatório por período. */
  @IsOptional()
  @IsIn(['dia', 'semana', 'mes'])
  agrupar?: 'dia' | 'semana' | 'mes';
}
