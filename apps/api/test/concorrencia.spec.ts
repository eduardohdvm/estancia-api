// Integração com Postgres real: prova que operações simultâneas não corrompem estoque,
// numeração nem status. Usa DATABASE_URL_TESTE (nunca HML/PRD); sem ela os testes são pulados.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { proximoNumero } from '../src/common/sequencia';
import { EstoqueService } from '../src/estoque/estoque.service';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';
import { trocarStatus } from '../src/vendas/vendas.service';

const url = process.env.DATABASE_URL_TESTE;
const SIMULTANEAS = 8;

describe.skipIf(!url)('concorrência (Postgres)', () => {
  let prisma: PrismaClient;
  let estoque: EstoqueService;
  let empresaId: string;
  let produtoId: string;
  let depositoId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: SIMULTANEAS + 2 }) });
    estoque = new EstoqueService(prisma as unknown as PrismaService);
    const empresa = await prisma.empresa.create({ data: { nome: `Teste concorrência ${Date.now()}` } });
    empresaId = empresa.id;
    depositoId = (await prisma.deposito.create({ data: { empresaId, nome: 'Principal', padrao: true } })).id;
    produtoId = (await prisma.produto.create({ data: { empresaId, codigo: 'T1', nome: 'Pão de queijo teste' } })).id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  const movimentar = (tipo: 'ENTRADA' | 'SAIDA', quantidade: number) =>
    prisma.$transaction((tx) => estoque.movimentar(tx as never, { empresaId, produtoId, depositoId, tipo, quantidade }));

  it('saídas simultâneas não deixam o saldo negativo nem perdem atualização', async () => {
    await movimentar('ENTRADA', 5);
    // 8 saídas de 1 unidade disputando 5 em estoque: exatamente 5 passam.
    const resultados = await Promise.allSettled(Array.from({ length: SIMULTANEAS }, () => movimentar('SAIDA', 1)));
    const ok = resultados.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(5);

    const saldo = await prisma.estoque.findUniqueOrThrow({ where: { produtoId_depositoId: { produtoId, depositoId } } });
    expect(Number(saldo.quantidade)).toBe(0);

    // O histórico encadeia: cada saldoAnterior é o saldoNovo do movimento anterior.
    const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId }, orderBy: { createdAt: 'asc' } });
    expect(movimentos).toHaveLength(6);
    for (let i = 1; i < movimentos.length; i++) {
      expect(Number(movimentos[i].saldoAnterior)).toBe(Number(movimentos[i - 1].saldoNovo));
    }
  });

  it('entradas simultâneas somam todas', async () => {
    await Promise.all(Array.from({ length: SIMULTANEAS }, () => movimentar('ENTRADA', 2)));
    const saldo = await prisma.estoque.findUniqueOrThrow({ where: { produtoId_depositoId: { produtoId, depositoId } } });
    expect(Number(saldo.quantidade)).toBe(SIMULTANEAS * 2);
  });

  it('numeração simultânea não repete números', async () => {
    const numeros = await Promise.all(
      Array.from({ length: SIMULTANEAS }, () => prisma.$transaction((tx) => proximoNumero(tx as never, empresaId, 'PEDIDO'))),
    );
    expect(new Set(numeros).size).toBe(SIMULTANEAS);
    expect(Math.min(...numeros)).toBe(1);
    expect(Math.max(...numeros)).toBe(SIMULTANEAS);
  });

  it('dois cliques em "faturar" ao mesmo tempo: só um muda o status', async () => {
    const cliente = await prisma.pessoa.create({ data: { empresaId, nome: 'Cliente teste' } });
    const pedido = await prisma.pedidoVenda.create({
      data: { empresaId, numero: 999_001, clienteId: cliente.id, depositoId, status: 'APROVADO' },
    });
    const tentativas = await Promise.allSettled(
      Array.from({ length: SIMULTANEAS }, () =>
        prisma.$transaction((tx) => trocarStatus(tx as never, pedido.id, ['ORCAMENTO', 'APROVADO'], { status: 'FATURADO' })),
      ),
    );
    expect(tentativas.filter((t) => t.status === 'fulfilled')).toHaveLength(1);
    const rejeitadas = tentativas.filter((t): t is PromiseRejectedResult => t.status === 'rejected');
    expect(rejeitadas.every((t) => t.reason?.status === 409)).toBe(true);
  });
});
