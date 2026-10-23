import { BadRequestException, Injectable } from '@nestjs/common';
import { centavos, hoje, somarDias, somarMeses } from '../common/datas';
import { paginar, resultado } from '../common/paginacao';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarLancamentoDto,
  BaixarLancamentoDto,
  CategoriaFinanceiraDto,
  ContaBancariaDto,
  CriarLancamentoDto,
  FiltroLancamentoDto,
} from './financeiro.dto';

const incluir = {
  pessoa: { select: { id: true, nome: true } },
  categoria: { select: { id: true, nome: true } },
  contaBancaria: { select: { id: true, nome: true } },
  pedido: { select: { id: true, numero: true } },
  pedidoCompra: { select: { id: true, numero: true } },
} satisfies Prisma.LancamentoInclude;

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────── Contas a pagar e a receber ───────────

  async listar(empresaId: string, filtro: FiltroLancamentoDto) {
    const where: Prisma.LancamentoWhereInput = {
      empresaId,
      tipo: filtro.tipo,
      status: filtro.status,
      pessoaId: filtro.pessoaId,
      contaBancariaId: filtro.contaBancariaId,
    };
    if (filtro.vencimentoDe || filtro.vencimentoAte) {
      where.vencimento = {
        gte: filtro.vencimentoDe ? new Date(filtro.vencimentoDe) : undefined,
        lte: filtro.vencimentoAte ? new Date(filtro.vencimentoAte) : undefined,
      };
    }
    if (filtro.vencidos) {
      where.status = 'ABERTO';
      where.vencimento = { lt: hoje() };
    }
    if (filtro.busca) {
      where.OR = [
        { descricao: { contains: filtro.busca, mode: 'insensitive' } },
        { pessoa: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
      ];
    }

    const [itens, total, soma] = await Promise.all([
      this.prisma.lancamento.findMany({
        where,
        include: incluir,
        orderBy: [{ vencimento: 'asc' }, { createdAt: 'asc' }],
        ...paginar(filtro),
      }),
      this.prisma.lancamento.count({ where }),
      this.prisma.lancamento.aggregate({ where, _sum: { valor: true } }),
    ]);
    return { ...resultado(itens, total, filtro), somaValor: Number(soma._sum.valor ?? 0) };
  }

  buscar(empresaId: string, id: string) {
    return this.prisma.lancamento.findFirstOrThrow({ where: { id, empresaId }, include: incluir });
  }

  async criar(empresaId: string, { parcelas = 1, vencimento, valor, ...dto }: CriarLancamentoDto) {
    await this.validarVinculos(empresaId, dto);
    const valorParcela = centavos(valor / parcelas);
    const inicio = new Date(vencimento);

    await this.prisma.lancamento.createMany({
      data: Array.from({ length: parcelas }, (_, i) => ({
        ...dto,
        empresaId,
        descricao: parcelas > 1 ? `${dto.descricao} (${i + 1}/${parcelas})` : dto.descricao,
        valor: i === parcelas - 1 ? centavos(valor - valorParcela * (parcelas - 1)) : valorParcela,
        vencimento: somarMeses(inicio, i),
        parcela: i + 1,
        totalParcelas: parcelas,
      })),
    });
    return { criados: parcelas };
  }

  async atualizar(empresaId: string, id: string, { parcelas: _, vencimento, ...dto }: AtualizarLancamentoDto) {
    const lancamento = await this.prisma.lancamento.findFirstOrThrow({ where: { id, empresaId } });
    if (lancamento.status !== 'ABERTO') throw new BadRequestException('Só títulos em aberto podem ser editados');
    await this.validarVinculos(empresaId, dto);
    return this.prisma.lancamento.update({
      where: { id },
      data: { ...dto, vencimento: vencimento ? new Date(vencimento) : undefined },
      include: incluir,
    });
  }

  /** Registra o pagamento (contas a pagar) ou recebimento (contas a receber). */
  async baixar(empresaId: string, id: string, dto: BaixarLancamentoDto) {
    const lancamento = await this.prisma.lancamento.findFirstOrThrow({ where: { id, empresaId } });
    if (lancamento.status !== 'ABERTO') throw new BadRequestException('Este título não está em aberto');
    // Sem conta informada, usa a do título ou, por fim, a primeira conta ativa (normalmente o Caixa).
    const conta = await this.prisma.contaBancaria.findFirst({
      where: { empresaId, ativa: true, id: dto.contaBancariaId ?? lancamento.contaBancariaId ?? undefined },
      orderBy: { createdAt: 'asc' },
    });
    if (!conta) throw new BadRequestException('Cadastre uma conta (caixa ou banco) para registrar a baixa');
    const contaBancariaId = conta.id;

    return this.prisma.lancamento.update({
      where: { id },
      data: {
        status: 'PAGO',
        valorPago: dto.valorPago ?? lancamento.valor,
        pagoEm: dto.pagoEm ? new Date(dto.pagoEm) : hoje(),
        contaBancariaId,
      },
      include: incluir,
    });
  }

  /** Desfaz uma baixa, voltando o título para "em aberto". */
  async estornar(empresaId: string, id: string) {
    const lancamento = await this.prisma.lancamento.findFirstOrThrow({ where: { id, empresaId } });
    if (lancamento.status !== 'PAGO') throw new BadRequestException('Só títulos pagos podem ser estornados');
    return this.prisma.lancamento.update({
      where: { id },
      data: { status: 'ABERTO', valorPago: null, pagoEm: null },
      include: incluir,
    });
  }

  async cancelar(empresaId: string, id: string) {
    const lancamento = await this.prisma.lancamento.findFirstOrThrow({ where: { id, empresaId } });
    if (lancamento.status !== 'ABERTO') throw new BadRequestException('Só títulos em aberto podem ser cancelados');
    return this.prisma.lancamento.update({ where: { id }, data: { status: 'CANCELADO' }, include: incluir });
  }

  // ─────────── Resumo / fluxo de caixa ───────────

  async resumo(empresaId: string) {
    const dataHoje = hoje();
    const em30dias = somarDias(dataHoje, 30);
    const somar = (where: Prisma.LancamentoWhereInput) =>
      this.prisma.lancamento.aggregate({ where: { empresaId, ...where }, _sum: { valor: true } }).then((r) => Number(r._sum.valor ?? 0));

    const [receberAberto, receberVencido, pagarAberto, pagarVencido, receber30, pagar30, contas] = await Promise.all([
      somar({ tipo: 'RECEBER', status: 'ABERTO' }),
      somar({ tipo: 'RECEBER', status: 'ABERTO', vencimento: { lt: dataHoje } }),
      somar({ tipo: 'PAGAR', status: 'ABERTO' }),
      somar({ tipo: 'PAGAR', status: 'ABERTO', vencimento: { lt: dataHoje } }),
      somar({ tipo: 'RECEBER', status: 'ABERTO', vencimento: { gte: dataHoje, lte: em30dias } }),
      somar({ tipo: 'PAGAR', status: 'ABERTO', vencimento: { gte: dataHoje, lte: em30dias } }),
      this.listarContas(empresaId),
    ]);

    const saldoAtual = centavos(contas.filter((c) => c.ativa).reduce((s, c) => s + c.saldoAtual, 0));
    return {
      saldoAtual,
      receber: { aberto: receberAberto, vencido: receberVencido, proximos30dias: receber30 },
      pagar: { aberto: pagarAberto, vencido: pagarVencido, proximos30dias: pagar30 },
      saldoPrevisto30dias: centavos(saldoAtual + receberVencido + receber30 - pagarVencido - pagar30),
      contas,
    };
  }

  // ─────────── Contas bancárias e caixa ───────────

  async listarContas(empresaId: string) {
    const [contas, movimentos] = await Promise.all([
      this.prisma.contaBancaria.findMany({ where: { empresaId }, orderBy: { nome: 'asc' } }),
      this.prisma.lancamento.groupBy({
        by: ['contaBancariaId', 'tipo'],
        where: { empresaId, status: 'PAGO' },
        _sum: { valorPago: true },
      }),
    ]);
    return contas.map((conta) => {
      const total = (tipo: 'PAGAR' | 'RECEBER') =>
        Number(movimentos.find((m) => m.contaBancariaId === conta.id && m.tipo === tipo)?._sum.valorPago ?? 0);
      return { ...conta, saldoAtual: centavos(Number(conta.saldoInicial) + total('RECEBER') - total('PAGAR')) };
    });
  }

  criarConta(empresaId: string, dto: ContaBancariaDto) {
    return this.prisma.contaBancaria.create({ data: { ...dto, empresaId } });
  }

  async atualizarConta(empresaId: string, id: string, dto: ContaBancariaDto) {
    await this.prisma.contaBancaria.findFirstOrThrow({ where: { id, empresaId } });
    return this.prisma.contaBancaria.update({ where: { id }, data: dto });
  }

  // ─────────── Categorias (plano de contas) ───────────

  listarCategorias(empresaId: string) {
    return this.prisma.categoriaFinanceira.findMany({ where: { empresaId }, orderBy: [{ tipo: 'asc' }, { nome: 'asc' }] });
  }

  criarCategoria(empresaId: string, dto: CategoriaFinanceiraDto) {
    return this.prisma.categoriaFinanceira.create({ data: { ...dto, empresaId } });
  }

  /** Garante que pessoa, categoria e conta informadas pertencem à mesma empresa. */
  private async validarVinculos(empresaId: string, dto: { pessoaId?: string; categoriaId?: string; contaBancariaId?: string }) {
    await Promise.all([
      dto.pessoaId && this.prisma.pessoa.findFirstOrThrow({ where: { id: dto.pessoaId, empresaId } }),
      dto.categoriaId && this.prisma.categoriaFinanceira.findFirstOrThrow({ where: { id: dto.categoriaId, empresaId } }),
      dto.contaBancariaId && this.prisma.contaBancaria.findFirstOrThrow({ where: { id: dto.contaBancariaId, empresaId } }),
    ]);
  }
}
