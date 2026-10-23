'use client';

import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { moeda, numero } from '@/lib/formato';
import type { Compra, Deposito, Paginado, Pessoa, Produto, SugestaoCompra } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { Alerta, AreaTexto, Botao, Campo, Cartao, Selecao } from './ui';

interface Item {
  produtoId: string;
  quantidade: string;
  custoUnitario: string;
}

const itemVazio: Item = { produtoId: '', quantidade: '1', custoUnitario: '' };

/** Formulário de criação e edição de pedido de compra. */
export function FormularioCompra({ compra }: { compra?: Compra }) {
  const router = useRouter();
  const fornecedores = useDados<Paginado<Pessoa>>('/pessoas?papel=fornecedor&porPagina=200');
  const produtos = useDados<Paginado<Produto>>('/produtos?porPagina=200');
  const depositos = useDados<Deposito[]>('/estoque/depositos');

  const [fornecedorId, setFornecedorId] = useState(compra?.fornecedorId ?? '');
  const [depositoId, setDepositoId] = useState(compra?.depositoId ?? '');
  const [itens, setItens] = useState<Item[]>(
    compra?.itens.map((i) => ({ produtoId: i.produtoId, quantidade: String(Number(i.quantidade)), custoUnitario: String(Number(i.custoUnitario)) })) ?? [
      { ...itemVazio },
    ],
  );
  const [desconto, setDesconto] = useState(compra ? String(Number(compra.desconto)) : '0');
  const [frete, setFrete] = useState(compra ? String(Number(compra.frete)) : '0');
  const [parcelas, setParcelas] = useState(String(compra?.parcelas ?? 1));
  const [previsaoEntrega, setPrevisaoEntrega] = useState(compra?.previsaoEntrega?.slice(0, 10) ?? '');
  const [observacoes, setObservacoes] = useState(compra?.observacoes ?? '');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const listaProdutos = produtos.dados?.itens.filter((p) => p.ativo) ?? [];
  const produtoPorId = (id: string) => listaProdutos.find((p) => p.id === id);

  const mudarItem = (i: number, mudanca: Partial<Item>) => setItens((atual) => atual.map((item, j) => (j === i ? { ...item, ...mudanca } : item)));

  function escolherProduto(i: number, produtoId: string) {
    const produto = produtoPorId(produtoId);
    mudarItem(i, { produtoId, custoUnitario: produto ? String(Number(produto.precoCusto)) : '' });
  }

  /** Traz os produtos abaixo do estoque mínimo com a quantidade sugerida. */
  async function carregarSugestao() {
    const sugestao = await api<SugestaoCompra[]>('/compras/sugestao');
    if (!sugestao.length) {
      setAviso('Nenhum produto abaixo do estoque mínimo (já descontando o que está pedido).');
      return;
    }
    const jaNaLista = new Set(itens.map((i) => i.produtoId));
    const novos = sugestao
      .filter((s) => !jaNaLista.has(s.produtoId))
      .map((s) => ({ produtoId: s.produtoId, quantidade: String(s.sugerido), custoUnitario: String(s.custoUnitario) }));
    setItens([...itens.filter((i) => i.produtoId), ...novos]);
    setAviso(`${novos.length} produto(s) adicionados pela sugestão de compra.`);
  }

  const totalItem = (item: Item) => Number(item.quantidade) * Number(item.custoUnitario);
  const subtotal = itens.reduce((s, i) => s + totalItem(i), 0);
  const total = subtotal - Number(desconto) + Number(frete);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    const corpo = {
      fornecedorId,
      depositoId: depositoId || undefined,
      itens: itens
        .filter((i) => i.produtoId)
        .map((i) => ({ produtoId: i.produtoId, quantidade: Number(i.quantidade), custoUnitario: Number(i.custoUnitario) })),
      desconto: Number(desconto),
      frete: Number(frete),
      parcelas: Number(parcelas),
      previsaoEntrega: previsaoEntrega || undefined,
      observacoes: observacoes || undefined,
    };
    try {
      const salva = await api<Compra>(compra ? `/compras/${compra.id}` : '/compras', { metodo: compra ? 'PUT' : 'POST', corpo });
      router.push(`/compras/${salva.id}`);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-6">
      <Cartao className="grid gap-4 p-5 sm:grid-cols-3">
        <Selecao rotulo="Fornecedor" required value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
          <option value="">Selecione o fornecedor...</option>
          {fornecedores.dados?.itens.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Depósito de entrada" value={depositoId} onChange={(e) => setDepositoId(e.target.value)}>
          <option value="">Depósito padrão</option>
          {depositos.dados?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
            </option>
          ))}
        </Selecao>
        <Campo rotulo="Previsão de entrega" type="date" value={previsaoEntrega} onChange={(e) => setPrevisaoEntrega(e.target.value)} />
      </Cartao>

      <Cartao className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Itens</h2>
          <Botao variante="secundario" onClick={carregarSugestao}>
            <Lightbulb className="size-4" /> Sugestão de compra
          </Botao>
        </div>
        {aviso && <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-700">{aviso}</p>}
        <div className="flex flex-col gap-3">
          {itens.map((item, i) => {
            const produto = produtoPorId(item.produtoId);
            return (
              <div key={i} className="grid items-end gap-3 border-b border-slate-100 pb-3 sm:grid-cols-12">
                <Selecao rotulo={i === 0 ? 'Produto' : undefined} value={item.produtoId} onChange={(e) => escolherProduto(i, e.target.value)} className="sm:col-span-5">
                  <option value="">Selecione...</option>
                  {listaProdutos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.nome}
                    </option>
                  ))}
                </Selecao>
                <Campo rotulo={i === 0 ? 'Quantidade' : undefined} type="number" step="0.001" min="0.001" value={item.quantidade} onChange={(e) => mudarItem(i, { quantidade: e.target.value })} className="sm:col-span-2" />
                <Campo rotulo={i === 0 ? 'Custo unitário' : undefined} type="number" step="0.01" min="0" value={item.custoUnitario} onChange={(e) => mudarItem(i, { custoUnitario: e.target.value })} className="sm:col-span-2" />
                <div className="flex items-center justify-between gap-2 sm:col-span-3 sm:justify-end">
                  <span className="py-2 text-sm font-medium tabular-nums text-slate-900">{moeda(totalItem(item))}</span>
                  <Botao variante="fantasma" onClick={() => setItens(itens.filter((_, j) => j !== i))} disabled={itens.length === 1} aria-label="Remover item">
                    <Trash2 className="size-4" />
                  </Botao>
                </div>
                {produto && !produto.servico && (
                  <p className="text-xs text-slate-500 sm:col-span-12">
                    Saldo atual: {numero(produto.saldo)} {produto.unidade} · mínimo {numero(produto.estoqueMinimo)}
                  </p>
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
          <Campo rotulo="Desconto" type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
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
          {compra ? 'Salvar alterações' : 'Salvar pedido'}
        </Botao>
      </div>
    </form>
  );
}
