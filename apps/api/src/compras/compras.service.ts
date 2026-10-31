import { BadRequestException, Injectable } from '@nestjs/common';
import { centavos, hoje, somarDias } from '../common/datas';
import { paginar, resultado } from '../common/paginacao';
import { proximoNumero } from '../common/sequencia';
import { UsuarioLogado } from '../common/usuario-logado';
import { EstoqueService } from '../estoque/estoque.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FiltroCompraDto, ReceberCompraDto, SalvarCompraDto } from './compras.dto';

const incluir = {
  fornecedor: { select: { id: true, nome: true, documento: true, telefone: true, email: true } },
  deposito: { select: { id: true, nome: true } },
  itens: { include: { produto: { select: { id: true, codigo: true, unidade: true } } } },
  lancamentos: {
    select: { id: true, parcela: true, totalParcelas: true, valor: true, vencimento: true, status: true },
    orderBy: { parcela: 'asc' },
  },
} satisfies Prisma.PedidoCompraInclude;

@Injectable()
export class ComprasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  async listar(empresaId: string, filtro: FiltroCompraDto) {
    const where: Prisma.PedidoCompraWhereInput = { empresaId, status: filtro.status, fornecedorId: filtro.fornecedorId };
    if (filtro.busca) {
      const numero = Number(filtro.busca);
      where.OR = [
        { fornecedor: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
        ...(Number.isInteger(numero) ? [{ numero }] : []),
      ];
    }
    const [itens, total] = await Promise.all([
      this.prisma.pedidoCompra.findMany({
        where,
        include: { fornecedor: { select: { id: true, nome: true } } },
        orderBy: { numero: 'desc' },
        ...paginar(filtro),
      }),
      this.prisma.pedidoCompra.count({ where }),
    ]);
    return resultado(itens, total, filtro);
  }

  buscar(empresaId: string, id: string) {
    return this.prisma.pedidoCompra.findFirstOrThrow({ where: { id, empresaId }, include: incluir });
  }

  async criar(empresaId: string, dto: SalvarCompraDto) {
    const dados = await this.calcular(empresaId, dto);
    return this.prisma.$transaction(async (tx) => {
      return tx.pedidoCompra.create({
        data: { ...dados.pedido, empresaId, numero: await proximoNumero(tx, empresaId, 'COMPRA'), itens: { create: dados.itens } },
        include: incluir,
      });
    });
  }

  async atualizar(empresaId: string, id: string, dto: SalvarCompraDto) {
    const compra = await this.prisma.pedidoCompra.findFirstOrThrow({ where: { id, empresaId } });
    if (compra.status !== 'RASCUNHO' && compra.status !== 'ENVIADO') {
      throw new BadRequestException('Só é possível editar pedidos ainda não recebidos');
    }
    const dados = await this.calcular(empresaId, dto);
    return this.prisma.pedidoCompra.update({
      where: { id },
      data: { ...dados.pedido, itens: { deleteMany: {}, create: dados.itens } },
      include: incluir,
    });
  }

  async enviar(empresaId: string, id: string) {
    const compra = await this.prisma.pedidoCompra.findFirstOrThrow({ where: { id, empresaId } });
    if (compra.status !== 'RASCUNHO') throw new BadRequestException('Só rascunhos podem ser marcados como enviados');
    return this.prisma.pedidoCompra.update({ where: { id }, data: { status: 'ENVIADO' }, include: incluir });
  }

