'use client';

import { ArrowDownToLine, ArrowUpFromLine, Banknote, CheckCircle2, ListOrdered, Loader2, Lock, Minus, Plus, ScanBarcode, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ResumoCaixa } from '@/components/resumo-caixa';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Campo, Cartao, Celula, Modal, Selecao, Status, Tabela } from '@/components/ui';
import { api, ErroApi, qs } from '@/lib/api';
import { dataHora, moeda, numero, rotuloForma } from '@/lib/formato';
import type { CaixaDetalhado, FormaPagamento, Paginado, Pessoa, Produto } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

interface ItemCarrinho {
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  servico: boolean;
  saldo: number;
  precoUnitario: number;
  quantidade: number;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

export default function PaginaPdv() {
  const { dados: caixa, carregando, recarregar } = useDados<CaixaDetalhado | null>('/pdv/caixa');

  if (carregando && caixa === null) {
    return (
      <div className="flex justify-center p-16 text-slate-400">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  return caixa ? <TelaVenda caixa={caixa} recarregar={recarregar} /> : <AbrirCaixa aoAbrir={recarregar} />;
}

// ─────────── Abertura ───────────

function AbrirCaixa({ aoAbrir }: { aoAbrir: () => Promise<void> }) {
  const [valor, setValor] = useState('0');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api('/pdv/caixa/abrir', { metodo: 'POST', corpo: { valorAbertura: Number(valor) } });
      await aoAbrir();
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <Cartao className="p-6">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
          <Lock className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Caixa fechado</h1>
        <p className="mt-1 text-sm text-slate-500">Informe quanto há em dinheiro na gaveta para começar a vender.</p>
        <form onSubmit={abrir} className="mt-5 flex flex-col gap-4">
          <Campo rotulo="Troco inicial (R$)" type="number" step="0.01" min="0" required autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
          <Alerta>{erro}</Alerta>
          <Botao type="submit" carregando={enviando}>
            Abrir caixa
          </Botao>
        </form>
      </Cartao>
    </div>
  );
}

// ─────────── Venda ───────────

function TelaVenda({ caixa, recarregar }: { caixa: CaixaDetalhado; recarregar: () => Promise<void> }) {
  const clientes = useDados<Paginado<Pessoa>>('/pessoas?papel=cliente&porPagina=200');
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [desconto, setDesconto] = useState('0');
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState<'pagamento' | 'movimento' | 'vendas' | 'fechar' | null>(null);
  const [tipoMovimento, setTipoMovimento] = useState<'SUPRIMENTO' | 'SANGRIA'>('SANGRIA');
  const [concluida, setConcluida] = useState<{ numero: number; total: number; troco: number } | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const subtotal = centavos(itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0));
  const total = Math.max(0, centavos(subtotal - Number(desconto || 0)));

  const focarBusca = () => setTimeout(() => buscaRef.current?.focus(), 0);

  const adicionar = useCallback((p: Produto | (Omit<Produto, 'estoques' | 'categoria' | 'estoqueBaixo'> & { saldo: number }), quantidade = 1) => {
    setItens((atual) => {
      const existente = atual.find((i) => i.produtoId === p.id);
      if (existente) return atual.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + quantidade } : i));
      return [
        ...atual,
        {
          produtoId: p.id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade,
          servico: p.servico,
          saldo: p.saldo,
          precoUnitario: Number(p.precoVenda),
          quantidade,
        },
      ];
    });
    setBusca('');
    setSugestoes([]);
    setAviso('');
    focarBusca();
  }, []);

  // Sugestões enquanto digita o nome.
  useEffect(() => {
    const texto = busca.replace(/^\d+(?:[.,]\d+)?\*/, '').trim();
    if (texto.length < 2 || /^\d+$/.test(texto)) {
      setSugestoes([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<Paginado<Produto>>(`/produtos${qs({ busca: texto, porPagina: 8 })}`).catch(() => null);
      setSugestoes(r?.itens.filter((p) => p.ativo) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  /** Enter na busca: aceita "3*789123" (quantidade × código), código, código de barras ou nome. */
  async function buscarEnter(e: React.FormEvent) {
    e.preventDefault();
    const m = busca.trim().match(/^(\d+(?:[.,]\d+)?)\*(.+)$/);
    const quantidade = m ? Number(m[1].replace(',', '.')) : 1;
    const codigo = (m ? m[2] : busca).trim();
    if (!codigo) return;
    try {
      adicionar(await api(`/pdv/produto/${encodeURIComponent(codigo)}`), quantidade);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 404 && sugestoes.length === 1) adicionar(sugestoes[0], quantidade);
      else setAviso(erro instanceof ErroApi && erro.status === 404 ? `Produto "${codigo}" não encontrado` : (erro as Error).message);
    }
  }

  const mudarQuantidade = (produtoId: string, quantidade: number) =>
    setItens((atual) => atual.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: Math.max(0.001, quantidade) } : i)));

  function novaVenda() {
    setItens([]);
    setClienteId('');
    setDesconto('0');
    setConcluida(null);
    focarBusca();
  }

  // Atalhos: F2 abre o pagamento, Esc limpa a busca.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'F2' && itens.length && !modal && !concluida) {
        e.preventDefault();
        setModal('pagamento');
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [itens.length, modal, concluida]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Frente de caixa</h1>
          <p className="text-sm text-slate-500">
            Caixa nº {caixa.numero} · {caixa.usuario.nome} · aberto em {dataHora(caixa.abertoEm)} · {caixa.resumo.quantidadeVendas} venda(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={() => (setTipoMovimento('SUPRIMENTO'), setModal('movimento'))}>
            <ArrowDownToLine className="size-4" /> Suprimento
          </Botao>
          <Botao variante="secundario" onClick={() => (setTipoMovimento('SANGRIA'), setModal('movimento'))}>
            <ArrowUpFromLine className="size-4" /> Sangria
          </Botao>
          <Botao variante="secundario" onClick={() => setModal('vendas')}>
            <ListOrdered className="size-4" /> Vendas do caixa
          </Botao>
          <Botao variante="perigo" onClick={() => setModal('fechar')}>
            <Lock className="size-4" /> Fechar caixa
          </Botao>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Cartao className="relative p-4">
            <form onSubmit={buscarEnter} className="relative">
              <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={buscaRef}
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setBusca(''), setSugestoes([]))}
                placeholder="Código de barras, código ou nome do produto  (ex.: 3*789123 para 3 unidades)"
                className="w-full rounded-lg border border-slate-300 py-3 pl-11 pr-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </form>
            {sugestoes.length > 0 && (
              <ul className="absolute inset-x-4 top-full z-20 -mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {sugestoes.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => adicionar(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-indigo-50">
                      <span className="w-16 font-mono text-xs text-slate-500">{p.codigo}</span>
                      <span className="flex-1 text-slate-900">{p.nome}</span>
                      {!p.servico && <span className="text-xs text-slate-500">saldo {numero(p.saldo)}</span>}
                      <span className="w-24 text-right font-medium tabular-nums">{moeda(p.precoVenda)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {aviso && <p className="mt-2 text-sm text-rose-600">{aviso}</p>}
          </Cartao>

          <Cartao className="min-h-80 overflow-hidden">
            {itens.length === 0 ? (
              <div className="flex h-80 flex-col items-center justify-center gap-2 text-slate-400">
                <ScanBarcode className="size-10" />
                <p className="text-sm">Leia o código de barras ou busque um produto para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Produto</th>
                      <th className="px-4 py-3 font-medium">Qtd.</th>
                      <th className="px-4 py-3 text-right font-medium">Unitário</th>
                      <th className="px-4 py-3 text-right font-medium">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itens.map((i) => (
                      <tr key={i.produtoId}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-900">{i.nome}</p>
                          <p className="font-mono text-xs text-slate-500">{i.codigo}</p>
                          {!i.servico && i.quantidade > i.saldo && <p className="text-xs text-amber-600">Saldo em estoque: {numero(i.saldo)}</p>}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => mudarQuantidade(i.produtoId, i.quantidade - 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Diminuir">
                              <Minus className="size-4" />
                            </button>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={i.quantidade}
                              onChange={(e) => mudarQuantidade(i.produtoId, Number(e.target.value))}
                              className="w-16 rounded border border-slate-300 px-1 py-1 text-center tabular-nums"
                            />
                            <button type="button" onClick={() => mudarQuantidade(i.produtoId, i.quantidade + 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Aumentar">
                              <Plus className="size-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{moeda(i.precoUnitario)}</td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">{moeda(i.quantidade * i.precoUnitario)}</td>
                        <td className="px-2 py-2">
                          <Botao variante="fantasma" onClick={() => setItens(itens.filter((x) => x.produtoId !== i.produtoId))} aria-label="Remover item">
                            <Trash2 className="size-4" />
                          </Botao>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Cartao>
        </div>

        <Cartao className="flex h-fit flex-col gap-4 p-5 lg:sticky lg:top-6">
          <Selecao rotulo="Cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Consumidor final</option>
            {clientes.dados?.itens
              .filter((c) => c.nome !== 'Consumidor final')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.documento ? ` — ${c.documento}` : ''}
                </option>
              ))}
          </Selecao>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal ({itens.length} item(ns))</span>
            <span className="tabular-nums">{moeda(subtotal)}</span>
          </div>
          <Campo rotulo="Desconto (R$)" type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <p className="text-sm text-slate-400">Total a pagar</p>
            <p className="text-4xl font-semibold tabular-nums">{moeda(total)}</p>
          </div>
          <Botao className="py-3 text-base" disabled={!itens.length} onClick={() => setModal('pagamento')}>
            <Banknote className="size-5" /> Pagamento (F2)
          </Botao>
          {itens.length > 0 && (
            <Botao variante="fantasma" onClick={() => confirm('Descartar esta venda?') && novaVenda()}>
              Descartar venda
            </Botao>
          )}
        </Cartao>
      </div>

      {modal === 'pagamento' && (
        <ModalPagamento
          total={total}
          temCliente={!!clienteId}
          aoFechar={() => (setModal(null), focarBusca())}
          aoConfirmar={async (pagamentos) => {
            const r = await api<{ numero: number; total: number; troco: number }>('/pdv/vendas', {
              metodo: 'POST',
              corpo: {
                clienteId: clienteId || undefined,
                desconto: Number(desconto || 0),
                itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.precoUnitario })),
                pagamentos,
              },
            });
            setModal(null);
            setConcluida(r);
            void recarregar();
          }}
        />
      )}
      {concluida && <ModalConcluida venda={concluida} aoContinuar={novaVenda} />}
      {modal === 'movimento' && <ModalMovimento tipo={tipoMovimento} aoFechar={() => setModal(null)} aoSalvar={() => (setModal(null), recarregar())} />}
      {modal === 'vendas' && <ModalVendas caixa={caixa} aoFechar={() => setModal(null)} aoMudar={recarregar} />}
      {modal === 'fechar' && <ModalFechar caixa={caixa} aoFechar={() => setModal(null)} aoFecharCaixa={recarregar} />}
    </>
  );
}

// ─────────── Pagamento ───────────

const formas: FormaPagamento[] = ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'CREDIARIO'];

function ModalPagamento({
  total,
  temCliente,
  aoFechar,
  aoConfirmar,
}: {
  total: number;
  temCliente: boolean;
  aoFechar: () => void;
  aoConfirmar: (pagamentos: { forma: FormaPagamento; valor: number }[]) => Promise<void>;
}) {
  const [pagamentos, setPagamentos] = useState<{ forma: FormaPagamento; valor: number }[]>([]);
  const pago = centavos(pagamentos.reduce((s, p) => s + p.valor, 0));
  const restante = centavos(Math.max(0, total - pago));
  const troco = centavos(Math.max(0, pago - total));
  const [forma, setForma] = useState<FormaPagamento>('DINHEIRO');
  const [valor, setValor] = useState(total.toFixed(2));
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valorRef = useRef<HTMLInputElement>(null);

  function adicionar(e?: React.FormEvent) {
    e?.preventDefault();
    const v = centavos(Number(valor));
    if (!(v > 0)) return;
    if (forma !== 'DINHEIRO' && v > restante) {
      setErro('Só pagamentos em dinheiro podem passar do total (troco)');
      return;
    }
    if (forma === 'CREDIARIO' && !temCliente) {
      setErro('Para vender no crediário, escolha o cliente antes');
      return;
    }
    setErro('');
    const novos = [...pagamentos, { forma, valor: v }];
    setPagamentos(novos);
    setValor(Math.max(0, total - novos.reduce((s, p) => s + p.valor, 0)).toFixed(2));
  }

  async function confirmar() {
    setEnviando(true);
    try {
      await aoConfirmar(pagamentos);
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Pagamento" aberto aoFechar={aoFechar} largura="max-w-xl">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Resumo rotulo="Total" valor={moeda(total)} />
        <Resumo rotulo="Pago" valor={moeda(pago)} />
        {troco > 0 ? <Resumo rotulo="Troco" valor={moeda(troco)} destaque="text-emerald-600" /> : <Resumo rotulo="Falta" valor={moeda(restante)} destaque={restante ? 'text-rose-600' : 'text-emerald-600'} />}
      </div>

      {restante > 0 && (
        <form onSubmit={adicionar} className="mt-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {formas.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => (setForma(f), valorRef.current?.focus())}
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${forma === f ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                {rotuloForma[f]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={valorRef}
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-lg tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              aria-label="Valor recebido"
            />
            <Botao type="submit">Adicionar</Botao>
          </div>
        </form>
      )}

      {pagamentos.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {pagamentos.map((p, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2">
              <span>{rotuloForma[p.forma]}</span>
              <span className="flex items-center gap-2 tabular-nums">
                {moeda(p.valor)}
                <button onClick={() => setPagamentos(pagamentos.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600" aria-label="Remover pagamento">
                  <Trash2 className="size-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Alerta>{erro}</Alerta>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>
          Voltar
        </Botao>
        <Botao disabled={restante > 0 || !pagamentos.length} carregando={enviando} onClick={confirmar} autoFocus={restante === 0}>
          <CheckCircle2 className="size-4" /> Finalizar venda
        </Botao>
      </div>
    </Modal>
  );
}

function Resumo({ rotulo, valor, destaque = 'text-slate-900' }: { rotulo: string; valor: string; destaque?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className={`text-lg font-semibold tabular-nums ${destaque}`}>{valor}</p>
    </div>
  );
}

function ModalConcluida({ venda, aoContinuar }: { venda: { numero: number; total: number; troco: number }; aoContinuar: () => void }) {
  return (
    <Modal titulo="Venda concluída" aberto aoFechar={aoContinuar} largura="max-w-sm">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
        <p className="mt-2 text-slate-600">Venda nº {venda.numero} — {moeda(venda.total)}</p>
        {venda.troco > 0 && (
          <div className="mt-4 rounded-xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">Troco</p>
            <p className="text-3xl font-semibold tabular-nums text-emerald-700">{moeda(venda.troco)}</p>
          </div>
        )}
        <Botao className="mt-6 w-full" onClick={aoContinuar} autoFocus>
          Nova venda
        </Botao>
      </div>
    </Modal>
  );
}

// ─────────── Sangria / suprimento ───────────

function ModalMovimento({ tipo, aoFechar, aoSalvar }: { tipo: 'SUPRIMENTO' | 'SANGRIA'; aoFechar: () => void; aoSalvar: () => void }) {
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api('/pdv/caixa/movimentos', { metodo: 'POST', corpo: { tipo, valor: Number(valor), motivo: motivo || undefined } });
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={tipo === 'SANGRIA' ? 'Sangria (retirar dinheiro)' : 'Suprimento (colocar dinheiro)'} aberto aoFechar={aoFechar} largura="max-w-sm">
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Campo rotulo="Valor (R$)" type="number" step="0.01" min="0.01" required autoFocus value={valor} onChange={(e) => setValor(e.target.value)} />
        <Campo rotulo="Motivo" placeholder={tipo === 'SANGRIA' ? 'Ex.: levado ao cofre' : 'Ex.: troco extra'} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Registrar" />
      </form>
    </Modal>
  );
}

// ─────────── Vendas do caixa ───────────

function ModalVendas({ caixa, aoFechar, aoMudar }: { caixa: CaixaDetalhado; aoFechar: () => void; aoMudar: () => Promise<void> }) {
  const [erro, setErro] = useState('');

  async function cancelar(id: string, numero: number) {
    if (!confirm(`Cancelar a venda nº ${numero}? O estoque volta e os valores saem do caixa.`)) return;
    try {
      await api(`/pdv/vendas/${id}/cancelar`, { metodo: 'POST' });
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <Modal titulo={`Vendas do caixa nº ${caixa.numero}`} aberto aoFechar={aoFechar} largura="max-w-3xl">
      <Alerta>{erro}</Alerta>
      <Tabela cabecalhos={['Nº', 'Hora', 'Cliente', 'Pagamento', 'Total', 'Status', '']} vazio={caixa.vendas.length === 0}>
        {caixa.vendas.map((v) => (
          <tr key={v.id}>
            <Celula className="font-medium">#{v.numero}</Celula>
            <Celula className="text-slate-500">{new Date(v.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</Celula>
            <Celula>{v.cliente.nome}</Celula>
            <Celula className="text-xs">{v.pagamentos.map((p) => rotuloForma[p.forma]).join(' + ')}</Celula>
            <Celula className="tabular-nums">{moeda(v.total)}</Celula>
            <Celula>
              <Status valor={v.status} />
            </Celula>
            <Celula className="text-right">
              {v.status !== 'CANCELADO' && (
                <Botao variante="fantasma" onClick={() => cancelar(v.id, v.numero)}>
                  Cancelar
                </Botao>
              )}
            </Celula>
          </tr>
        ))}
      </Tabela>
    </Modal>
  );
}

// ─────────── Fechamento ───────────

function ModalFechar({ caixa, aoFechar, aoFecharCaixa }: { caixa: CaixaDetalhado; aoFechar: () => void; aoFecharCaixa: () => Promise<void> }) {
  const [contado, setContado] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [fechado, setFechado] = useState<CaixaDetalhado | null>(null);

  async function fechar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      setFechado(await api<CaixaDetalhado>('/pdv/caixa/fechar', { metodo: 'POST', corpo: { valorFechamento: Number(contado), observacoes: observacoes || undefined } }));
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (fechado) {
    return (
      <Modal titulo={`Caixa nº ${fechado.numero} fechado`} aberto aoFechar={aoFecharCaixa}>
        <ResumoCaixa caixa={fechado} />
        <div className="mt-6 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => window.print()}>
            Imprimir
          </Botao>
          <Botao onClick={aoFecharCaixa}>Concluir</Botao>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Fechar caixa nº ${caixa.numero}`} aberto aoFechar={aoFechar}>
      <ResumoCaixa caixa={caixa} />
      <form onSubmit={fechar} className="mt-5 flex flex-col gap-4 border-t border-slate-200 pt-5">
        <Campo rotulo="Dinheiro contado na gaveta (R$)" type="number" step="0.01" min="0" required autoFocus value={contado} onChange={(e) => setContado(e.target.value)} />
        <AreaTexto rotulo="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Fechar caixa" />
      </form>
    </Modal>
  );
}
