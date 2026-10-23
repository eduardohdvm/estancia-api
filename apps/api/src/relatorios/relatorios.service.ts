import { BadRequestException, Injectable } from '@nestjs/common';
import { centavos, diaNoFuso, fimDoDia, inicioDoDia } from '../common/datas';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FiltroRelatorioDto } from './relatorios.dto';

const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 10_000) / 100 : 0);

/** Período do filtro, com os padrões aplicados (mês atual até hoje). */
function periodo(f: FiltroRelatorioDto) {
  const hoje = diaNoFuso(new Date());
  const de = f.de ?? `${hoje.slice(0, 7)}-01`;
  const ate = f.ate ?? hoje;
  if (de > ate) throw new BadRequestException('A data inicial é maior que a final');
  return { de, ate };
}

/** Chave do período de uma data AAAA-MM-DD (a semana começa na segunda-feira). */
function chavePeriodo(dia: string, agrupar: 'dia' | 'semana' | 'mes') {
  if (agrupar === 'mes') return dia.slice(0, 7);
  if (agrupar === 'dia') return dia;
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Todos os períodos entre duas datas, para o gráfico não pular períodos sem venda. */
function periodosEntre(de: string, ate: string, agrupar: 'dia' | 'semana' | 'mes') {
  const chaves: string[] = [];
  for (let d = new Date(`${de}T12:00:00Z`); d.toISOString().slice(0, 10) <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
    const chave = chavePeriodo(d.toISOString().slice(0, 10), agrupar);
    if (chaves.at(-1) !== chave) chaves.push(chave);
  }
  return chaves;
}

const mesesEntre = (de: string, ate: string) => periodosEntre(de, ate, 'mes');

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pedidos faturados no período, com itens e custo. */
  private async vendas(empresaId: string, f: FiltroRelatorioDto) {
    const { de, ate } = periodo(f);
    const pedidos = await this.prisma.pedidoVenda.findMany({
      where: {
        empresaId,
        status: 'FATURADO',
        origem: f.origem,
        faturadoEm: { gte: inicioDoDia(de), lte: fimDoDia(ate) },
      },
      select: {
        id: true,
        subtotal: true,
        desconto: true,
        frete: true,
        total: true,
        faturadoEm: true,
        vendedor: { select: { id: true, nome: true } },
        itens: {
          select: {
            quantidade: true,
            total: true,
            custoUnitario: true,
            produto: { select: { id: true, codigo: true, nome: true, unidade: true, precoCusto: true, categoria: { select: { nome: true } } } },
          },
        },
      },
    });

    return {
      de,
      ate,
      pedidos: pedidos.map((p) => {
        const subtotal = Number(p.subtotal);
        // O desconto do pedido é rateado entre os itens, proporcional ao valor de cada um.
        const fator = subtotal > 0 ? (subtotal - Number(p.desconto)) / subtotal : 1;
        const itens = p.itens.map((i) => {
          const quantidade = Number(i.quantidade);
          const receita = Number(i.total) * fator;
          const custo = quantidade * Number(i.custoUnitario ?? i.produto.precoCusto);
          return { produto: i.produto, quantidade, receita, custo };
        });
        return {
          dia: diaNoFuso(p.faturadoEm!),
          vendedor: p.vendedor,
          subtotal,
          desconto: Number(p.desconto),
          frete: Number(p.frete),
          total: Number(p.total),
          custo: itens.reduce((s, i) => s + i.custo, 0),
          itens,
        };
      }),
    };
  }

  async porPeriodo(empresaId: string, f: FiltroRelatorioDto) {
    const agrupar = f.agrupar ?? 'dia';
    const { de, ate, pedidos } = await this.vendas(empresaId, f);
    const linhas = new Map(periodosEntre(de, ate, agrupar).map((chave) => [chave, { periodo: chave, pedidos: 0, faturamento: 0, custo: 0, lucro: 0 }]));
    for (const p of pedidos) {
      const l = linhas.get(chavePeriodo(p.dia, agrupar))!;
      l.pedidos++;
      l.faturamento += p.total;
      l.custo += p.custo;
      l.lucro += p.total - p.frete - p.custo;
    }
    const itens = [...linhas.values()].map((l) => ({
      ...l,
      faturamento: centavos(l.faturamento),
      custo: centavos(l.custo),
      lucro: centavos(l.lucro),
      ticketMedio: l.pedidos ? centavos(l.faturamento / l.pedidos) : 0,
    }));
    const faturamento = itens.reduce((s, l) => s + l.faturamento, 0);
    const lucro = itens.reduce((s, l) => s + l.lucro, 0);
    return {
      de,
      ate,
      agrupar,
      itens,
      totais: {
        pedidos: pedidos.length,
        faturamento: centavos(faturamento),
        custo: centavos(itens.reduce((s, l) => s + l.custo, 0)),
        lucro: centavos(lucro),
        ticketMedio: pedidos.length ? centavos(faturamento / pedidos.length) : 0,
        margem: pct(lucro, faturamento - pedidos.reduce((s, p) => s + p.frete, 0)),
      },
    };
  }

  async porProduto(empresaId: string, f: FiltroRelatorioDto) {
    const { de, ate, pedidos } = await this.vendas(empresaId, f);
    const porId = new Map<string, { produtoId: string; codigo: string; nome: string; unidade: string; categoria: string; quantidade: number; faturamento: number; custo: number; pedidos: number }>();
    for (const p of pedidos) {
      for (const i of p.itens) {
        const l = porId.get(i.produto.id) ?? {
          produtoId: i.produto.id,
          codigo: i.produto.codigo,
          nome: i.produto.nome,
          unidade: i.produto.unidade,
          categoria: i.produto.categoria?.nome ?? 'Sem categoria',
          quantidade: 0,
          faturamento: 0,
          custo: 0,
          pedidos: 0,
        };
        l.quantidade += i.quantidade;
        l.faturamento += i.receita;
        l.custo += i.custo;
        l.pedidos++;
        porId.set(i.produto.id, l);
      }
    }
    const total = [...porId.values()].reduce((s, l) => s + l.faturamento, 0);
    const itens = [...porId.values()]
      .sort((a, b) => b.faturamento - a.faturamento)
      .map((l) => ({
        ...l,
        quantidade: Math.round(l.quantidade * 1000) / 1000,
        faturamento: centavos(l.faturamento),
        custo: centavos(l.custo),
        lucro: centavos(l.faturamento - l.custo),
        margem: pct(l.faturamento - l.custo, l.faturamento),
        participacao: pct(l.faturamento, total),
      }));
    return {
      de,
      ate,
      itens,
      totais: {
        produtos: itens.length,
        quantidade: Math.round(itens.reduce((s, l) => s + l.quantidade, 0) * 1000) / 1000,
        faturamento: centavos(total),
        custo: centavos(itens.reduce((s, l) => s + l.custo, 0)),
        lucro: centavos(itens.reduce((s, l) => s + l.lucro, 0)),
        margem: pct(itens.reduce((s, l) => s + l.lucro, 0), total),
      },
    };
  }

  async porVendedor(empresaId: string, f: FiltroRelatorioDto) {
    const { de, ate, pedidos } = await this.vendas(empresaId, f);
    const porId = new Map<string, { vendedorId: string | null; vendedor: string; pedidos: number; faturamento: number; lucro: number }>();
    for (const p of pedidos) {
      const chave = p.vendedor?.id ?? 'sem';
      const l = porId.get(chave) ?? { vendedorId: p.vendedor?.id ?? null, vendedor: p.vendedor?.nome ?? 'Sem vendedor', pedidos: 0, faturamento: 0, lucro: 0 };
      l.pedidos++;
      l.faturamento += p.total;
      l.lucro += p.total - p.frete - p.custo;
      porId.set(chave, l);
    }
    const total = pedidos.reduce((s, p) => s + p.total, 0);
    const itens = [...porId.values()]
      .sort((a, b) => b.faturamento - a.faturamento)
      .map((l) => ({
        ...l,
        faturamento: centavos(l.faturamento),
        lucro: centavos(l.lucro),
        ticketMedio: centavos(l.faturamento / l.pedidos),
        participacao: pct(l.faturamento, total),
      }));
    return { de, ate, itens, totais: { vendedores: itens.length, pedidos: pedidos.length, faturamento: centavos(total), lucro: centavos(itens.reduce((s, l) => s + l.lucro, 0)) } };
  }

  /**
   * Curva ABC por faturamento: A = produtos que somam os primeiros 80% do faturamento,
   * B = os próximos 15%, C = os últimos 5%. Também lista os produtos sem venda no período.
   */
  async curvaAbc(empresaId: string, f: FiltroRelatorioDto) {
    const { de, ate, itens, totais } = await this.porProduto(empresaId, f);
    // Acumula pelos valores exatos (somar percentuais já arredondados erra na fronteira dos 80%).
    let acumulado = 0;
    const classificados = itens.map((l) => {
      const antes = totais.faturamento ? (acumulado / totais.faturamento) * 100 : 0;
      acumulado += l.faturamento;
      const classe = antes < 80 - 1e-9 ? 'A' : antes < 95 - 1e-9 ? 'B' : 'C';
      return { ...l, acumulado: pct(acumulado, totais.faturamento), classe };
    });
    const classes = (['A', 'B', 'C'] as const).map((classe) => {
      const daClasse = classificados.filter((l) => l.classe === classe);
      const faturamento = daClasse.reduce((s, l) => s + l.faturamento, 0);
      return { classe, produtos: daClasse.length, percentualProdutos: pct(daClasse.length, classificados.length), faturamento: centavos(faturamento), percentualFaturamento: pct(faturamento, totais.faturamento) };
    });
    const vendidos = new Set(itens.map((l) => l.produtoId));
    const semVenda = await this.prisma.produto.findMany({
      where: { empresaId, ativo: true, servico: false, id: { notIn: [...vendidos] } },
      select: { id: true, codigo: true, nome: true, estoques: { select: { quantidade: true } } },
      orderBy: { nome: 'asc' },
    });
    return {
      de,
      ate,
      itens: classificados,
      classes,
      semVenda: semVenda.map((p) => ({ produtoId: p.id, codigo: p.codigo, nome: p.nome, saldo: p.estoques.reduce((s, e) => s + Number(e.quantidade), 0) })),
      totais,
    };
  }

  /**
   * DRE gerencial por mês (regime de competência): vendas pela data de faturamento,
   * despesas e outras receitas pela data de vencimento. Compras de mercadoria não
   * entram como despesa: o custo delas aparece no CMV quando o produto é vendido.
   */
  async dre(empresaId: string, f: FiltroRelatorioDto) {
    const { de, ate, pedidos } = await this.vendas(empresaId, { ...f, origem: undefined });
    const meses = mesesEntre(de, ate);
    const zeros = () => meses.map(() => 0);
    const idx = (mes: string) => meses.indexOf(mes);

    const receitaBruta = zeros();
    const descontos = zeros();
    const fretes = zeros();
    const cmv = zeros();
    for (const p of pedidos) {
      const i = idx(p.dia.slice(0, 7));
      receitaBruta[i] += p.subtotal;
      descontos[i] += p.desconto;
      fretes[i] += p.frete;
      cmv[i] += p.custo;
    }

    const lancamentos = await this.prisma.lancamento.findMany({
      where: {
        empresaId,
        status: { not: 'CANCELADO' },
        pedidoId: null,
        pedidoCompraId: null,
        vencimento: { gte: new Date(`${de}T00:00:00Z`), lte: new Date(`${ate}T00:00:00Z`) },
        // Pagamentos a fornecedor são compra de mercadoria (estoque), não despesa.
        NOT: { categoria: { nome: 'Fornecedores', tipo: 'PAGAR' } },
      } satisfies Prisma.LancamentoWhereInput,
      select: { tipo: true, valor: true, vencimento: true, categoria: { select: { nome: true } } },
    });
    const despesas = new Map<string, number[]>();
    const outrasReceitas = new Map<string, number[]>();
    for (const l of lancamentos) {
      const grupo = l.tipo === 'PAGAR' ? despesas : outrasReceitas;
      const nome = l.categoria?.nome ?? 'Sem categoria';
      const valores = grupo.get(nome) ?? zeros();
      valores[idx(l.vencimento.toISOString().slice(0, 7))] += Number(l.valor);
      grupo.set(nome, valores);
    }

    const somar = (...listas: number[][]) => meses.map((_, i) => listas.reduce((s, l) => s + l[i], 0));
    const negar = (l: number[]) => l.map((v) => -v);
    const receitaLiquida = somar(receitaBruta, negar(descontos), fretes);
    const lucroBruto = somar(receitaLiquida, negar(cmv));
    const totalDespesas = somar(zeros(), ...despesas.values());
    const totalOutras = somar(zeros(), ...outrasReceitas.values());
    const resultado = somar(lucroBruto, negar(totalDespesas), totalOutras);

    type Linha = { chave: string; rotulo: string; tipo: 'item' | 'subtotal' | 'total'; valores: number[] };
    const linhas: Linha[] = [
      { chave: 'receitaBruta', rotulo: 'Receita bruta de vendas', tipo: 'item', valores: receitaBruta },
      { chave: 'descontos', rotulo: '(−) Descontos concedidos', tipo: 'item', valores: negar(descontos) },
      { chave: 'fretes', rotulo: '(+) Fretes cobrados', tipo: 'item', valores: fretes },
      { chave: 'receitaLiquida', rotulo: '= Receita líquida', tipo: 'subtotal', valores: receitaLiquida },
      { chave: 'cmv', rotulo: '(−) Custo das mercadorias vendidas (CMV)', tipo: 'item', valores: negar(cmv) },
      { chave: 'lucroBruto', rotulo: '= Lucro bruto', tipo: 'subtotal', valores: lucroBruto },
      ...[...despesas.entries()].sort().map(([nome, v]) => ({ chave: `despesa:${nome}`, rotulo: `(−) ${nome}`, tipo: 'item' as const, valores: negar(v) })),
      { chave: 'despesas', rotulo: '= Total de despesas operacionais', tipo: 'subtotal', valores: negar(totalDespesas) },
      ...[...outrasReceitas.entries()].sort().map(([nome, v]) => ({ chave: `receita:${nome}`, rotulo: `(+) ${nome}`, tipo: 'item' as const, valores: v })),
      { chave: 'resultado', rotulo: '= Resultado do período', tipo: 'total', valores: resultado },
    ];

    return {
      de,
      ate,
      meses,
      linhas: linhas.map((l) => ({ ...l, valores: l.valores.map(centavos), total: centavos(l.valores.reduce((s, v) => s + v, 0)) })),
      indicadores: {
        receitaLiquida: centavos(receitaLiquida.reduce((s, v) => s + v, 0)),
        lucroBruto: centavos(lucroBruto.reduce((s, v) => s + v, 0)),
        resultado: centavos(resultado.reduce((s, v) => s + v, 0)),
        margemBruta: pct(lucroBruto.reduce((s, v) => s + v, 0), receitaLiquida.reduce((s, v) => s + v, 0)),
        margemLiquida: pct(resultado.reduce((s, v) => s + v, 0), receitaLiquida.reduce((s, v) => s + v, 0)),
      },
    };
  }
}
