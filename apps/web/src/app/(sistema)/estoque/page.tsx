'use client';

import { Plus, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AcoesFormulario, Alerta, Botao, Busca, Cabecalho, Caixa, Campo, Celula, Etiqueta, Modal, Paginacao, Selecao, Status, Tabela } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { dataHora, numero } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { Deposito, MovimentoEstoque, Paginado, Produto, TipoMovimento } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function PaginaEstoque() {
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useDados<Paginado<MovimentoEstoque>>(`/estoque/movimentos${qs({ busca, tipo, pagina })}`);
  const depositos = useDados<Deposito[]>('/estoque/depositos');
  const [movimentoAberto, setMovimentoAberto] = useState(false);
  const [depositosAberto, setDepositosAberto] = useState(false);

  return (
    <>
      <Cabecalho titulo="Estoque" descricao="Entradas, saídas e ajustes de inventário">
        {pode('GERENTE') && (
          <Botao variante="secundario" onClick={() => setDepositosAberto(true)}>
            <Warehouse className="size-4" /> Depósitos
          </Botao>
        )}
        {pode('GERENTE', 'ESTOQUISTA') && (
          <Botao onClick={() => setMovimentoAberto(true)}>
            <Plus className="size-4" /> Nova movimentação
          </Botao>
        )}
      </Cabecalho>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Buscar produto" />
        <Selecao value={tipo} onChange={(e) => (setTipo(e.target.value), setPagina(1))} className="sm:w-44">
          <option value="">Todos os tipos</option>
          <option value="ENTRADA">Entradas</option>
          <option value="SAIDA">Saídas</option>
          <option value="AJUSTE">Ajustes</option>
        </Selecao>
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Data', 'Produto', 'Tipo', 'Quantidade', 'Saldo', 'Depósito', 'Origem']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((m) => (
          <tr key={m.id} className="hover:bg-slate-50">
            <Celula className="text-slate-500">{dataHora(m.createdAt)}</Celula>
            <Celula>
              <p className="font-medium text-slate-900">{m.produto.nome}</p>
              <p className="font-mono text-xs text-slate-500">{m.produto.codigo}</p>
            </Celula>
            <Celula>
              <Status valor={m.tipo} />
            </Celula>
            <Celula className="tabular-nums">
              {m.tipo === 'SAIDA' ? '−' : m.tipo === 'ENTRADA' ? '+' : '±'}
              {numero(m.quantidade)} {m.produto.unidade}
            </Celula>
            <Celula className="tabular-nums text-slate-500">
              {numero(m.saldoAnterior)} → <span className="text-slate-900">{numero(m.saldoNovo)}</span>
            </Celula>
            <Celula>{m.deposito.nome}</Celula>
            <Celula className="max-w-56 truncate text-slate-500">
              {m.pedido ? (
                <Link href={`/vendas/ver?id=${m.pedido.id}`} className="text-indigo-600 hover:underline">
                  {m.observacao}
                </Link>
              ) : (
                (m.observacao ?? '—')
              )}
            </Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}

      {movimentoAberto && (
        <ModalMovimento depositos={depositos.dados ?? []} aoFechar={() => setMovimentoAberto(false)} aoSalvar={() => (setMovimentoAberto(false), recarregar())} />
      )}
      <ModalDepositos aberto={depositosAberto} aoFechar={() => setDepositosAberto(false)} depositos={depositos.dados ?? []} aoMudar={depositos.recarregar} />
    </>
  );
}

function ModalMovimento({ depositos, aoFechar, aoSalvar }: { depositos: Deposito[]; aoFechar: () => void; aoSalvar: () => void }) {
  const produtos = useDados<Paginado<Produto>>('/produtos?porPagina=200');
  const [form, setForm] = useState({
    produtoId: '',
    depositoId: depositos.find((d) => d.padrao)?.id ?? depositos[0]?.id ?? '',
    tipo: 'ENTRADA' as TipoMovimento,
    quantidade: '',
    custoUnitario: '',
    observacao: '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const produto = produtos.dados?.itens.find((p) => p.id === form.produtoId);
  const saldoNoDeposito = produto?.estoques.find((e) => e.deposito.id === form.depositoId)?.quantidade ?? 0;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api('/estoque/movimentos', {
        metodo: 'POST',
        corpo: {
          produtoId: form.produtoId,
          depositoId: form.depositoId,
          tipo: form.tipo,
          quantidade: Number(form.quantidade),
          custoUnitario: form.tipo === 'ENTRADA' && form.custoUnitario ? Number(form.custoUnitario) : undefined,
          observacao: form.observacao || undefined,
        },
      });
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Nova movimentação de estoque" aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Selecao rotulo="Produto" required value={form.produtoId} onChange={(e) => setForm({ ...form, produtoId: e.target.value })}>
          <option value="">Selecione...</option>
          {produtos.dados?.itens
            .filter((p) => !p.servico)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} — {p.nome}
              </option>
            ))}
        </Selecao>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao rotulo="Tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoMovimento })}>
            <option value="ENTRADA">Entrada (compra, devolução)</option>
            <option value="SAIDA">Saída (perda, consumo)</option>
            <option value="AJUSTE">Ajuste de inventário</option>
          </Selecao>
          <Selecao rotulo="Depósito" required value={form.depositoId} onChange={(e) => setForm({ ...form, depositoId: e.target.value })}>
            {depositos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo={form.tipo === 'AJUSTE' ? 'Quantidade contada (novo saldo)' : 'Quantidade'}
            type="number"
            step="0.001"
            min="0"
            required
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
          />
          {form.tipo === 'ENTRADA' && (
            <Campo rotulo="Custo unitário (opcional)" type="number" step="0.01" min="0" value={form.custoUnitario} onChange={(e) => setForm({ ...form, custoUnitario: e.target.value })} />
          )}
        </div>
        {produto && (
          <p className="text-sm text-slate-500">
            Saldo atual neste depósito: <strong className="text-slate-900">{numero(saldoNoDeposito)} {produto.unidade}</strong>
          </p>
        )}
        <Campo rotulo="Observação" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Ex.: NF 1234 do fornecedor" />
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Lançar" />
      </form>
    </Modal>
  );
}

function ModalDepositos({ aberto, aoFechar, depositos, aoMudar }: { aberto: boolean; aoFechar: () => void; depositos: Deposito[]; aoMudar: () => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [padrao, setPadrao] = useState(false);
  const [erro, setErro] = useState('');

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/estoque/depositos', { metodo: 'POST', corpo: { nome, padrao } });
      setNome('');
      setPadrao(false);
      setErro('');
      await aoMudar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function tornarPadrao(d: Deposito) {
    await api(`/estoque/depositos/${d.id}`, { metodo: 'PATCH', corpo: { nome: d.nome, padrao: true } });
    await aoMudar();
  }

  return (
    <Modal titulo="Depósitos" aberto={aberto} aoFechar={aoFechar}>
      <form onSubmit={criar} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Campo placeholder="Novo depósito" value={nome} onChange={(e) => setNome(e.target.value)} className="flex-1" required />
          <Botao type="submit">Adicionar</Botao>
        </div>
        <Caixa rotulo="Usar como depósito padrão" checked={padrao} onChange={(e) => setPadrao(e.target.checked)} />
      </form>
      <div className="mt-3">
        <Alerta>{erro}</Alerta>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {depositos.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-2 text-sm">
            <span>{d.nome}</span>
            {d.padrao ? (
              <Etiqueta tom="roxo">Padrão</Etiqueta>
            ) : (
              <Botao variante="fantasma" onClick={() => tornarPadrao(d)}>
                Tornar padrão
              </Botao>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