  /**
   * Recebe a mercadoria: dá entrada no estoque, atualiza o custo médio dos
   * produtos e gera as parcelas no contas a pagar.
   */
  async receber(usuario: UsuarioLogado, id: string, dto: ReceberCompraDto) {
    const { empresaId } = usuario;
    const compra = await this.prisma.pedidoCompra.findFirstOrThrow({
      where: { id, empresaId },
      include: { itens: { include: { produto: { include: { estoques: true } } } }, fornecedor: true },
    });
    if (compra.status !== 'RASCUNHO' && compra.status !== 'ENVIADO') {
      throw new BadRequestException('Este pedido já foi recebido ou cancelado');
    }
    if (dto.contaBancariaId) {
      await this.prisma.contaBancaria.findFirstOrThrow({ where: { id: dto.contaBancariaId, empresaId } });
    }
    const categoria = await this.prisma.categoriaFinanceira.findFirst({ where: { empresaId, tipo: 'PAGAR', nome: 'Fornecedores' } });

    // Frete e desconto do pedido são rateados no custo dos itens, proporcionalmente ao valor.
    const subtotal = Number(compra.subtotal);
    const fator = subtotal > 0 ? Number(compra.total) / subtotal : 1;

    return this.prisma.$transaction(async (tx) => {
      for (const item of compra.itens) {
        const quantidade = Number(item.quantidade);
        const custoReal = centavos(Number(item.custoUnitario) * fator);
        const saldoAtual = item.produto.estoques.reduce((s, e) => s + Math.max(0, Number(e.quantidade)), 0);
        const custoMedio =
          saldoAtual + quantidade > 0
            ? centavos((saldoAtual * Number(item.produto.precoCusto) + quantidade * custoReal) / (saldoAtual + quantidade))
            : custoReal;

        if (!item.produto.servico) {
          await this.estoque.movimentar(tx, {
            empresaId,
            produtoId: item.produtoId,
            depositoId: compra.depositoId,
            tipo: 'ENTRADA',
            quantidade,
            custoUnitario: custoReal,
            observacao: `Compra nº ${compra.numero} - ${compra.fornecedor.nome}`,
            pedidoCompraId: compra.id,
            usuarioId: usuario.id,
          });
        }
        await tx.produto.update({ where: { id: item.produtoId }, data: { precoCusto: custoMedio } });
      }

      const total = Number(compra.total);
      if (total > 0) {
        const n = compra.parcelas;
        const valorParcela = centavos(total / n);
        const inicio = dto.primeiroVencimento ? new Date(dto.primeiroVencimento) : somarDias(hoje(), 30);
        await tx.lancamento.createMany({
          data: Array.from({ length: n }, (_, i) => ({
            empresaId,
            tipo: 'PAGAR' as const,
            descricao: `Compra nº ${compra.numero} - ${compra.fornecedor.nome}`,
            pessoaId: compra.fornecedorId,
            pedidoCompraId: compra.id,
            categoriaId: categoria?.id,
            contaBancariaId: dto.contaBancariaId,
            valor: i === n - 1 ? centavos(total - valorParcela * (n - 1)) : valorParcela,
            vencimento: somarDias(inicio, 30 * i),
            parcela: i + 1,
            totalParcelas: n,
          })),
        });
      }

      return tx.pedidoCompra.update({ where: { id }, data: { status: 'RECEBIDO', recebidoEm: new Date() }, include: incluir });
    }, { timeout: 15_000 });
  }

  /** Cancela o pedido. Se já foi recebido, tira a mercadoria do estoque e cancela as parcelas em aberto. */
  async cancelar(usuario: UsuarioLogado, id: string) {
    const { empresaId } = usuario;
    const compra = await this.prisma.pedidoCompra.findFirstOrThrow({
      where: { id, empresaId },
      include: { itens: { include: { produto: { select: { servico: true } } } }, lancamentos: true },
    });
    if (compra.status === 'CANCELADO') throw new BadRequestException('Este pedido já está cancelado');
    if (compra.lancamentos.some((l) => l.status === 'PAGO')) {
      throw new BadRequestException('Há parcelas já pagas. Estorne os pagamentos antes de cancelar');
    }

    return this.prisma.$transaction(async (tx) => {
      if (compra.status === 'RECEBIDO') {
        for (const item of compra.itens) {
          if (item.produto.servico) continue;
          await this.estoque.movimentar(tx, {
            empresaId,
            produtoId: item.produtoId,
            depositoId: compra.depositoId,
            tipo: 'SAIDA',
            quantidade: Number(item.quantidade),
            observacao: `Cancelamento da compra nº ${compra.numero}`,
            pedidoCompraId: compra.id,
            usuarioId: usuario.id,
          });
        }
        await tx.lancamento.updateMany({ where: { pedidoCompraId: id, status: 'ABERTO' }, data: { status: 'CANCELADO' } });
      }
      return tx.pedidoCompra.update({ where: { id }, data: { status: 'CANCELADO' }, include: incluir });
    });
  }

