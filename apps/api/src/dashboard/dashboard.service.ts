import { Injectable } from '@nestjs/common';
import { hoje } from '../common/datas';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(empresaId: string) {
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioSeisMeses = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);

    const [vendasMes, orcamentosAbertos, receberHoje, receberVencido, pagarVencido, faturados, produtos, ultimosPedidos] =
      await Promise.all([
        this.prisma.pedidoVenda.aggregate({
          where: { empresaId, status: 'FATURADO', faturadoEm: { gte: inicioMes } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.pedidoVenda.count({ where: { empresaId, status: { in: ['ORCAMENTO', 'APROVADO'] } } }),
        this.prisma.lancamento.aggregate({
          where: { empresaId, tipo: 'RECEBER', status: 'ABERTO', vencimento: hoje() },
          _sum: { valor: true },
        }),
        this.prisma.lancamento.aggregate({
          where: { empresaId, tipo: 'RECEBER', status: 'ABERTO', vencimento: { lt: hoje() } },
          _sum: { valor: true },
        }),
        this.prisma.lancamento.aggregate({
          where: { empresaId, tipo: 'PAGAR', status: 'ABERTO', vencimento: { lte: hoje() } },
          _sum: { valor: true },
        }),
        this.prisma.pedidoVenda.findMany({
          where: { empresaId, status: 'FATURADO', faturadoEm: { gte: inicioSeisMeses } },
          select: { faturadoEm: true, total: true },
        }),
        this.prisma.produto.findMany({
          where: { empresaId, servico: false, ativo: true },
          select: { id: true, nome: true, estoqueMinimo: true, estoques: { select: { quantidade: true } } },
        }),
        this.prisma.pedidoVenda.findMany({
          where: { empresaId },
          select: { id: true, numero: true, status: true, total: true, createdAt: true, cliente: { select: { nome: true } } },
          orderBy: { numero: 'desc' },
          take: 5,
        }),
      ]);

    // Vendas faturadas por mês nos últimos 6 meses.
    const vendasPorMes = Array.from({ length: 6 }, (_, i) => {
      const mes = new Date(agora.getFullYear(), agora.getMonth() - 5 + i, 1);
      const total = faturados
        .filter((p) => p.faturadoEm!.getFullYear() === mes.getFullYear() && p.faturadoEm!.getMonth() === mes.getMonth())
        .reduce((soma, p) => soma + Number(p.total), 0);
      return { mes: `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`, total };
    });

    const estoqueBaixo = produtos
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        saldo: p.estoques.reduce((s, e) => s + Number(e.quantidade), 0),
        estoqueMinimo: Number(p.estoqueMinimo),
      }))
      .filter((p) => p.saldo < p.estoqueMinimo);

    const totalMes = Number(vendasMes._sum.total ?? 0);
    return {
      vendasMes: { total: totalMes, quantidade: vendasMes._count, ticketMedio: vendasMes._count ? totalMes / vendasMes._count : 0 },
      orcamentosAbertos,
      receberHoje: Number(receberHoje._sum.valor ?? 0),
      receberVencido: Number(receberVencido._sum.valor ?? 0),
      pagarHojeEVencido: Number(pagarVencido._sum.valor ?? 0),
      vendasPorMes,
      estoqueBaixo: estoqueBaixo.slice(0, 10),
      totalEstoqueBaixo: estoqueBaixo.length,
      ultimosPedidos,
    };
  }
}
