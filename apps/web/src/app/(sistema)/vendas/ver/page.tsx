'use client';

import { ArrowLeft, Ban, CheckCircle2, FileCheck2, Pencil, Printer } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AcoesFormulario, Alerta, Botao, Cabecalho, Campo, Cartao, Celula, Modal, Selecao, Status, Tabela } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, hojeIso, moeda, numero, vencido } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { ContaBancaria, Pedido } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

function DetalhePedido() {
  const id = useSearchParams().get('id') ?? '';
  const { pode } = useSessao();
  const { dados: pedido, erro, recarregar } = useDados<Pedido>(`/pedidos/${id}`);
  const [faturarAberto, setFaturarAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [executando, setExecutando] = useState('');

  async function acao(nome: 'aprovar' | 'cancelar', confirmacao?: string) {
    if (confirmacao && !confirm(confirmacao)) return;
    setExecutando(nome);
    setErroAcao('');
    try {
      await api(`/pedidos/${id}/${nome}`, { metodo: 'POST' });
      await recarregar();
    } catch (e) {
      setErroAcao((e as Error).message);
    } finally {
      setExecutando('');
    }
  }

  if (!pedido) return <Alerta>{erro}</Alerta>;
  const aberto = pedido.status === 'ORCAMENTO' || pedido.status === 'APROVADO';

  return (
    <>
      <Link href="/vendas" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 print:hidden">
        <ArrowLeft className="size-4" /> Voltar para vendas
      </Link>
      <Cabecalho titulo={`Pedido #${pedido.numero}`} descricao={`Criado em ${dataHora(pedido.createdAt)}${pedido.vendedor ? ` por ${pedido.vendedor.nome}` : ''}`}>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Botao variante="secundario" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Botao>
          {aberto && (
            <Link href={`/vendas/editar?id=${id}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Pencil className="size-4" /> Editar
            </Link>
          )}
          {pedido.status === 'ORCAMENTO' && (
            <Botao variante="secundario" carregando={executando === 'aprovar'} onClick={() => acao('aprovar')}>
              <CheckCircle2 className="size-4" /> Aprovar
            </Botao>
          )}
          {aberto && (
            <Botao onClick={() => setFaturarAberto(true)}>
              <FileCheck2 className="size-4" /> Faturar
            </Botao>
          )}
          {pedido.status !== 'CANCELADO' && pode('GERENTE') && (
            <Botao
              variante="perigo"
              carregando={executando === 'cancelar'}
              onClick={() =>
                acao(
                  'cancelar',
                  pedido.status === 'FATURADO'
                    ? 'Cancelar este pedido? O estoque será devolvido e as parcelas em aberto serão canceladas.'
                    : 'Cancelar este pedido?',
                )
              }
            >
              <Ban className="size-4" /> Cancelar
            </Botao>
          )}
        </div>
      </Cabecalho>

      <div className="mb-4">
        <Alerta>{erroAcao}</Alerta>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao className="p-5">
          <p className="text-sm text-slate-500">Status</p>
          <div className="mt-1">
            <Status valor={pedido.status} />
          </div>
          <p className="mt-4 text-sm text-slate-500">Cliente</p>
          <p className="font-medium text-slate-900">{pedido.cliente.nome}</p>
          {pedido.cliente.documento && <p className="text-sm text-slate-500">{pedido.cliente.documento}</p>}
          <p className="mt-4 text-sm text-slate-500">Depósito</p>
          <p className="text-slate-900">{pedido.deposito.nome}</p>
          {pedido.faturadoEm && (
            <>
              <p className="mt-4 text-sm text-slate-500">Faturado em</p>
              <p className="text-slate-900">{dataHora(pedido.faturadoEm)}</p>
            </>
          )}
        </Cartao>

        <Cartao className="flex flex-col gap-2 p-5 lg:col-span-2">
          <Linha rotulo="Subtotal" valor={moeda(pedido.subtotal)} />
          <Linha rotulo="Desconto" valor={`− ${moeda(pedido.desconto)}`} />
          <Linha rotulo="Frete" valor={moeda(pedido.frete)} />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-xl font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{moeda(pedido.total)}</span>
          </div>
          <p className="text-sm text-slate-500">{pedido.parcelas === 1 ? 'Pagamento à vista' : `Em ${pedido.parcelas} parcelas`}</p>
          {pedido.observacoes && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{pedido.observacoes}</p>}
        </Cartao>
      </div>

      <h2 className="mb-3 mt-8 font-semibold text-slate-900">Itens</h2>
      <Tabela cabecalhos={['Código', 'Produto', 'Qtd.', 'Preço unit.', 'Desconto', 'Total']}>
        {pedido.itens.map((i) => (
          <tr key={i.id}>
            <Celula className="font-mono text-xs">{i.produto.codigo}</Celula>
            <Celula className="font-medium text-slate-900">{i.descricao}</Celula>
            <Celula className="tabular-nums">
              {numero(i.quantidade)} {i.produto.unidade}
            </Celula>
            <Celula className="tabular-nums">{moeda(i.precoUnitario)}</Celula>
            <Celula className="tabular-nums">{Number(i.desconto) ? moeda(i.desconto) : '—'}</Celula>
            <Celula className="text-right font-medium tabular-nums">{moeda(i.total)}</Celula>
          </tr>
        ))}
      </Tabela>

      {pedido.lancamentos.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-semibold text-slate-900">Parcelas a receber</h2>
          <Tabela cabecalhos={['Parcela', 'Vencimento', 'Valor', 'Status']}>
            {pedido.lancamentos.map((l) => (
              <tr key={l.id}>
                <Celula>
                  {l.parcela}/{l.totalParcelas}
                </Celula>
                <Celula>{data(l.vencimento)}</Celula>
                <Celula className="tabular-nums">{moeda(l.valor)}</Celula>
                <Celula>
                  <Status valor={vencido(l.vencimento, l.status) ? 'VENCIDO' : l.status} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        </>
      )}

      {faturarAberto && <ModalFaturar pedido={pedido} aoFechar={() => setFaturarAberto(false)} aoFaturar={() => (setFaturarAberto(false), recarregar())} />}
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{rotulo}</span>
      <span className="tabular-nums text-slate-900">{valor}</span>
    </div>
  );
}

function ModalFaturar({ pedido, aoFechar, aoFaturar }: { pedido: Pedido; aoFechar: () => void; aoFaturar: () => void }) {
  const { pode } = useSessao();
  // Só quem acessa o financeiro consegue listar as contas; para os demais, a API usa o padrão.
  const contas = useDados<ContaBancaria[]>(pode('GERENTE', 'FINANCEIRO') ? '/financeiro/contas' : null);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hojeIso(pedido.parcelas === 1 ? 0 : 30));
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function faturar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(`/pedidos/${pedido.id}/faturar`, { metodo: 'POST', corpo: { primeiroVencimento, contaBancariaId: contaBancariaId || undefined } });
      aoFaturar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Faturar pedido #${pedido.numero}`} aberto aoFechar={aoFechar}>
      <form onSubmit={faturar} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Ao faturar, os produtos saem do estoque e {pedido.parcelas === 1 ? 'é gerada 1 conta' : `são geradas ${pedido.parcelas} parcelas`} a receber
          no total de <strong>{moeda(pedido.total)}</strong>.
        </p>
        <Campo rotulo={pedido.parcelas === 1 ? 'Vencimento' : 'Vencimento da 1ª parcela'} type="date" required value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
        {contas.dados && (
          <Selecao rotulo="Receber em" value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)}>
            <option value="">Definir na baixa</option>
            {contas.dados.filter((c) => c.ativa).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        )}
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Confirmar faturamento" />
      </form>
    </Modal>
  );
}

// O id vem do endereço (?id=...), o que permite publicar o site como arquivos estáticos.
export default function Pagina() {
  return (
    <Suspense>
      <DetalhePedido />
    </Suspense>
  );
}
