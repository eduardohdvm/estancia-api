'use client';

import { Ban, CheckCircle2, Pencil, Plus, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { data, hojeIso, moeda, vencido } from '@/lib/formato';
import type { CategoriaFinanceira, ContaBancaria, Lancamento, Paginado, Pessoa, TipoLancamento } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Busca, Cabecalho, Caixa, Campo, Celula, Modal, Paginacao, Selecao, Status, Tabela } from './ui';

type Lista = Paginado<Lancamento> & { somaValor: number };

/** Tela de contas a receber ou a pagar. */
export function PaginaLancamentos({ tipo }: { tipo: TipoLancamento }) {
  const receber = tipo === 'RECEBER';
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('ABERTO');
  const [vencidos, setVencidos] = useState(useSearchParams().get('vencidos') === 'true');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useDados<Lista>(
    `/financeiro/lancamentos${qs({ tipo, busca, status: vencidos ? undefined : status, vencidos: vencidos || undefined, vencimentoDe: de, vencimentoAte: ate, pagina })}`,
  );
  const contas = useDados<ContaBancaria[]>('/financeiro/contas');
  const categorias = useDados<CategoriaFinanceira[]>('/financeiro/categorias');
  const pessoas = useDados<Paginado<Pessoa>>(`/pessoas?porPagina=200${receber ? '&papel=cliente' : ''}`);

  const [formAberto, setFormAberto] = useState<Lancamento | 'novo' | null>(null);
  const [baixando, setBaixando] = useState<Lancamento | null>(null);

  async function acao(l: Lancamento, nome: 'estornar' | 'cancelar', pergunta: string) {
    if (!confirm(pergunta)) return;
    try {
      await api(`/financeiro/lancamentos/${l.id}/${nome}`, { metodo: 'POST' });
      await recarregar();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const mudar = <T,>(setter: (v: T) => void) => (v: T) => (setter(v), setPagina(1));

  return (
    <>
      <Cabecalho titulo={receber ? 'Contas a receber' : 'Contas a pagar'} descricao={receber ? 'Valores que seus clientes devem à empresa' : 'Despesas e compras a pagar'}>
        <Botao onClick={() => setFormAberto('novo')}>
          <Plus className="size-4" /> Nova conta
        </Botao>
      </Cabecalho>

      <div className="mb-4 flex flex-col flex-wrap gap-3 lg:flex-row lg:items-center">
        <Busca valor={busca} aoMudar={mudar(setBusca)} placeholder="Descrição ou pessoa" />
        <Selecao value={status} onChange={(e) => mudar(setStatus)(e.target.value)} disabled={vencidos} className="lg:w-40">
          <option value="">Todos</option>
          <option value="ABERTO">Em aberto</option>
          <option value="PAGO">{receber ? 'Recebidos' : 'Pagos'}</option>
          <option value="CANCELADO">Cancelados</option>
        </Selecao>
        <div className="flex items-center gap-2">
          <Campo type="date" value={de} onChange={(e) => mudar(setDe)(e.target.value)} aria-label="Vencimento de" />
          <span className="text-sm text-slate-400">até</span>
          <Campo type="date" value={ate} onChange={(e) => mudar(setAte)(e.target.value)} aria-label="Vencimento até" />
        </div>
        <Caixa rotulo="Só vencidos" checked={vencidos} onChange={(e) => mudar(setVencidos)(e.target.checked)} />
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Vencimento', 'Descrição', receber ? 'Cliente' : 'Fornecedor', 'Categoria', 'Valor', 'Status', '']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((l) => {
          const atrasado = vencido(l.vencimento, l.status);
          return (
            <tr key={l.id} className="hover:bg-slate-50">
              <Celula className={atrasado ? 'font-medium text-rose-600' : ''}>{data(l.vencimento)}</Celula>
              <Celula>
                <p className="font-medium text-slate-900">{l.descricao}</p>
                {l.pedido && (
                  <Link href={`/vendas/ver?id=${l.pedido.id}`} className="text-xs text-indigo-600 hover:underline">
                    Pedido #{l.pedido.numero} · parcela {l.parcela}/{l.totalParcelas}
                  </Link>
                )}
                {l.pedidoCompra && (
                  <p className="text-xs text-slate-500">
                    Compra #{l.pedidoCompra.numero} · parcela {l.parcela}/{l.totalParcelas}
                  </p>
                )}
                {l.status === 'PAGO' && (
                  <p className="text-xs text-slate-500">
                    {receber ? 'Recebido' : 'Pago'} em {data(l.pagoEm)} · {l.contaBancaria?.nome}
                  </p>
                )}
              </Celula>
              <Celula>{l.pessoa?.nome ?? '—'}</Celula>
              <Celula>{l.categoria?.nome ?? '—'}</Celula>
              <Celula className="tabular-nums">
                {moeda(l.valor)}
                {l.valorPago && Number(l.valorPago) !== Number(l.valor) && <p className="text-xs text-slate-500">pago {moeda(l.valorPago)}</p>}
              </Celula>
              <Celula>
                <Status valor={atrasado ? 'VENCIDO' : l.status} />
              </Celula>
              <Celula className="text-right">
                {l.status === 'ABERTO' && (
                  <>
                    <Botao variante="fantasma" onClick={() => setBaixando(l)} title={receber ? 'Receber' : 'Pagar'}>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    </Botao>
                    <Botao variante="fantasma" onClick={() => setFormAberto(l)} title="Editar">
                      <Pencil className="size-4" />
                    </Botao>
                    <Botao variante="fantasma" onClick={() => acao(l, 'cancelar', `Cancelar "${l.descricao}"?`)} title="Cancelar">
                      <Ban className="size-4" />
                    </Botao>
                  </>
                )}
                {l.status === 'PAGO' && (
                  <Botao variante="fantasma" onClick={() => acao(l, 'estornar', `Estornar a baixa de "${l.descricao}"? O título volta a ficar em aberto.`)} title="Estornar">
                    <Undo2 className="size-4" />
                  </Botao>
                )}
              </Celula>
            </tr>
          );
        })}
      </Tabela>
      {dados && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="mt-3 text-sm text-slate-600">
            Total filtrado: <strong className="tabular-nums">{moeda(dados.somaValor)}</strong>
          </p>
          <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />
        </div>
      )}

      {formAberto && (
        <ModalLancamento
          tipo={tipo}
          lancamento={formAberto === 'novo' ? undefined : formAberto}
          pessoas={pessoas.dados?.itens ?? []}
          categorias={categorias.dados?.filter((c) => c.tipo === tipo) ?? []}
          contas={contas.dados?.filter((c) => c.ativa) ?? []}
          aoFechar={() => setFormAberto(null)}
          aoSalvar={() => (setFormAberto(null), recarregar())}
        />
      )}
      {baixando && (
        <ModalBaixa lancamento={baixando} contas={contas.dados?.filter((c) => c.ativa) ?? []} aoFechar={() => setBaixando(null)} aoSalvar={() => (setBaixando(null), recarregar())} />
      )}
    </>
  );
}

