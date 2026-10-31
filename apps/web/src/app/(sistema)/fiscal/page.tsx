'use client';

import { Ban, FileCode2, Printer, RotateCcw, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Busca, Cabecalho, Celula, Modal, Paginacao, Selecao, Status, Tabela } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { chaveFormatada, rotuloModelo } from '@/lib/fiscal';
import { dataHora, moeda } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { NotaFiscal, Paginado } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function NotasFiscais() {
  const { pode } = useSessao();
  const [busca, setBusca] = useState('');
  const [modelo, setModelo] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando, recarregar } = useDados<Paginado<NotaFiscal>>(`/fiscal/notas${qs({ busca, modelo, status, pagina })}`);
  const [cancelando, setCancelando] = useState<NotaFiscal | null>(null);
  const [aviso, setAviso] = useState('');

  async function baixarXml(n: NotaFiscal) {
    const completa = await api<NotaFiscal>(`/fiscal/notas/${n.id}`);
    const url = URL.createObjectURL(new Blob([completa.xml ?? ''], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${n.chave}-${n.modelo === 'NFCE' ? 'nfce' : 'nfe'}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function tentarDeNovo(n: NotaFiscal) {
    if (!n.pedido) return;
    setAviso('');
    try {
      const nova = await api<NotaFiscal>(`/fiscal/pedidos/${n.pedido.id}/${n.modelo === 'NFCE' ? 'nfce' : 'nfe'}`, { metodo: 'POST', corpo: {} });
      setAviso(nova.status === 'AUTORIZADA' ? `${rotuloModelo(n.modelo)} nº ${nova.numero} autorizada.` : `Recusada de novo: ${nova.codigoStatus ?? ''} ${nova.motivo ?? ''}`);
      await recarregar();
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  return (
    <>
      <Cabecalho titulo="Notas fiscais" descricao="NF-e e NFC-e emitidas, com DANFE, XML e cancelamento">
        {pode('GERENTE') && (
          <Link href="/fiscal/configuracao" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Settings className="size-4" /> Configuração fiscal
          </Link>
        )}
      </Cabecalho>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Número, chave ou destinatário" />
        <Selecao value={modelo} onChange={(e) => (setModelo(e.target.value), setPagina(1))} className="sm:w-40">
          <option value="">NF-e e NFC-e</option>
          <option value="NFE">Só NF-e</option>
          <option value="NFCE">Só NFC-e</option>
        </Selecao>
        <Selecao value={status} onChange={(e) => (setStatus(e.target.value), setPagina(1))} className="sm:w-40">
          <option value="">Todos os status</option>
          <option value="AUTORIZADA">Autorizadas</option>
          <option value="REJEITADA">Rejeitadas</option>
          <option value="CANCELADA">Canceladas</option>
        </Selecao>
      </div>
      <Alerta>{erro}</Alerta>
      {aviso && <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{aviso}</p>}

      <Tabela cabecalhos={['Nota', 'Emissão', 'Destinatário', 'Valor', 'Ambiente', 'Situação', '']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((n) => (
          <tr key={n.id} className="align-top">
            <Celula>
              <p className="font-medium text-slate-900">
                {rotuloModelo(n.modelo)} nº {n.numero} <span className="text-xs font-normal text-slate-500">série {n.serie}</span>
              </p>
              <p className="font-mono text-[10px] text-slate-400">{chaveFormatada(n.chave)}</p>
              {n.pedido && (
                <Link href={`/vendas/ver?id=${n.pedido.id}`} className="text-xs text-indigo-600 hover:underline">
                  {n.pedido.origem === 'PDV' ? 'Venda PDV' : 'Pedido'} #{n.pedido.numero}
                </Link>
              )}
            </Celula>
            <Celula className="text-slate-500">{dataHora(n.createdAt)}</Celula>
            <Celula>
              {n.destinatarioNome ?? '—'}
              {n.destinatarioDocumento && <p className="text-xs text-slate-500">{n.destinatarioDocumento}</p>}
            </Celula>
            <Celula className="tabular-nums">{moeda(n.valorTotal)}</Celula>
            <Celula>
              <Status valor={n.ambiente} />
            </Celula>
            <Celula className="max-w-64 whitespace-normal">
              <Status valor={n.status} />
              {n.status !== 'AUTORIZADA' && n.motivo && (
                <p className="mt-1 text-xs text-slate-500">
                  {n.codigoStatus ? `${n.codigoStatus} - ` : ''}
                  {n.motivo}
                </p>
              )}
            </Celula>
            <Celula className="text-right">
              <div className="flex justify-end gap-1">
                {(n.status === 'AUTORIZADA' || n.status === 'CANCELADA') && (
                  <>
                    <a href={`/danfe/?id=${n.id}`} target="_blank" className="rounded p-2 text-slate-500 hover:bg-slate-100" title="Imprimir DANFE">
                      <Printer className="size-4" />
                    </a>
                    <Botao variante="fantasma" onClick={() => baixarXml(n)} title="Baixar XML">
                      <FileCode2 className="size-4" />
                    </Botao>
                  </>
                )}
                {n.status === 'AUTORIZADA' && pode('GERENTE') && (
                  <Botao variante="fantasma" onClick={() => setCancelando(n)} title="Cancelar nota">
                    <Ban className="size-4" />
                  </Botao>
                )}
                {n.status === 'REJEITADA' && n.pedido && (
                  <Botao variante="secundario" onClick={() => tentarDeNovo(n)}>
                    <RotateCcw className="size-4" /> Tentar de novo
                  </Botao>
                )}
              </div>
            </Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}

      {cancelando && <ModalCancelar nota={cancelando} aoFechar={() => setCancelando(null)} aoCancelar={() => (setCancelando(null), recarregar())} />}
    </>
  );
}

function ModalCancelar({ nota, aoFechar, aoCancelar }: { nota: NotaFiscal; aoFechar: () => void; aoCancelar: () => void }) {
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cancelar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api(`/fiscal/notas/${nota.id}/cancelar`, { metodo: 'POST', corpo: { justificativa } });
      aoCancelar();
    } catch (e) {
      setErro((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Cancelar ${rotuloModelo(nota.modelo)} nº ${nota.numero}`} aberto aoFechar={aoFechar}>
      <form onSubmit={cancelar} className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">
          O cancelamento é enviado à SEFAZ e não pode ser desfeito. O prazo costuma ser de 24 horas após a autorização (na NFC-e, alguns estados dão só 30 minutos). Depois de cancelar a
          nota, cancele também a venda, se for o caso.
        </p>
        <AreaTexto rotulo="Motivo do cancelamento (mínimo 15 caracteres)" required minLength={15} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={enviando} textoSalvar="Cancelar nota" />
      </form>
    </Modal>
  );
}
