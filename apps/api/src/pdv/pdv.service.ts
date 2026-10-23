import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { centavos, hoje, somarDias } from '../common/datas';
import { paginar, resultado } from '../common/paginacao';
import { UsuarioLogado } from '../common/usuario-logado';
import { EstoqueService } from '../estoque/estoque.service';
import { FormaPagamento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { proximoNumeroPedido, VendasService } from '../vendas/vendas.service';
import { AbrirCaixaDto, FecharCaixaDto, FiltroCaixaDto, MovimentoCaixaDto, VendaPdvDto } from './pdv.dto';

export const NOME_CONSUMIDOR_FINAL = 'Consumidor final';

const rotuloForma: Record<FormaPagamento, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  CARTAO_DEBITO: 'Cartão de débito',
  CARTAO_CREDITO: 'Cartão de crédito',
  CREDIARIO: 'Crediário',
};

@Injectable()
export class PdvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vendas: VendasService,
    private readonly estoque: EstoqueService,
  ) {}

  // ─────────── Sessão de caixa ───────────

  /** Caixa aberto do operador logado, com o resumo de valores. `null` se não houver. */
  async atual(usuario: UsuarioLogado) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { empresaId: usuario.empresaId, usuarioId: usuario.id, status: 'ABERTO' },
    });
    return caixa ? this.detalhar(usuario.empresaId, caixa.id) : null;
  }

  async abrir(usuario: UsuarioLogado, dto: AbrirCaixaDto) {
    const { empresaId } = usuario;
    if (await this.prisma.caixa.findFirst({ where: { empresaId, usuarioId: usuario.id, status: 'ABERTO' } })) {
      throw new BadRequestException('Você já tem um caixa aberto');
    }
    const conta = await this.prisma.contaBancaria.findFirst({
      where: { empresaId, ativa: true, id: dto.contaBancariaId },
      orderBy: { createdAt: 'asc' },
    });
    if (!conta) throw new BadRequestException('Cadastre uma conta (caixa ou banco) antes de abrir o caixa');

    const caixa = await this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.caixa.aggregate({ where: { empresaId }, _max: { numero: true } });
      return tx.caixa.create({
        data: {
          empresaId,
          usuarioId: usuario.id,
          contaBancariaId: conta.id,
          numero: (ultimo._max.numero ?? 0) + 1,
          valorAbertura: dto.valorAbertura,
        },
      });
    });
    return this.detalhar(empresaId, caixa.id);
  }

  async movimentar(usuario: UsuarioLogado, dto: MovimentoCaixaDto) {
    const caixa = await this.caixaAberto(usuario);
    if (dto.tipo === 'SANGRIA') {
      const { resumo } = await this.detalhar(usuario.empresaId, caixa.id);
      if (dto.valor > resumo.dinheiroEsperado) {
        throw new BadRequestException(`Só há ${resumo.dinheiroEsperado.toFixed(2)} em dinheiro na gaveta`);
      }
    }
    await this.prisma.movimentoCaixa.create({ data: { ...dto, caixaId: caixa.id } });
    return this.detalhar(usuario.empresaId, caixa.id);
  }

  async fechar(usuario: UsuarioLogado, dto: FecharCaixaDto) {
    const caixa = await this.caixaAberto(usuario);
    const { resumo } = await this.detalhar(usuario.empresaId, caixa.id);
    await this.prisma.caixa.update({
      where: { id: caixa.id },
      data: {
        status: 'FECHADO',
        fechadoEm: new Date(),
        valorFechamento: dto.valorFechamento,
        valorEsperado: resumo.dinheiroEsperado,
        observacoes: dto.observacoes,
      },
    });
    return this.detalhar(usuario.empresaId, caixa.id);
  }

  async listar(usuario: UsuarioLogado, filtro: FiltroCaixaDto) {
    const where = {
      empresaId: usuario.empresaId,
      status: filtro.status,
      // Operador de caixa vê apenas os próprios caixas.
      ...(usuario.perfil === 'CAIXA' || usuario.perfil === 'VENDEDOR' ? { usuarioId: usuario.id } : {}),
    };
    const [itens, total] = await Promise.all([
      this.prisma.caixa.findMany({
        where,
        include: { usuario: { select: { id: true, nome: true } }, contaBancaria: { select: { id: true, nome: true } } },
        orderBy: { numero: 'desc' },
        ...paginar(filtro),
      }),
      this.prisma.caixa.count({ where }),
    ]);
    return resultado(itens, total, filtro);
  }

  /** Caixa com vendas, movimentos e o resumo por forma de pagamento. */
  async detalhar(empresaId: string, id: string) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { id, empresaId },
      include: {
        usuario: { select: { id: true, nome: true } },
        contaBancaria: { select: { id: true, nome: true } },
        movimentos: { orderBy: { createdAt: 'asc' } },
        vendas: {
          select: {
            id: true,
            numero: true,
            status: true,
            total: true,
            createdAt: true,
            cliente: { select: { id: true, nome: true } },
            pagamentos: { select: { forma: true, valor: true, troco: true } },
          },
          orderBy: { numero: 'desc' },
        },
      },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');

    const validas = caixa.vendas.filter((v) => v.status !== 'CANCELADO');
    const porForma = Object.fromEntries(Object.keys(rotuloForma).map((f) => [f, 0])) as Record<FormaPagamento, number>;
    for (const venda of validas) for (const p of venda.pagamentos) porForma[p.forma] += Number(p.valor);

    const soma = (tipo: 'SUPRIMENTO' | 'SANGRIA') =>
      caixa.movimentos.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.valor), 0);
    const suprimentos = soma('SUPRIMENTO');
    const sangrias = soma('SANGRIA');
    const totalVendas = validas.reduce((s, v) => s + Number(v.total), 0);

    return {
      ...caixa,
      resumo: {
        quantidadeVendas: validas.length,
        totalVendas: centavos(totalVendas),
        ticketMedio: validas.length ? centavos(totalVendas / validas.length) : 0,
        porForma: Object.entries(porForma).map(([forma, valor]) => ({
          forma,
          rotulo: rotuloForma[forma as FormaPagamento],
          valor: centavos(valor),
        })),
        suprimentos: centavos(suprimentos),
        sangrias: centavos(sangrias),
        dinheiroEsperado: centavos(Number(caixa.valorAbertura) + porForma.DINHEIRO + suprimentos - sangrias),
        diferenca: caixa.valorFechamento === null ? null : centavos(Number(caixa.valorFechamento) - Number(caixa.valorEsperado)),
      },
    };
  }

  // ─────────── Vendas ───────────

  /** Busca exata por código ou código de barras (leitor de código de barras). */
  async produtoPorCodigo(empresaId: string, codigo: string) {
    const produto = await this.prisma.produto.findFirst({
      where: { empresaId, ativo: true, OR: [{ codigo }, { codigoBarras: codigo }] },
      include: { estoques: { select: { quantidade: true } } },
    });
    if (!produto) throw new NotFoundException(`Produto "${codigo}" não encontrado`);
    return { ...produto, saldo: produto.estoques.reduce((s, e) => s + Number(e.quantidade), 0) };
  }

  /** Registra uma venda de balcão: já sai faturada, com estoque baixado e valores no financeiro. */
  async vender(usuario: UsuarioLogado, dto: VendaPdvDto) {
    const { empresaId } = usuario;
    const caixa = await this.caixaAberto(usuario);

    const clienteId = dto.clienteId ?? (await this.consumidorFinal(empresaId)).id;
    const cliente = await this.prisma.pessoa.findFirst({ where: { id: clienteId, empresaId } });
    if (!cliente) throw new BadRequestException('Cliente não encontrado');

    const { pedido, itens } = await this.vendas.calcular(empresaId, {
      clienteId,
      itens: dto.itens,
      desconto: dto.desconto,
    });
    const total = pedido.total;
    const pagamentos = this.conferirPagamentos(dto, total, cliente.nome === NOME_CONSUMIDOR_FINAL);

    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: itens.map((i) => i.produtoId) } },
      select: { id: true, servico: true },
    });
    const servico = new Set(produtos.filter((p) => p.servico).map((p) => p.id));
    const categoria = await this.prisma.categoriaFinanceira.findFirst({ where: { empresaId, tipo: 'RECEBER', nome: 'Vendas' } });

    return this.prisma.$transaction(async (tx) => {
      const numero = await proximoNumeroPedido(tx, empresaId);
      const venda = await tx.pedidoVenda.create({
        data: {
          ...pedido,
          empresaId,
          numero,
          origem: 'PDV',
          caixaId: caixa.id,
          vendedorId: usuario.id,
          status: 'FATURADO',
          faturadoEm: new Date(),
          parcelas: 1,
          itens: { create: itens },
          pagamentos: { create: pagamentos.map((p) => ({ ...p, caixaId: caixa.id })) },
        },
      });

      for (const item of itens) {
        if (servico.has(item.produtoId)) continue;
        await this.estoque.movimentar(tx, {
          empresaId,
          produtoId: item.produtoId,
          depositoId: pedido.depositoId,
          tipo: 'SAIDA',
          quantidade: item.quantidade,
          observacao: `PDV - venda nº ${numero}`,
          pedidoId: venda.id,
          usuarioId: usuario.id,
        });
      }

      // Cada forma de pagamento vira um lançamento: à vista já entra como recebido; crediário fica em aberto.
      await tx.lancamento.createMany({
        data: pagamentos.filter((p) => p.valor > 0).map((p) => {
          const aVista = p.forma !== 'CREDIARIO';
          return {
            empresaId,
            tipo: 'RECEBER' as const,
            status: aVista ? ('PAGO' as const) : ('ABERTO' as const),
            descricao: `PDV - venda nº ${numero} (${rotuloForma[p.forma]})`,
            pessoaId: clienteId,
            pedidoId: venda.id,
            categoriaId: categoria?.id,
            contaBancariaId: caixa.contaBancariaId,
            valor: p.valor,
            valorPago: aVista ? p.valor : null,
            vencimento: aVista ? hoje() : somarDias(hoje(), 30),
            pagoEm: aVista ? hoje() : null,
          };
        }),
      });

      const troco = pagamentos.reduce((s, p) => s + p.troco, 0);
      return { id: venda.id, numero, total, troco: centavos(troco) };
    }, { timeout: 15_000 });
  }

  /** Cancela uma venda do caixa ainda aberto: devolve o estoque e cancela os lançamentos. */
  async cancelarVenda(usuario: UsuarioLogado, pedidoId: string) {
    const { empresaId } = usuario;
    const venda = await this.prisma.pedidoVenda.findFirst({
      where: { id: pedidoId, empresaId, origem: 'PDV' },
      include: { caixa: true, itens: { include: { produto: { select: { servico: true } } } } },
    });
    if (!venda?.caixa) throw new NotFoundException('Venda do PDV não encontrada');
    if (venda.status === 'CANCELADO') throw new BadRequestException('Esta venda já está cancelada');
    if (venda.caixa.status !== 'ABERTO') throw new BadRequestException('O caixa desta venda já foi fechado');
    const gerente = usuario.perfil === 'ADMIN' || usuario.perfil === 'GERENTE';
    if (!gerente && venda.caixa.usuarioId !== usuario.id) throw new ForbiddenException('Esta venda é de outro caixa');

    await this.prisma.$transaction(async (tx) => {
      for (const item of venda.itens) {
        if (item.produto.servico) continue;
        await this.estoque.movimentar(tx, {
          empresaId,
          produtoId: item.produtoId,
          depositoId: venda.depositoId,
          tipo: 'ENTRADA',
          quantidade: Number(item.quantidade),
          observacao: `PDV - cancelamento da venda nº ${venda.numero}`,
          pedidoId: venda.id,
          usuarioId: usuario.id,
        });
      }
      await tx.lancamento.updateMany({ where: { pedidoId: venda.id }, data: { status: 'CANCELADO' } });
      await tx.pedidoVenda.update({ where: { id: venda.id }, data: { status: 'CANCELADO' } });
    });
    return this.detalhar(empresaId, venda.caixa.id);
  }

  // ─────────── Auxiliares ───────────

  private async caixaAberto(usuario: UsuarioLogado) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { empresaId: usuario.empresaId, usuarioId: usuario.id, status: 'ABERTO' },
    });
    if (!caixa) throw new BadRequestException('Abra o caixa antes de continuar');
    return caixa;
  }

  /** O cliente genérico das vendas sem identificação. Criado na primeira vez que for preciso. */
  private async consumidorFinal(empresaId: string) {
    return (
      (await this.prisma.pessoa.findFirst({ where: { empresaId, nome: NOME_CONSUMIDOR_FINAL, documento: null } })) ??
      this.prisma.pessoa.create({ data: { empresaId, nome: NOME_CONSUMIDOR_FINAL, cliente: true } })
    );
  }

  /**
   * Confere se os pagamentos cobrem o total. Só dinheiro pode passar do valor (troco).
   * Devolve cada pagamento já com o valor líquido que abate a venda.
   */
  private conferirPagamentos(dto: VendaPdvDto, total: number, semCliente: boolean) {
    if (semCliente && dto.pagamentos.some((p) => p.forma === 'CREDIARIO')) {
      throw new BadRequestException('Para vender no crediário, identifique o cliente');
    }
    const pago = centavos(dto.pagamentos.reduce((s, p) => s + p.valor, 0));
    if (pago < total) throw new BadRequestException(`Faltam ${(total - pago).toFixed(2)} para fechar a venda`);

    let troco = centavos(pago - total);
    const dinheiro = dto.pagamentos.filter((p) => p.forma === 'DINHEIRO').reduce((s, p) => s + p.valor, 0);
    if (troco > dinheiro) throw new BadRequestException('Só pagamentos em dinheiro podem ter troco');

    // O troco sai dos pagamentos em dinheiro.
    return dto.pagamentos.map((p) => {
      if (p.forma !== 'DINHEIRO' || troco === 0) return { forma: p.forma, valor: p.valor, troco: 0 };
      const desteTroco = Math.min(troco, p.valor);
      troco = centavos(troco - desteTroco);
      return { forma: p.forma, valor: centavos(p.valor - desteTroco), troco: desteTroco };
    }).filter((p) => p.valor > 0 || p.troco > 0);
  }
}
