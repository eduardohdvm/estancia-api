'use client';

import { FileSpreadsheet, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alerta, Botao, Campo, Cartao, Celula, Etiqueta, Indicador, Selecao, Tabela } from '@/components/ui';
import { qs } from '@/lib/api';
import { exportarExcel, exportarPdf, type DadosExportacao } from '@/lib/exportar';
import { data, hojeIso, moeda, numero } from '@/lib/formato';
import { useDados } from '@/lib/use-dados';

// ─────────── Tipos das respostas ───────────

interface PorPeriodo {
  agrupar: 'dia' | 'semana' | 'mes';
  itens: { periodo: string; pedidos: number; faturamento: number; custo: number; lucro: number; ticketMedio: number }[];
  totais: { pedidos: number; faturamento: number; custo: number; lucro: number; ticketMedio: number; margem: number };
}
interface LinhaProduto { produtoId: string; codigo: string; nome: string; unidade: string; categoria: string; quantidade: number; faturamento: number; custo: number; lucro: number; margem: number; participacao: number }
interface PorProduto { itens: LinhaProduto[]; totais: { produtos: number; quantidade: number; faturamento: number; custo: number; lucro: number; margem: number } }
interface PorVendedor {
  itens: { vendedorId: string | null; vendedor: string; pedidos: number; faturamento: number; lucro: number; ticketMedio: number; participacao: number }[];
  totais: { vendedores: number; pedidos: number; faturamento: number; lucro: number };
}
interface CurvaAbc extends PorProduto {
  itens: (LinhaProduto & { acumulado: number; classe: 'A' | 'B' | 'C' })[];
  classes: { classe: 'A' | 'B' | 'C'; produtos: number; percentualProdutos: number; faturamento: number; percentualFaturamento: number }[];
  semVenda: { produtoId: string; codigo: string; nome: string; saldo: number }[];
}
interface Dre {
  meses: string[];
  linhas: { chave: string; rotulo: string; tipo: 'item' | 'subtotal' | 'total'; valores: number[]; total: number }[];
  indicadores: { receitaLiquida: number; lucroBruto: number; resultado: number; margemBruta: number; margemLiquida: number };
}

// ─────────── Filtro de período ───────────

type Filtro = { de: string; ate: string; origem: '' | 'PEDIDO' | 'PDV' };

const primeiroDia = (mesesAtras: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  return hojeIso(-Math.round((Date.now() - d.getTime()) / 86_400_000));
};
const ultimoDiaMesPassado = () => {
  const d = new Date();
  d.setDate(0);
  return hojeIso(-Math.round((Date.now() - d.getTime()) / 86_400_000));
};

const atalhos: { rotulo: string; periodo: () => [string, string] }[] = [
  { rotulo: 'Este mês', periodo: () => [primeiroDia(0), hojeIso()] },
  { rotulo: 'Mês passado', periodo: () => [primeiroDia(1), ultimoDiaMesPassado()] },
  { rotulo: 'Últimos 3 meses', periodo: () => [primeiroDia(2), hojeIso()] },
  { rotulo: 'Últimos 6 meses', periodo: () => [primeiroDia(5), hojeIso()] },
  { rotulo: 'Este ano', periodo: () => [`${new Date().getFullYear()}-01-01`, hojeIso()] },
];

const abas = [
  { id: 'periodo', rotulo: 'Vendas por período' },
  { id: 'produto', rotulo: 'Vendas por produto' },
  { id: 'vendedor', rotulo: 'Vendas por vendedor' },
  { id: 'abc', rotulo: 'Curva ABC' },
  { id: 'dre', rotulo: 'DRE' },
] as const;
type Aba = (typeof abas)[number]['id'];

