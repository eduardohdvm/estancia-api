import { BadRequestException, Injectable } from '@nestjs/common';
import { centavos, hoje, somarDias } from '../common/datas';
import { paginar, resultado } from '../common/paginacao';
import { UsuarioLogado } from '../common/usuario-logado';
import { EstoqueService } from '../estoque/estoque.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { FaturarPedidoDto, FiltroPedidoDto, SalvarPedidoDto } from './vendas.dto';

const incluir = {
  cliente: { select: { id: true, nome: true, documento: true } },
  vendedor: { select: { id: true, nome: true } },
  deposito: { select: { id: true, nome: true } },
  itens: { include: { produto: { select: { id: true, codigo: true, unidade: true, servico: true } } } },
  lancamentos: {
    select: { id: true, parcela: true, totalParcelas: true, valor: true, vencimento: true, status: true },
    orderBy: { parcela: 'asc' },
  },
} satisfies Prisma.PedidoVendaInclude;

@Injectable()
export class VendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  async listar(empresaId: string, filtro: FiltroPedidoDto) {
    const where: Prisma.PedidoVendaWhereInput = { empresaId, status: filtro.status, clienteId: filtro.clienteId };
    if (filtro.busca) {
      const numero = Number(filtro.busca);
      where.OR = [
        { cliente: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
        ...(Number.isInteger(numero) ? [{ numero }] : []),
      ];
    }
    const [itens, total] = await Promise.all([
      this.prisma.pedidoVenda.findMany({
        where,
        include: { cliente: { select: { id: true, nome: true } }, vendedor: { select: { id: true, nome: true } } },
        orderBy: { numero: 'desc' },
        ...paginar(filtro),
      }),
      this.prisma.pedidoVenda.count({ where }),
    ]);
    return resultado(itens, total, filtro);
  }

  buscar(empresaId: string, id: string) {
    return this.prisma.pedidoVenda.findFirstOrThrow({ where: { id, empresaId }, include: incluir });
  }

  async criar(usuario: UsuarioLogado, dto: SalvarPedidoDto) {
    const dados = await this.calcular(usuario.empresaId, dto);
    return this.prisma.$transaction(async (tx) => {
      return tx.pedidoVenda.create({
        data: {
          ...dados.pedido,
          empresaId: usuario.empresaId,
          vendedorId: usuario.id,
          numero: await proximoNumeroPedido(tx, usuario.empresaId),
          itens: { create: dados.itens },
        },
        include: incluir,
      });
    });
  }

  async atualizar(empresaId: string, id: string, dto: SalvarPedidoDto) {
    const pedido = await this.prisma.pedidoVenda.findFirstOrThrow({ where: { id, empresaId } });
    if (pedido.status !== 'ORCAMENTO' && pedido.status !== 'APROVADO') {
      throw new BadRequestException('Só é possível editar orçamentos e pedidos aprovados');
    }
    const dados = await this.calcular(empresaId, dto);
    return this.prisma.pedidoVenda.update({
      where: { id },
      data: { ...dados.pedido, itens: { deleteMany: {}, create: dados.itens } },
      include: incluir,
    });
  }

  async aprovar(empresaId: string, id: string) {
    const pedido = await this.prisma.pedidoVenda.findFirstOrThrow({ where: { id, empresaId } });
    if (pedido.status !== 'ORCAMENTO') throw new BadRequestException('Só orçamentos podem ser aprovados');
    return this.prisma.pedidoVenda.update({ where: { id }, data: { status: 'APROVADO' }, include: incluir });
  }

  /** Fatura o pedido: baixa o estoque e gera as parcelas no contas a receber. */
  async faturar(usuario: UsuarioLogado, id: string, dto: FaturarPedidoDto) {
    const { empresaId } = usuario;
    const pedido = await this.prisma.pedidoVenda.findFirstOrThrow({
      where: { id, empresaId },
      include: { itens: { include: { produto: true } }, cliente: true },
    });
    if (pedido.status !== 'ORCAMENTO' && pedido.status !== 'APROVADO') {
      throw new BadRequestException('Este pedido já foi faturado ou cancelado');
    }
    if (dto.contaBancariaId) {
      await this.prisma.contaBancaria.findFirstOrThrow({ where: { id: dto.contaBancariaId, empresaId } });
    }
    const categoria = await this.prisma.categoriaFinanceira.findFirst({
      where: { empresaId, tipo: 'RECEBER', nome: 'Vendas' },
    });

    return this.prisma.$transaction(async (tx) => {
      for (const item of pedido.itens) {
        if (item.produto.servico) continue;
        await this.estoque.movimentar(tx, {
          empresaId,
          produtoId: item.produtoId,
          depositoId: pedido.depositoId,
          tipo: 'SAIDA',
          quantidade: Number(item.quantidade),
          observacao: `Venda nº ${pedido.numero}`,
          pedidoId: pedido.id,
          usuarioId: usuario.id,
        });
      }

      const total = Number(pedido.total);
      if (total > 0) {
        const n = pedido.parcelas;
        const valorParcela = centavos(total / n);
        const inicio = dto.primeiroVencimento ? new Date(dto.primeiroVencimento) : somarDias(hoje(), 30);
        await tx.lancamento.createMany({
          data: Array.from({ length: n }, (_, i) => ({
            empresaId,
            tipo: 'RECEBER' as const,
            descricao: `Venda nº ${pedido.numero} - ${pedido.cliente.nome}`,
            pessoaId: pedido.clienteId,
            pedidoId: pedido.id,
            categoriaId: categoria?.id,
            contaBancariaId: dto.contaBancariaId,
            // A última parcela absorve a diferença de arredondamento.
            valor: i === n - 1 ? centavos(total - valorParcela * (n - 1)) : valorParcela,
            vencimento: somarDias(inicio, 30 * i),
            parcela: i + 1,
            totalParcelas: n,
          })),
        });
      }

      return tx.pedidoVenda.update({
        where: { id },
        data: { status: 'FATURADO', faturadoEm: new Date() },
        include: incluir,
      });
    });
  }

