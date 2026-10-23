'use client';

import { ArrowLeft, Ban, PackageCheck, Pencil, Printer, Send } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AcoesFormulario, Alerta, Botao, Cabecalho, Campo, Cartao, Celula, Modal, Selecao, Status, Tabela } from '@/components/ui';
import { api } from '@/lib/api';
import { data, dataHora, hojeIso, moeda, numero, vencido } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { Compra, ContaBancaria } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

function DetalheCompra() {
  const id = useSearchParams().get('id') ?? '';
  const { pode } = useSessao();
  const { dados: compra, erro, recarregar } = useDados<Compra>(`/compras/${id}`);
  const [receberAberto, setReceberAberto] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [executando, setExecutando] = useState('');

  async function acao(nome: 'enviar' | 'cancelar', confirmacao?: string) {
    if (confirmacao && !confirm(confirmacao)) return;
    setExecutando(nome);
    setErroAcao('');
    try {
      await api(`/compras/${id}/${nome}`, { metodo: 'POST' });
      await recarregar();
    } catch (e) {
      setErroAcao((e as Error).message);
    } finally {
      setExecutando('');
    }
  }

  if (!compra) return <Alerta>{erro}</Alerta>;
  const pendente = compra.status === 'RASCUNHO' || compra.status === 'ENVIADO';

  return (
    <>
      <Link href="/compras" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 print:hidden">
        <ArrowLeft className="size-4" /> Voltar para compras
      </Link>
      <Cabecalho titulo={`Pedido de compra #${compra.numero}`} descricao={`Criado em ${dataHora(compra.createdAt)}`}>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Botao variante="secundario" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir
          </Botao>
          {pendente && (
            <Link href={`/compras/editar?id=${id}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Pencil className="size-4" /> Editar
            </Link>
          )}
          {compra.status === 'RASCUNHO' && (
            <Botao variante="secundario" carregando={executando === 'enviar'} onClick={() => acao('enviar')}>
              <Send className="size-4" /> Marcar como enviado
            </Botao>
          )}
          {pendente && (
            <Botao onClick={() => setReceberAberto(true)}>
              <PackageCheck className="size-4" /> Receber mercadoria
            </Botao>
          )}
          {compra.status !== 'CANCELADO' && pode('GERENTE') && (
            <Botao
              variante="perigo"
              carregando={executando === 'cancelar'}
              onClick={() =>
                acao(
                  'cancelar',
                  compra.status === 'RECEBIDO'
                    ? 'Cancelar esta compra? A mercadoria sai do estoque e as parcelas em aberto são canceladas.'
                    : 'Cancelar este pedido de compra?',
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
            <Status valor={compra.status} />
          </div>
          <p className="mt-4 text-sm text-slate-500">Fornecedor</p>
          <p className="font-medium text-slate-900">{compra.fornecedor.nome}</p>
          {[compra.fornecedor.documento, compra.fornecedor.telefone, compra.fornecedor.email].filter(Boolean).map((t) => (
            <p key={t} className="text-sm text-slate-500">
              {t}
            </p>
          ))}
          <p className="mt-4 text-sm text-slate-500">Depósito de entrada</p>
          <p className="text-slate-900">{compra.deposito.nome}</p>
          <p className="mt-4 text-sm text-slate-500">{compra.recebidoEm ? 'Recebido em' : 'Previsão de entrega'}</p>
          <p className="text-slate-900">{compra.recebidoEm ? dataHora(compra.recebidoEm) : data(compra.previsaoEntrega)}</p>
        </Cartao>

        <Cartao className="flex flex-col gap-2 p-5 lg:col-span-2">
          <Linha rotulo="Subtotal" valor={moeda(compra.subtotal)} />
          <Linha rotulo="Desconto" valor={`− ${moeda(compra.desconto)}`} />
          <Linha rotulo="Frete" valor={moeda(compra.frete)} />
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 text-xl font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{moeda(compra.total)}</span>
          </div>
          <p className="text-sm text-slate-500">{compra.parcelas === 1 ? 'Pagamento à vista' : `Em ${compra.parcelas} parcelas`}</p>
          {pendente && Number(compra.frete) + Number(compra.desconto) > 0 && (
            <p className="text-xs text-slate-500">No recebimento, frete e desconto são rateados no custo de cada item.</p>
          )}
          {compra.observacoes && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{compra.observacoes}</p>}
        </Cartao>
      </div>

      <h2 className="mb-3 mt-8 font-semibold text-slate-900">Itens</h2>
      <Tabela cabecalhos={['Código', 'Produto', 'Qtd.', 'Custo unit.', 'Total']}>
        {compra.itens.map((i) => (
          <tr key={i.id}>
            <Celula className="font-mono text-xs">{i.produto.codigo}</Celula>
            <Celula className="font-medium text-slate-900">{i.descricao}</Celula>
            <Celula className="tabular-nums">
              {numero(i.quantidade)} {i.produto.unidade}
            </Celula>
            <Celula className="tabular-nums">{moeda(i.custoUnitario)}</Celula>
            <Celula className="text-right font-medium tabular-nums">{moeda(i.total)}</Celula>
          </tr>
        ))}
      </Tabela>

      {compra.lancamentos.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-semibold text-slate-900">Parcelas a pagar</h2>
          <Tabela cabecalhos={['Parcela', 'Vencimento', 'Valor', 'Status']}>
            {compra.lancamentos.map((l) => (
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

      {receberAberto && <ModalReceber compra={compra} aoFechar={() => setReceberAberto(false)} aoReceber={() => (setReceberAberto(false), recarregar())} />}
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

function ModalReceber({ compra, aoFechar, aoReceber }: { compra: Compra; aoFechar: () => void; aoReceber: () => void }) {
  const { pode } = useSessao();
  const contas = useDados<ContaBancaria[]>(pode('GERENTE', 'FINANCEIRO') ? '/financeiro/contas' : null);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hojeIso(compra.parcelas === 1 ? 0 : 30));
  const [contaBancariaId, setContaBancariaId] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function receber(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(`/compras/${compra.id}/receber`, { metodo: 'POST', corpo: { primeiroVencimento, contaBancariaId: contaBancariaId || undefined } });
      aoReceber();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Receber compra #${compra.numero}`} aberto aoFechar={aoFechar}>
      <form onSubmit={receber} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          Os itens entram no estoque de <strong>{compra.deposito.nome}</strong>, o custo médio dos produtos é atualizado e{' '}
          {compra.parcelas === 1 ? 'é gerada 1 conta' : `são geradas ${compra.parcelas} parcelas`} a pagar no total de <strong>{moeda(compra.total)}</strong>.
        </p>
        <Campo rotulo={compra.parcelas === 1 ? 'Vencimento' : 'Vencimento da 1ª parcela'} type="date" required value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
        {contas.dados && (
          <Selecao rotulo="Pagar com" value={contaBancariaId} onChange={(e) => setContaBancariaId(e.target.value)}>
            <option value="">Definir no pagamento</option>
            {contas.dados.filter((c) => c.ativa).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        )}
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} textoSalvar="Confirmar recebimento" />
      </form>
    </Modal>
  );
}

// O id vem do endereço (?id=...), o que permite publicar o site como arquivos estáticos.
export default function Pagina() {
  return (
    <Suspense>
      <DetalheCompra />
    </Suspense>
  );
}
