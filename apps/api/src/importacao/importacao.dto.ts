import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';
import type { LinhaBruta } from './planilha';

export const LIMITE_LINHAS = 5000;

export class ImportacaoDto {
  /** Linhas da planilha, cada uma como { "Nome da coluna": valor }. */
  @IsArray()
  @ArrayMinSize(1, { message: 'A planilha está vazia' })
  @ArrayMaxSize(LIMITE_LINHAS, { message: `Importe no máximo ${LIMITE_LINHAS} linhas por vez` })
  @IsObject({ each: true })
  linhas: LinhaBruta[];

  /** true = só confere e mostra o que seria feito, sem gravar. */
  @IsBoolean()
  simular: boolean;
}

export class ImportacaoPessoasDto extends ImportacaoDto {
  /** Papel usado quando a planilha não tem as colunas "cliente"/"fornecedor". */
  @IsOptional()
  @IsIn(['cliente', 'fornecedor'])
  papel?: 'cliente' | 'fornecedor';
}

export class ImportacaoEstoqueDto extends ImportacaoDto {
  /** AJUSTE = a quantidade da planilha vira o novo saldo (inventário); ENTRADA = soma ao saldo. */
  @IsIn(['AJUSTE', 'ENTRADA'])
  modo: 'AJUSTE' | 'ENTRADA';
}