  /** Cancela o pedido. Se já estava faturado, devolve o estoque e cancela as parcelas em aberto. */
  async cancelar(usuario: UsuarioLogado, id: string) {
    const { empresaId } = usuario;
    const pedido = await this.prisma.pedidoVenda.findFirstOrThrow({
      where: { id, empresaId },
      include: { itens: { include: { produto: true } }, lancamentos: true },
    });
    if (pedido.status === 'CANCELADO') throw new BadRequestException('Este pedido já está cancelado');
    if (pedido.origem === 'PDV') throw new BadRequestException('Vendas do PDV são canceladas pela frente de caixa');
    if (pedido.lancamentos.some((l) => l.status === 'PAGO')) {
      throw new BadRequestException('Há parcelas já recebidas. Estorne os recebimentos antes de cancelar');
    }

    return this.prisma.$transaction(async (tx) => {
      if (pedido.status === 'FATURADO') {
        for (const item of pedido.itens) {
          if (item.produto.servico) continue;
          await this.estoque.movimentar(tx, {
            empresaId,
            produtoId: item.produtoId,
            depositoId: pedido.depositoId,
            tipo: 'ENTRADA',
            quantidade: Number(item.quantidade),
            observacao: `Cancelamento da venda nº ${pedido.numero}`,
            pedidoId: pedido.id,
            usuarioId: usuario.id,
          });
        }
        await tx.lancamento.updateMany({ where: { pedidoId: id, status: 'ABERTO' }, data: { status: 'CANCELADO' } });
      }
      return tx.pedidoVenda.update({ where: { id }, data: { status: 'CANCELADO' }, include: incluir });
    });
  }

  /** Confere cliente, depósito e produtos e calcula os totais do pedido. */
  async calcular(empresaId: string, dto: SalvarPedidoDto) {
    const cliente = await this.prisma.pessoa.findFirst({ where: { id: dto.clienteId, empresaId } });
    if (!cliente) throw new BadRequestException('Cliente não encontrado');

    const depositoId = dto.depositoId
      ? (await this.prisma.deposito.findFirstOrThrow({ where: { id: dto.depositoId, empresaId } })).id
      : (await this.estoque.depositoPadrao(empresaId)).id;

    const ids = [...new Set(dto.itens.map((i) => i.produtoId))];
    const produtos = await this.prisma.produto.findMany({ where: { id: { in: ids }, empresaId } });
    if (produtos.length !== ids.length) throw new BadRequestException('Algum produto do pedido não foi encontrado');
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const itens = dto.itens.map((item) => {
      const produto = porId.get(item.produtoId)!;
      const precoUnitario = item.precoUnitario ?? Number(produto.precoVenda);
      const desconto = item.desconto ?? 0;
      const total = centavos(item.quantidade * precoUnitario - desconto);
      if (total < 0) throw new BadRequestException(`Desconto maior que o valor do item "${produto.nome}"`);
      return { produtoId: produto.id, descricao: produto.nome, quantidade: item.quantidade, precoUnitario, desconto, total };
    });

    const subtotal = centavos(itens.reduce((soma, i) => soma + i.total, 0));
    const desconto = dto.desconto ?? 0;
    const frete = dto.frete ?? 0;
    const total = centavos(subtotal - desconto + frete);
    if (total < 0) throw new BadRequestException('O desconto é maior que o valor do pedido');

    return {
      pedido: {
        clienteId: cliente.id,
        depositoId,
        subtotal,
        desconto,
        frete,
        total,
        parcelas: dto.parcelas ?? 1,
        observacoes: dto.observacoes,
      },
      itens,
    };
  }
}

/** Próximo número de pedido da empresa (vendas e PDV compartilham a numeração). */
export async function proximoNumeroPedido(tx: Tx, empresaId: string) {
  const ultimo = await tx.pedidoVenda.aggregate({ where: { empresaId }, _max: { numero: true } });
  return (ultimo._max.numero ?? 0) + 1;
}