function ModalLancamento({
  tipo,
  lancamento,
  pessoas,
  categorias,
  contas,
  aoFechar,
  aoSalvar,
}: {
  tipo: TipoLancamento;
  lancamento?: Lancamento;
  pessoas: Pessoa[];
  categorias: CategoriaFinanceira[];
  contas: ContaBancaria[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [form, setForm] = useState({
    descricao: lancamento?.descricao ?? '',
    valor: lancamento ? String(Number(lancamento.valor)) : '',
    vencimento: lancamento?.vencimento.slice(0, 10) ?? hojeIso(),
    parcelas: '1',
    pessoaId: lancamento?.pessoaId ?? '',
    categoriaId: lancamento?.categoriaId ?? '',
    contaBancariaId: lancamento?.contaBancariaId ?? '',
    observacoes: lancamento?.observacoes ?? '',
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const campo = (nome: keyof typeof form) => ({
    value: form[nome],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [nome]: e.target.value }),
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const corpo = {
      descricao: form.descricao,
      valor: Number(form.valor),
      vencimento: form.vencimento,
      pessoaId: form.pessoaId || undefined,
      categoriaId: form.categoriaId || undefined,
      contaBancariaId: form.contaBancariaId || undefined,
      observacoes: form.observacoes || undefined,
      ...(lancamento ? {} : { tipo, parcelas: Number(form.parcelas) }),
    };
    try {
      await api(lancamento ? `/financeiro/lancamentos/${lancamento.id}` : '/financeiro/lancamentos', { metodo: lancamento ? 'PATCH' : 'POST', corpo });
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={lancamento ? 'Editar conta' : tipo === 'RECEBER' ? 'Nova conta a receber' : 'Nova conta a pagar'} aberto aoFechar={aoFechar} largura="max-w-xl">
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Descrição" required className="sm:col-span-2" {...campo('descricao')} />
        <Campo rotulo={lancamento ? 'Valor' : 'Valor total'} type="number" step="0.01" min="0.01" required {...campo('valor')} />
        <Campo rotulo={lancamento ? 'Vencimento' : 'Vencimento (1ª parcela)'} type="date" required {...campo('vencimento')} />
        {!lancamento && (
          <Selecao rotulo="Parcelas" {...campo('parcelas')}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Parcela única' : `${n}x mensais${form.valor ? ` de ${moeda(Number(form.valor) / n)}` : ''}`}
              </option>
            ))}
          </Selecao>
        )}
        <Selecao rotulo={tipo === 'RECEBER' ? 'Cliente' : 'Fornecedor'} {...campo('pessoaId')}>
          <option value="">Nenhum</option>
          {pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Categoria" {...campo('categoriaId')}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Conta" {...campo('contaBancariaId')}>
          <option value="">Definir na baixa</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <AreaTexto rotulo="Observações" className="sm:col-span-2" {...campo('observacoes')} />
        <div className="sm:col-span-2">
          <Alerta>{erro}</Alerta>
          <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} />
        </div>
      </form>
    </Modal>
  );
}

function ModalBaixa({ lancamento, contas, aoFechar, aoSalvar }: { lancamento: Lancamento; contas: ContaBancaria[]; aoFechar: () => void; aoSalvar: () => void }) {
  const receber = lancamento.tipo === 'RECEBER';
  const [valorPago, setValorPago] = useState(String(Number(lancamento.valor)));
  const [pagoEm, setPagoEm] = useState(hojeIso());
  const [contaBancariaId, setContaBancariaId] = useState(lancamento.contaBancariaId ?? contas[0]?.id ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(`/financeiro/lancamentos/${lancamento.id}/baixar`, { metodo: 'POST', corpo: { valorPago: Number(valorPago), pagoEm, contaBancariaId } });
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={receber ? 'Registrar recebimento' : 'Registrar pagamento'} aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          {lancamento.descricao} — vencimento {data(lancamento.vencimento)} — <strong>{moeda(lancamento.valor)}</strong>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo={receber ? 'Valor recebido' : 'Valor pago'} type="number" step="0.01" min="0" required value={valorPago} onChange={(e) => setValorPago(e.target.value)} />
          <Campo rotulo="Data" type="date" required value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} />
        </div>
        <Selecao rotulo={receber ? 'Recebido em' : 'Pago com'} required value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)}>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Confirmar" />
      </form>
    </Modal>
  );
}
