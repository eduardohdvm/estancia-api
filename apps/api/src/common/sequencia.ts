import { Prisma } from '../generated/prisma/client';
import { Tx } from '../prisma/prisma.service';

/** Numerações por empresa e a tabela de onde vem o maior número já usado (para começar dele). */
const TABELAS = {
  PEDIDO: 'PedidoVenda',
  COMPRA: 'PedidoCompra',
  CAIXA: 'Caixa',
} as const;

export type NomeSequencia = keyof typeof TABELAS;

/**
 * Próximo número da sequência, sem corrida (ADR-018): o UPDATE trava a linha da sequência
 * até o fim da transação, então duas requisições simultâneas nunca recebem o mesmo número.
 * Na primeira chamada a sequência nasce a partir do maior número já gravado na tabela.
 */
export async function proximoNumero(tx: Tx, empresaId: string, nome: NomeSequencia): Promise<number> {
  const tabela = Prisma.raw(`"${TABELAS[nome]}"`);
  const [linha] = await tx.$queryRaw<{ valor: number }[]>`
    INSERT INTO "Sequencia" ("empresaId", "nome", "valor")
    VALUES (${empresaId}, ${nome}, (SELECT COALESCE(MAX("numero"), 0) + 1 FROM ${tabela} WHERE "empresaId" = ${empresaId}))
    ON CONFLICT ("empresaId", "nome") DO UPDATE SET "valor" = "Sequencia"."valor" + 1
    RETURNING "valor"`;
  return linha.valor;
}