  /**
   * Sugestão de compra: produtos abaixo do estoque mínimo, com a quantidade
   * para voltar ao dobro do mínimo, descontando o que já está pedido.
   */
  async sugestao(empresaId: string) {
    const [produtos, pendentes] = await Promise.all([
      this.prisma.produto.findMany({
        where: { empresaId, ativo: true, servico: false, estoqueMinimo: { gt: 0 } },
        select: { id: true, codigo: true, nome: true, unidade: true, precoCusto: true, estoqueMinimo: true, estoques: { select: { quantidade: true } } },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.pedidoCompraItem.groupBy({
        by: ['produtoId'],
        where: { pedido: { empresaId, status: { in: ['RASCUNHO', 'ENVIADO'] } } },
        _sum: { quantidade: true },
      }),
    ]);
    const jaPedido = new Map(pendentes.map((p) => [p.produtoId, Number(p._sum.quantidade ?? 0)]));

    return produtos
      .map((p) => {
        const saldo = p.estoques.reduce((s, e) => s + Number(e.quantidade), 0);
        const minimo = Number(p.estoqueMinimo);
        const pedido = jaPedido.get(p.id) ?? 0;
        return {
          produtoId: p.id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade,
          custoUnitario: Number(p.precoCusto),
          saldo,
          estoqueMinimo: minimo,
          jaPedido: pedido,
          sugerido: Math.ceil(minimo * 2 - saldo - pedido),
          abaixoDoMinimo: saldo < minimo,
        };
      })
      .filter((p) => p.abaixoDoMinimo && p.sugerido > 0);
  }

  /** Confere fornecedor, depósito e produtos e calcula os totais. */
  private async calcular(empresaId: string, dto: SalvarCompraDto) {
    const fornecedor = await this.prisma.pessoa.findFirst({ where: { id: dto.fornecedorId, empresaId } });
    if (!fornecedor) throw new BadRequestException('Fornecedor não encontrado');

    const depositoId = dto.depositoId
      ? (await this.prisma.deposito.findFirstOrThrow({ where: { id: dto.depositoId, empresaId } })).id
      : (await this.estoque.depositoPadrao(empresaId)).id;

    const ids = [...new Set(dto.itens.map((i) => i.produtoId))];
    const produtos = await this.prisma.produto.findMany({ where: { id: { in: ids }, empresaId } });
    if (produtos.length !== ids.length) throw new BadRequestException('Algum produto do pedido não foi encontrado');
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const itens = dto.itens.map((item) => {
      const produto = porId.get(item.produtoId)!;
      const custoUnitario = item.custoUnitario ?? Number(produto.precoCusto);
      return {
        produtoId: produto.id,
        descricao: produto.nome,
        quantidade: item.quantidade,
        custoUnitario,
        total: centavos(item.quantidade * custoUnitario),
      };
    });

    const subtotal = centavos(itens.reduce((s, i) => s + i.total, 0));
    const desconto = dto.desconto ?? 0;
    const frete = dto.frete ?? 0;
    const total = centavos(subtotal - desconto + frete);
    if (total < 0) throw new BadRequestException('O desconto é maior que o valor do pedido');

    return {
      pedido: {
        fornecedorId: fornecedor.id,
        depositoId,
        subtotal,
        desconto,
        frete,
        total,
        parcelas: dto.parcelas ?? 1,
        previsaoEntrega: dto.previsaoEntrega ? new Date(dto.previsaoEntrega) : null,
        observacoes: dto.observacoes,
      },
      itens,
    };
  }
}