const rotuloMes = (mes: string) => new Date(`${mes}-15`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace('.', '');
const rotuloPeriodo = (p: string, agrupar: PorPeriodo['agrupar']) =>
  agrupar === 'mes' ? rotuloMes(p) : agrupar === 'semana' ? `Sem. ${data(`${p}T00:00:00Z`).slice(0, 5)}` : data(`${p}T00:00:00Z`).slice(0, 5);
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export default function Relatorios() {
  const [aba, setAba] = useState<Aba>('periodo');
  const [filtro, setFiltro] = useState<Filtro>({ de: primeiroDia(0), ate: hojeIso(), origem: '' });
  const subtitulo = `Período: ${data(`${filtro.de}T00:00:00Z`)} a ${data(`${filtro.ate}T00:00:00Z`)}${filtro.origem ? ` · ${filtro.origem === 'PDV' ? 'só PDV' : 'só pedidos'}` : ''}`;
  const params = { de: filtro.de, ate: filtro.ate, origem: filtro.origem || undefined };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Relatórios</h1>
        <p className="mt-1 text-sm text-slate-500">Vendas, margem, curva ABC e resultado do período</p>
      </div>

      <Cartao className="mb-4 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-2">
          {atalhos.map((a) => {
            const [de, ate] = a.periodo();
            const ativo = filtro.de === de && filtro.ate === ate;
            return (
              <button
                key={a.rotulo}
                onClick={() => setFiltro({ ...filtro, de, ate })}
                className={`rounded-full px-3 py-1 text-sm ${ativo ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {a.rotulo}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="De" type="date" value={filtro.de} max={filtro.ate} onChange={(e) => e.target.value && setFiltro({ ...filtro, de: e.target.value })} />
          <Campo rotulo="Até" type="date" value={filtro.ate} min={filtro.de} onChange={(e) => e.target.value && setFiltro({ ...filtro, ate: e.target.value })} />
          {aba !== 'dre' && (
            <Selecao rotulo="Origem" value={filtro.origem} onChange={(e) => setFiltro({ ...filtro, origem: e.target.value as Filtro['origem'] })}>
              <option value="">Todas as vendas</option>
              <option value="PEDIDO">Só pedidos</option>
              <option value="PDV">Só PDV</option>
            </Selecao>
          )}
        </div>
      </Cartao>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {abas.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${aba === a.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'periodo' && <RelatorioPeriodo params={params} subtitulo={subtitulo} />}
      {aba === 'produto' && <RelatorioProduto params={params} subtitulo={subtitulo} />}
      {aba === 'vendedor' && <RelatorioVendedor params={params} subtitulo={subtitulo} />}
      {aba === 'abc' && <RelatorioAbc params={params} subtitulo={subtitulo} />}
      {aba === 'dre' && <RelatorioDre params={{ de: filtro.de, ate: filtro.ate }} subtitulo={subtitulo.split(' · ')[0]} />}
    </>
  );
}

type Props = { params: Record<string, string | undefined>; subtitulo: string };

/** Botões de exportação; os dados só são montados no clique. */
function Exportar({ montar }: { montar: () => DadosExportacao | null }) {
  const [gerando, setGerando] = useState<'' | 'xlsx' | 'pdf'>('');
  async function exportar(tipo: 'xlsx' | 'pdf') {
    const dados = montar();
    if (!dados) return;
    setGerando(tipo);
    try {
      await (tipo === 'xlsx' ? exportarExcel(dados) : exportarPdf(dados));
    } catch (e) {
      alert(`Não foi possível gerar o arquivo: ${(e as Error).message}`);
    } finally {
      setGerando('');
    }
  }
  return (
    <div className="flex gap-2">
      <Botao variante="secundario" carregando={gerando === 'xlsx'} onClick={() => exportar('xlsx')}>
        <FileSpreadsheet className="size-4 text-emerald-600" /> Excel
      </Botao>
      <Botao variante="secundario" carregando={gerando === 'pdf'} onClick={() => exportar('pdf')}>
        <FileText className="size-4 text-rose-600" /> PDF
      </Botao>
    </div>
  );
}

function Topo({ titulo, montar }: { titulo: string; montar: () => DadosExportacao | null }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <Exportar montar={montar} />
    </div>
  );
}

/** Barras horizontais para "top N". */
function Ranking({ itens }: { itens: { rotulo: string; valor: number; detalhe?: string }[] }) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="flex flex-col gap-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="text-sm">
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate text-slate-700">{i.rotulo}</span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {moeda(i.valor)} {i.detalhe && <span className="text-xs text-slate-500">({i.detalhe})</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(i.valor / maior) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

// ─────────── Vendas por período ───────────

function RelatorioPeriodo({ params, subtitulo }: Props) {
  const [agrupar, setAgrupar] = useState<PorPeriodo['agrupar']>('dia');
  const { dados, erro, carregando } = useDados<PorPeriodo>(`/relatorios/vendas-periodo${qs({ ...params, agrupar })}`);
  const maior = Math.max(1, ...(dados?.itens.map((i) => i.faturamento) ?? []));

  const montar = () =>
    dados && {
      titulo: 'Vendas por período',
      subtitulo,
      nomeArquivo: `vendas-por-periodo-${params.de}-a-${params.ate}`,
      colunas: [{ titulo: 'Período' }, { titulo: 'Pedidos', tipo: 'numero' as const }, { titulo: 'Faturamento', tipo: 'moeda' as const }, { titulo: 'Custo', tipo: 'moeda' as const }, { titulo: 'Lucro bruto', tipo: 'moeda' as const }, { titulo: 'Ticket médio', tipo: 'moeda' as const }],
      linhas: dados.itens.map((l) => [rotuloPeriodo(l.periodo, dados.agrupar), l.pedidos, l.faturamento, l.custo, l.lucro, l.ticketMedio]),
      totais: ['Total', dados.totais.pedidos, dados.totais.faturamento, dados.totais.custo, dados.totais.lucro, dados.totais.ticketMedio],
    };

  return (
    <>
      <Topo titulo="Vendas por período" montar={montar} />
      <Alerta>{erro}</Alerta>
      {dados && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Faturamento" valor={moeda(dados.totais.faturamento)} detalhe={`${dados.totais.pedidos} pedido(s)`} />
            <Indicador rotulo="Ticket médio" valor={moeda(dados.totais.ticketMedio)} />
            <Indicador rotulo="Lucro bruto" valor={moeda(dados.totais.lucro)} detalhe="faturamento − frete − custo" tom="bom" />
            <Indicador rotulo="Margem bruta" valor={pct(dados.totais.margem)} />
          </div>
          <Cartao className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">Faturamento</h3>
              <Selecao value={agrupar} onChange={(e) => setAgrupar(e.target.value as PorPeriodo['agrupar'])} className="w-36">
                <option value="dia">Por dia</option>
                <option value="semana">Por semana</option>
                <option value="mes">Por mês</option>
              </Selecao>
            </div>
            <div className="mt-6 flex h-52 items-end gap-1 overflow-x-auto">
              {dados.itens.map((l) => (
                <div key={l.periodo} className="flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1" title={`${rotuloPeriodo(l.periodo, dados.agrupar)}: ${moeda(l.faturamento)}`}>
                  {dados.itens.length <= 16 && <span className="text-[10px] tabular-nums text-slate-500">{l.faturamento ? compacto.format(l.faturamento) : ''}</span>}
                  <div className="w-full max-w-10 rounded-t bg-indigo-500" style={{ height: `${Math.max(1, (l.faturamento / maior) * 85)}%` }} />
                  <span className="whitespace-nowrap text-[10px] text-slate-500">{rotuloPeriodo(l.periodo, dados.agrupar)}</span>
                </div>
              ))}
            </div>
          </Cartao>
        </div>
      )}
      <div className="mt-4">
        <Tabela cabecalhos={['Período', 'Pedidos', 'Faturamento', 'Custo', 'Lucro bruto', 'Ticket médio']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
          {dados?.itens.filter((l) => l.pedidos).map((l) => (
            <tr key={l.periodo}>
              <Celula>{rotuloPeriodo(l.periodo, dados.agrupar)}</Celula>
              <Celula className="tabular-nums">{l.pedidos}</Celula>
              <Celula className="tabular-nums">{moeda(l.faturamento)}</Celula>
              <Celula className="tabular-nums">{moeda(l.custo)}</Celula>
              <Celula className="tabular-nums text-emerald-700">{moeda(l.lucro)}</Celula>
              <Celula className="tabular-nums">{moeda(l.ticketMedio)}</Celula>
            </tr>
          ))}
        </Tabela>
      </div>
    </>
  );
}

// ─────────── Vendas por produto ───────────

function RelatorioProduto({ params, subtitulo }: Props) {
  const { dados, erro, carregando } = useDados<PorProduto>(`/relatorios/vendas-produto${qs(params)}`);
  const montar = () =>
    dados && {
      titulo: 'Vendas por produto',
      subtitulo,
      nomeArquivo: `vendas-por-produto-${params.de}-a-${params.ate}`,
      colunas: [{ titulo: 'Código' }, { titulo: 'Produto' }, { titulo: 'Categoria' }, { titulo: 'Quantidade', tipo: 'numero' as const }, { titulo: 'Faturamento', tipo: 'moeda' as const }, { titulo: 'Custo', tipo: 'moeda' as const }, { titulo: 'Lucro', tipo: 'moeda' as const }, { titulo: 'Margem', tipo: 'percentual' as const }, { titulo: 'Participação', tipo: 'percentual' as const }],
      linhas: dados.itens.map((l) => [l.codigo, l.nome, l.categoria, l.quantidade, l.faturamento, l.custo, l.lucro, l.margem, l.participacao]),
      totais: ['', 'Total', '', dados.totais.quantidade, dados.totais.faturamento, dados.totais.custo, dados.totais.lucro, dados.totais.margem, 100],
    };

  return (
    <>
      <Topo titulo="Vendas por produto" montar={montar} />
      <Alerta>{erro}</Alerta>
      {dados && (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3 xl:col-span-1 xl:grid-cols-1">
            <Indicador rotulo="Faturamento de produtos" valor={moeda(dados.totais.faturamento)} detalhe={`${dados.totais.produtos} produto(s) vendidos · sem frete`} />
            <Indicador rotulo="Lucro bruto" valor={moeda(dados.totais.lucro)} tom="bom" />
            <Indicador rotulo="Margem média" valor={pct(dados.totais.margem)} />
          </div>
          <Cartao className="p-5 lg:col-span-3 xl:col-span-2">
            <h3 className="mb-4 font-semibold text-slate-900">Os 10 que mais faturaram</h3>
            <Ranking itens={dados.itens.slice(0, 10).map((l) => ({ rotulo: l.nome, valor: l.faturamento, detalhe: `${numero(l.quantidade)} ${l.unidade}` }))} />
          </Cartao>
        </div>
      )}
      <Tabela cabecalhos={['Código', 'Produto', 'Qtd.', 'Faturamento', 'Custo', 'Lucro', 'Margem', 'Part.']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((l) => (
          <tr key={l.produtoId}>
            <Celula className="font-mono text-xs">{l.codigo}</Celula>
            <Celula>
              <p className="font-medium text-slate-900">{l.nome}</p>
              <p className="text-xs text-slate-500">{l.categoria}</p>
            </Celula>
            <Celula className="tabular-nums">
              {numero(l.quantidade)} {l.unidade}
            </Celula>
            <Celula className="tabular-nums">{moeda(l.faturamento)}</Celula>
            <Celula className="tabular-nums">{moeda(l.custo)}</Celula>
            <Celula className="tabular-nums text-emerald-700">{moeda(l.lucro)}</Celula>
            <Celula className={`tabular-nums ${l.margem < 20 ? 'text-rose-600' : ''}`}>{pct(l.margem)}</Celula>
            <Celula className="tabular-nums">{pct(l.participacao)}</Celula>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

// ─────────── Vendas por vendedor ───────────

function RelatorioVendedor({ params, subtitulo }: Props) {
  const { dados, erro, carregando } = useDados<PorVendedor>(`/relatorios/vendas-vendedor${qs(params)}`);
  const montar = () =>
    dados && {
      titulo: 'Vendas por vendedor',
      subtitulo,
      nomeArquivo: `vendas-por-vendedor-${params.de}-a-${params.ate}`,
      colunas: [{ titulo: 'Vendedor' }, { titulo: 'Pedidos', tipo: 'numero' as const }, { titulo: 'Faturamento', tipo: 'moeda' as const }, { titulo: 'Ticket médio', tipo: 'moeda' as const }, { titulo: 'Lucro bruto', tipo: 'moeda' as const }, { titulo: 'Participação', tipo: 'percentual' as const }],
      linhas: dados.itens.map((l) => [l.vendedor, l.pedidos, l.faturamento, l.ticketMedio, l.lucro, l.participacao]),
      totais: ['Total', dados.totais.pedidos, dados.totais.faturamento, dados.totais.pedidos ? dados.totais.faturamento / dados.totais.pedidos : 0, dados.totais.lucro, 100],
    };

  return (
    <>
      <Topo titulo="Vendas por vendedor" montar={montar} />
      <Alerta>{erro}</Alerta>
      {dados && dados.itens.length > 0 && (
        <Cartao className="mb-4 p-5">
          <Ranking itens={dados.itens.map((l) => ({ rotulo: l.vendedor, valor: l.faturamento, detalhe: pct(l.participacao) }))} />
        </Cartao>
      )}
      <Tabela cabecalhos={['Vendedor', 'Pedidos', 'Faturamento', 'Ticket médio', 'Lucro bruto', 'Participação']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((l) => (
          <tr key={l.vendedorId ?? 'sem'}>
            <Celula className="font-medium text-slate-900">{l.vendedor}</Celula>
            <Celula className="tabular-nums">{l.pedidos}</Celula>
            <Celula className="tabular-nums">{moeda(l.faturamento)}</Celula>
            <Celula className="tabular-nums">{moeda(l.ticketMedio)}</Celula>
            <Celula className="tabular-nums text-emerald-700">{moeda(l.lucro)}</Celula>
            <Celula className="tabular-nums">{pct(l.participacao)}</Celula>
          </tr>
        ))}
      </Tabela>
    </>
  );
}

// ─────────── Curva ABC ───────────

const tomClasse = { A: 'verde', B: 'amarelo', C: 'vermelho' } as const;
const explicacaoClasse = {
  A: 'Poucos produtos que trazem 80% do faturamento: nunca podem faltar.',
  B: 'Importância intermediária: os próximos 15% do faturamento.',
  C: 'Muitos produtos com pouco faturamento (últimos 5%): avalie reduzir estoque.',
};

function RelatorioAbc({ params, subtitulo }: Props) {
  const { dados, erro, carregando } = useDados<CurvaAbc>(`/relatorios/curva-abc${qs(params)}`);
  const montar = () =>
    dados && {
      titulo: 'Curva ABC de produtos',
      subtitulo,
      nomeArquivo: `curva-abc-${params.de}-a-${params.ate}`,
      colunas: [{ titulo: 'Classe' }, { titulo: 'Código' }, { titulo: 'Produto' }, { titulo: 'Quantidade', tipo: 'numero' as const }, { titulo: 'Faturamento', tipo: 'moeda' as const }, { titulo: 'Participação', tipo: 'percentual' as const }, { titulo: 'Acumulado', tipo: 'percentual' as const }],
      linhas: [
        ...dados.itens.map((l) => [l.classe, l.codigo, l.nome, l.quantidade, l.faturamento, l.participacao, l.acumulado]),
        ...dados.semVenda.map((p) => ['Sem venda', p.codigo, p.nome, 0, 0, 0, null]),
      ],
      totais: ['', '', 'Total', dados.totais.quantidade, dados.totais.faturamento, 100, null],
    };

  return (
    <>
      <Topo titulo="Curva ABC de produtos" montar={montar} />
      <Alerta>{erro}</Alerta>
      {dados && (
        <div className="mb-4 grid gap-4 md:grid-cols-3">
          {dados.classes.map((c) => (
            <Cartao key={c.classe} className="p-5">
              <div className="flex items-center gap-2">
                <Etiqueta tom={tomClasse[c.classe]}>Classe {c.classe}</Etiqueta>
                <span className="text-sm text-slate-500">{c.produtos} produto(s) · {pct(c.percentualProdutos)} do mix</span>
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{pct(c.percentualFaturamento)}</p>
              <p className="text-xs text-slate-500">do faturamento ({moeda(c.faturamento)})</p>
              <p className="mt-2 text-xs text-slate-500">{explicacaoClasse[c.classe]}</p>
            </Cartao>
          ))}
        </div>
      )}
      <Tabela cabecalhos={['Classe', 'Código', 'Produto', 'Qtd.', 'Faturamento', 'Part.', 'Acumulado']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((l) => (
          <tr key={l.produtoId}>
            <Celula>
              <Etiqueta tom={tomClasse[l.classe]}>{l.classe}</Etiqueta>
            </Celula>
            <Celula className="font-mono text-xs">{l.codigo}</Celula>
            <Celula className="font-medium text-slate-900">{l.nome}</Celula>
            <Celula className="tabular-nums">{numero(l.quantidade)}</Celula>
            <Celula className="tabular-nums">{moeda(l.faturamento)}</Celula>
            <Celula className="tabular-nums">{pct(l.participacao)}</Celula>
            <Celula>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${l.acumulado}%` }} />
                </div>
                <span className="tabular-nums text-xs text-slate-500">{pct(l.acumulado)}</span>
              </div>
            </Celula>
          </tr>
        ))}
      </Tabela>
      {dados && dados.semVenda.length > 0 && (
        <Cartao className="mt-4 p-5">
          <h3 className="font-semibold text-slate-900">Produtos sem venda no período ({dados.semVenda.length})</h3>
          <p className="text-sm text-slate-500">Estoque parado: considere promoção ou parar de comprar.</p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {dados.semVenda.map((p) => (
              <li key={p.produtoId} className="flex justify-between gap-2">
                <span className="truncate text-slate-700">
                  <span className="font-mono text-xs text-slate-500">{p.codigo}</span> {p.nome}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">saldo {numero(p.saldo)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </>
  );
}

// ─────────── DRE ───────────

function RelatorioDre({ params, subtitulo }: Props) {
  const { dados, erro, carregando } = useDados<Dre>(`/relatorios/dre${qs(params)}`);
  const destaques = useMemo(() => dados?.linhas.map((l, i) => (l.tipo !== 'item' ? i : -1)).filter((i) => i >= 0) ?? [], [dados]);
  const montar = () =>
    dados && {
      titulo: 'DRE gerencial',
      subtitulo: `${subtitulo} · regime de competência`,
      nomeArquivo: `dre-${params.de}-a-${params.ate}`,
      colunas: [{ titulo: 'Conta' }, ...dados.meses.map((m) => ({ titulo: rotuloMes(m), tipo: 'moeda' as const })), { titulo: 'Total', tipo: 'moeda' as const }],
      linhas: dados.linhas.map((l) => [l.rotulo, ...l.valores, l.total]),
      destaques,
    };

  return (
    <>
      <Topo titulo="DRE gerencial" montar={montar} />
      <Alerta>{erro}</Alerta>
      {dados && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador rotulo="Receita líquida" valor={moeda(dados.indicadores.receitaLiquida)} />
          <Indicador rotulo="Lucro bruto" valor={moeda(dados.indicadores.lucroBruto)} detalhe={`margem bruta ${pct(dados.indicadores.margemBruta)}`} />
          <Indicador
            rotulo={dados.indicadores.resultado >= 0 ? 'Lucro do período' : 'Prejuízo do período'}
            valor={moeda(dados.indicadores.resultado)}
            tom={dados.indicadores.resultado >= 0 ? 'bom' : 'ruim'}
          />
          <Indicador rotulo="Margem líquida" valor={pct(dados.indicadores.margemLiquida)} tom={dados.indicadores.margemLiquida >= 0 ? 'bom' : 'ruim'} />
        </div>
      )}
      <Tabela cabecalhos={['Conta', ...(dados?.meses.map(rotuloMes) ?? []), 'Total']} carregando={carregando && !dados}>
        {dados?.linhas.map((l) => (
          <tr key={l.chave} className={l.tipo === 'total' ? 'bg-slate-900 text-white' : l.tipo === 'subtotal' ? 'bg-slate-50' : ''}>
            <Celula className={`${l.tipo !== 'item' ? 'font-semibold' : 'pl-8'} ${l.tipo === 'total' ? 'text-white' : ''}`}>{l.rotulo}</Celula>
            {[...l.valores, l.total].map((v, i) => (
              <Celula key={i} className={`text-right tabular-nums ${l.tipo !== 'item' ? 'font-semibold' : ''} ${l.tipo === 'total' ? (v < 0 ? 'text-rose-300' : 'text-emerald-300') : v < 0 ? 'text-rose-600' : ''}`}>
                {v ? moeda(v) : '—'}
              </Celula>
            ))}
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 text-xs text-slate-500">
        Regime de competência: vendas pela data de faturamento, despesas e outras receitas pela data de vencimento. Compras de mercadoria não aparecem como despesa;
        o custo delas entra no CMV quando o produto é vendido.
      </p>
    </>
  );
}
