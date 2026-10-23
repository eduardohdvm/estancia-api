'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { moeda, numero } from '@/lib/formato';
import type { Deposito, Paginado, Pedido, Pessoa, Produto } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { Alerta, AreaTexto, Botao, Campo, Cartao, Selecao } from './ui';

interface Item {
  produtoId: string;
  quantidade: string;
  precoUnitario: string;
  desconto: string;
}

const itemVazio: Item = { produtoId: '', quantidade: '1', precoUnitario: '', desconto: '0' };

/** Formulário de criação e edição de pedido de venda. */
export function FormularioPedido({ pedido, clienteInicial }: { pedido?: Pedido; clienteInicial?: string }) {
  const router = useRouter();
  const clientes = useDados<Paginado<Pessoa>>('/pessoas?papel=cliente&porPagina=200');
  const produtos = useDados<Paginado<Produto>>('/produtos?porPagina=200');
  const depositos = useDados<Deposito[]>('/estoque/depositos');

  const [clienteId, setClienteId] = useState(pedido?.clienteId ?? clienteInicial ?? '');
  const [depositoId, setDepositoId] = useState(pedido?.depositoId ?? '');
  const [itens, setItens] = useState<Item[]>(
    pedido?.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: String(Number(i.quantidade)),
      precoUnitario: String(Number(i.precoUnitario)),
      desconto: String(Number(i.desconto)),
    })) ?? [{ ...itemVazio }],
  );
  const [desconto, setDesconto] = useState(pedido ? String(Number(pedido.desconto)) : '0');
  const [frete, setFrete] = useState(pedido ? String(Number(pedido.frete)) : '0');
  const [parcelas, setParcelas] = useState(String(pedido?.parcelas ?? 1));
  const [observacoes, setObservacoes] = useState(pedido?.observacoes ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const listaProdutos = produtos.dados?.itens.filter((p) => p.ativo) ?? [];
  const produtoPorId = (id: string) => listaProdutos.find((p) => p.id === id);

  function mudarItem(i: number, mudanca: Partial<Item>) {
    setItens((atual) => atual.map((item, j) => (j === i ? { ...item, ...mudanca } : item)));
  }

  function escolherProduto(i: number, produtoId: string) {
    const produto = produtoPorId(produtoId);
    mudarItem(i, { produtoId, precoUnitario: produto ? String(Number(produto.precoVenda)) : '' });
  }

  const totalItem = (item: Item) => Math.max(0, Number(item.quantidade) * Number(item.precoUnitario) - Number(item.desconto));
  const subtotal = itens.reduce((s, i) => s + totalItem(i), 0);
  const total = subtotal - Number(desconto) + Number(frete);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const corpo = {
      clienteId,
      depositoId: depositoId || undefined,
      itens: itens
        .filter((i) => i.produtoId)
        .map((i) => ({
          produtoId: i.produtoId,
          quantidade: Number(i.quantidade),
          precoUnitario: Number(i.precoUnitario),
          desconto: Number(i.desconto),
        })),
      desconto: Number(desconto),
      frete: Number(frete),
      parcelas: Number(parcelas),
      observacoes: observacoes || undefined,
    };
    try {
      const salvo = await api<Pedido>(pedido ? `/pedidos/${pedido.id}` : '/pedidos', { metodo: pedido ? 'PUT' : 'POST', corpo });
      router.push(`/vendas/ver?id=${salvo.id}`);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6">
      <Cartao className="grid gap-4 p-5 sm:grid-cols-3">
        <Selecao rotulo="Cliente" required value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="sm:col-span-2">
          <option value="">Selecione o cliente...</option>
          {clientes.dados?.itens.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.documento ? ` — ${c.documento}` : ''}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Depósito de saída" value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
          <option value="">Depósito padrão</option>
          {depositos.dados?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>
      </Cartao>

      <Cartao className="p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Itens</h2>
        <div className="flex flex-col gap-3">
          {itens.map((item, i) => {
            const produto = produtoPorId(item.produtoId);
            return (
              <div key={i} className="grid items-end gap-3 border-b border-slate-100 pb-3 sm:grid-cols-12">
                <Selecao rotulo={i === 0 ? 'Produto' : undefined} value={item.produtoId} onChange={(e) => escolherProduto(i, e.target.value)} className="sm:col-span-4">
                  <option value="">Selecione...</option>
                  {listaProdutos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.nome}
                      {!p.servico ? ` (saldo ${numero(p.saldo)})` : ''}
                    </option>
                  ))}
                </Selecao>
                <Campo rotulo={i === 0 ? 'Qtd.' : undefined} type="number" step="0.001" min="0.001" value={item.quantidade} onChange={(e) => mudarItem(i, { quantidade: e.target.value })} className="sm:col-span-2" />
                <Campo rotulo={i === 0 ? 'Preço unit.' : undefined} type="number" step="0.01" min="0" value={item.precoUnitario} onChange={(e) => mudarItem(i, { precoUnitario: e.target.value })} className="sm:col-span-2" />
                <Campo rotulo={i === 0 ? 'Desconto' : undefined} type="number" step="0.01" min="0" value={item.desconto} onChange={(e) => mudarItem(i, { desconto: e.target.value })} className="sm:col-span-2" />
                <div className="flex items-center justify-between gap-2 sm:col-span-2 sm:justify-end">
                  <span className="py-2 text-sm font-medium tabular-nums text-slate-900">{moeda(totalItem(item))}</span>
                  <Botao variante="fantasma" onClick={() => setItens(itens.filter((_, j) => j !== i))} disabled={itens.length === 1} aria-label="Remover item">
                    <Trash2 className="size-4" />
                  </Botao>
                </div>
                {produto && !produto.servico && Number(item.quantidade) > produto.saldo && (
                  <p className="text-xs text-amber-600 sm:col-span-12">Atenção: a quantidade é maior que o saldo em estoque ({numero(produto.saldo)}).</p>
                )}
              </div>
            );
          })}
        </div>
        <Botao variante="secundario" className="mt-4" onClick={() => setItens([...itens, { ...itemVazio }])}>
          <Plus className="size-4" /> Adicionar item
        </Botao>
      </Cartao>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao className="p-5 lg:col-span-2">
          <AreaTexto rotulo="Observações" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Cartao>
        <Cartao className="flex flex-col gap-3 p-5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="tabular-nums">{moeda(subtotal)}</span>
          </div>
          <Campo rotulo="Desconto no pedido" type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
          <Campo rotulo="Frete" type="number" step="0.01" min="0" value={frete} onChange={(e) => setFrete(e.target.value)} />
          <Selecao rotulo="Parcelas" value={parcelas} onChange={(e) => setParcelas(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'À vista (1x)' : `${n}x de ${moeda(total / n)}`}
              </option>
            ))}
          </Selecao>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{moeda(total)}</span>
          </div>
        </Cartao>
      </div>

      <Alerta>{erro}</Alerta>
      <div className="flex justify-end gap-2">
        <Botao variante="secundario" onClick={() => router.back()}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando}>
          {pedido ? 'Salvar alterações' : 'Salvar orçamento'}
        </Botao>
      </div>
    </form>
  );
}
