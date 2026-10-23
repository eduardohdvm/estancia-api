import { Injectable } from '@nestjs/common';
import { paginar, resultado } from '../common/paginacao';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarProdutoDto, CategoriaDto, CriarProdutoDto, FiltroProdutoDto } from './produtos.dto';

const incluir = {
  categoria: { select: { id: true, nome: true } },
  estoques: { select: { quantidade: true, deposito: { select: { id: true, nome: true } } } },
} satisfies Prisma.ProdutoInclude;

type ProdutoComEstoque = Prisma.ProdutoGetPayload<{ include: typeof incluir }>;

/** Acrescenta o saldo somado de todos os depósitos. */
function comSaldo(produto: ProdutoComEstoque) {
  const saldo = produto.estoques.reduce((soma, e) => soma + Number(e.quantidade), 0);
  return { ...produto, saldo, estoqueBaixo: !produto.servico && saldo < Number(produto.estoqueMinimo) };
}

@Injectable()
export class ProdutosService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string, filtro: FiltroProdutoDto) {
    const where: Prisma.ProdutoWhereInput = { empresaId };
    if (filtro.categoriaId) where.categoriaId = filtro.categoriaId;
    if (filtro.busca) {
      where.OR = [
        { nome: { contains: filtro.busca, mode: 'insensitive' } },
        { codigo: { contains: filtro.busca, mode: 'insensitive' } },
        { codigoBarras: filtro.busca },
      ];
    }

    if (filtro.estoqueBaixo) {
      // O saldo é calculado, então este filtro é feito em memória.
      const todos = await this.prisma.produto.findMany({
        where: { ...where, servico: false, ativo: true },
        include: incluir,
        orderBy: { nome: 'asc' },
      });
      const baixos = todos.map(comSaldo).filter((p) => p.estoqueBaixo);
      const { skip, take } = paginar(filtro);
      return resultado(baixos.slice(skip, skip + take), baixos.length, filtro);
    }

    const [itens, total] = await Promise.all([
      this.prisma.produto.findMany({ where, include: incluir, orderBy: { nome: 'asc' }, ...paginar(filtro) }),
      this.prisma.produto.count({ where }),
    ]);
    return resultado(itens.map(comSaldo), total, filtro);
  }

  async buscar(empresaId: string, id: string) {
    return comSaldo(await this.prisma.produto.findFirstOrThrow({ where: { id, empresaId }, include: incluir }));
  }

  async criar(empresaId: string, dto: CriarProdutoDto) {
    if (dto.categoriaId) await this.prisma.categoria.findFirstOrThrow({ where: { id: dto.categoriaId, empresaId } });
    return comSaldo(await this.prisma.produto.create({ data: { ...dto, empresaId }, include: incluir }));
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarProdutoDto) {
    await this.prisma.produto.findFirstOrThrow({ where: { id, empresaId } });
    if (dto.categoriaId) await this.prisma.categoria.findFirstOrThrow({ where: { id: dto.categoriaId, empresaId } });
    return comSaldo(await this.prisma.produto.update({ where: { id }, data: dto, include: incluir }));
  }

  async remover(empresaId: string, id: string) {
    await this.prisma.produto.findFirstOrThrow({ where: { id, empresaId } });
    await this.prisma.$transaction([
      this.prisma.estoque.deleteMany({ where: { produtoId: id, quantidade: 0 } }),
      this.prisma.produto.delete({ where: { id } }),
    ]);
  }

  listarCategorias(empresaId: string) {
    return this.prisma.categoria.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' },
      include: { _count: { select: { produtos: true } } },
    });
  }

  criarCategoria(empresaId: string, dto: CategoriaDto) {
    return this.prisma.categoria.create({ data: { ...dto, empresaId } });
  }

  async removerCategoria(empresaId: string, id: string) {
    await this.prisma.categoria.findFirstOrThrow({ where: { id, empresaId } });
    await this.prisma.categoria.delete({ where: { id } });
  }
}
