import { BadRequestException, Injectable } from '@nestjs/common';
import { paginar, resultado } from '../common/paginacao';
import { Prisma } from '../generated/prisma/client';
import { TipoMovimento } from '../generated/prisma/enums';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { CriarMovimentoDto, DepositoDto, FiltroMovimentoDto } from './estoque.dto';

export interface Movimento {
  empresaId: string;
  produtoId: string;
  depositoId: string;
  tipo: TipoMovimento;
  quantidade: number;
  custoUnitario?: number;
  observacao?: string;
  pedidoId?: string;
  usuarioId?: string;
}

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Atualiza o saldo e grava o histórico. Deve rodar dentro de uma transação
   * para que saldo e histórico nunca fiquem diferentes.
   */
  async movimentar(tx: Tx, m: Movimento) {
    const atual = await tx.estoque.findUnique({
      where: { produtoId_depositoId: { produtoId: m.produtoId, depositoId: m.depositoId } },
    });
    const saldoAnterior = Number(atual?.quantidade ?? 0);
    const saldoNovo =
      m.tipo === 'ENTRADA' ? saldoAnterior + m.quantidade : m.tipo === 'SAIDA' ? saldoAnterior - m.quantidade : m.quantidade;

    if (saldoNovo < 0) {
      const produto = await tx.produto.findUnique({ where: { id: m.produtoId }, select: { nome: true } });
      throw new BadRequestException(
        `Estoque insuficiente de "${produto?.nome}": saldo ${saldoAnterior}, saída de ${m.quantidade}`,
      );
    }

    await tx.estoque.upsert({
      where: { produtoId_depositoId: { produtoId: m.produtoId, depositoId: m.depositoId } },
      create: { empresaId: m.empresaId, produtoId: m.produtoId, depositoId: m.depositoId, quantidade: saldoNovo },
      update: { quantidade: saldoNovo },
    });

    return tx.movimentoEstoque.create({
      data: {
        ...m,
        quantidade: m.tipo === 'AJUSTE' ? Math.abs(saldoNovo - saldoAnterior) : m.quantidade,
        saldoAnterior,
        saldoNovo,
      },
    });
  }

  async lancarMovimento(empresaId: string, usuarioId: string, dto: CriarMovimentoDto) {
    const produto = await this.prisma.produto.findFirstOrThrow({ where: { id: dto.produtoId, empresaId } });
    if (produto.servico) throw new BadRequestException('Serviços não têm estoque');
    await this.prisma.deposito.findFirstOrThrow({ where: { id: dto.depositoId, empresaId } });

    return this.prisma.$transaction(async (tx) => {
      const movimento = await this.movimentar(tx, { ...dto, empresaId, usuarioId });
      // Entrada com custo informado atualiza o preço de custo do produto.
      if (dto.tipo === 'ENTRADA' && dto.custoUnitario) {
        await tx.produto.update({ where: { id: produto.id }, data: { precoCusto: dto.custoUnitario } });
      }
      return movimento;
    });
  }

  async listarMovimentos(empresaId: string, filtro: FiltroMovimentoDto) {
    const where: Prisma.MovimentoEstoqueWhereInput = {
      empresaId,
      produtoId: filtro.produtoId,
      depositoId: filtro.depositoId,
      tipo: filtro.tipo,
    };
    if (filtro.busca) where.produto = { nome: { contains: filtro.busca, mode: 'insensitive' } };

    const [itens, total] = await Promise.all([
      this.prisma.movimentoEstoque.findMany({
        where,
        include: {
          produto: { select: { id: true, codigo: true, nome: true, unidade: true } },
          deposito: { select: { id: true, nome: true } },
          pedido: { select: { id: true, numero: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginar(filtro),
      }),
      this.prisma.movimentoEstoque.count({ where }),
    ]);
    return resultado(itens, total, filtro);
  }

  listarDepositos(empresaId: string) {
    return this.prisma.deposito.findMany({ where: { empresaId }, orderBy: [{ padrao: 'desc' }, { nome: 'asc' }] });
  }

  async criarDeposito(empresaId: string, dto: DepositoDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.padrao) await tx.deposito.updateMany({ where: { empresaId }, data: { padrao: false } });
      return tx.deposito.create({ data: { ...dto, empresaId } });
    });
  }

  async atualizarDeposito(empresaId: string, id: string, dto: DepositoDto) {
    await this.prisma.deposito.findFirstOrThrow({ where: { id, empresaId } });
    return this.prisma.$transaction(async (tx) => {
      if (dto.padrao) await tx.deposito.updateMany({ where: { empresaId }, data: { padrao: false } });
      return tx.deposito.update({ where: { id }, data: dto });
    });
  }

  async depositoPadrao(empresaId: string) {
    const deposito = await this.prisma.deposito.findFirst({ where: { empresaId }, orderBy: { padrao: 'desc' } });
    if (!deposito) throw new BadRequestException('Cadastre um depósito antes de continuar');
    return deposito;
  }
}
