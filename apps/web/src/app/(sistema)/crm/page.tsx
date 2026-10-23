'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { CartaoOportunidade, etapas, ModalOportunidade } from '@/components/modal-oportunidade';
import { Alerta, Botao, Busca, Cabecalho, Caixa, Indicador } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { moeda, rotuloEtapa } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { EtapaOportunidade, Oportunidade } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

interface Funil {
  etapas: { etapa: EtapaOportunidade; quantidade: number; valor: number }[];
  emAberto: number;
  previsaoPonderada: number;
  taxaConversao: number | null;
}

const corEtapa: Record<EtapaOportunidade, string> = {
  PROSPECCAO: 'bg-slate-400',
  QUALIFICACAO: 'bg-sky-500',
  PROPOSTA: 'bg-indigo-500',
  NEGOCIACAO: 'bg-amber-500',
  GANHO: 'bg-emerald-500',
  PERDIDO: 'bg-rose-500',
};

export default function PaginaFunil() {
  const { usuario } = useSessao();
  const [busca, setBusca] = useState('');
  const [soMeus, setSoMeus] = useState(false);
  const { dados, erro, recarregar } = useDados<Oportunidade[]>(`/crm/oportunidades${qs({ busca, responsavelId: soMeus ? usuario?.id : undefined })}`);
  const funil = useDados<Funil>('/crm/funil');
  const [aberta, setAberta] = useState<Oportunidade | { nova: EtapaOportunidade } | null>(null);
  const [destino, setDestino] = useState<EtapaOportunidade | null>(null);
  const [erroMover, setErroMover] = useState('');

  const atualizarTudo = () => {
    void recarregar();
    void funil.recarregar();
  };

  /** Soltar um cartão em outra coluna muda a etapa do negócio. */
  async function mover(id: string, etapa: EtapaOportunidade) {
    const o = dados?.find((x) => x.id === id);
    if (!o || o.etapa === etapa) return;
    let motivoPerda: string | undefined;
    if (etapa === 'PERDIDO') {
      motivoPerda = prompt('Qual o motivo da perda?') ?? undefined;
      if (!motivoPerda) return;
    }
    try {
      await api(`/crm/oportunidades/${id}`, { metodo: 'PATCH', corpo: { etapa, motivoPerda } });
      setErroMover('');
      atualizarTudo();
    } catch (e) {
      setErroMover((e as Error).message);
    }
  }

  return (
    <>
      <Cabecalho titulo="Funil de vendas" descricao="Arraste os cartões entre as colunas para mudar a etapa">
        <Botao onClick={() => setAberta({ nova: 'PROSPECCAO' })}>
          <Plus className="size-4" /> Novo negócio
        </Botao>
      </Cabecalho>

      {funil.dados && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Indicador rotulo="Em negociação" valor={moeda(funil.dados.emAberto)} detalhe="soma dos negócios em aberto" />
          <Indicador rotulo="Previsão ponderada" valor={moeda(funil.dados.previsaoPonderada)} detalhe="valor × chance de cada etapa" />
          <Indicador
            rotulo="Taxa de conversão"
            valor={funil.dados.taxaConversao === null ? '—' : `${Math.round(funil.dados.taxaConversao * 100)}%`}
            detalhe="ganhos ÷ (ganhos + perdidos)"
            tom="bom"
          />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Busca valor={busca} aoMudar={setBusca} placeholder="Buscar negócio ou contato" />
        <Caixa rotulo="Só os meus" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} />
      </div>
      <Alerta>{erro || erroMover}</Alerta>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-4">
          {etapas.map((etapa) => {
            const cartoes = dados?.filter((o) => o.etapa === etapa) ?? [];
            const total = cartoes.reduce((s, o) => s + Number(o.valorEstimado), 0);
            return (
              <section
                key={etapa}
                onDragOver={(e) => (e.preventDefault(), setDestino(etapa))}
                onDragLeave={() => setDestino(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDestino(null);
                  void mover(e.dataTransfer.getData('text/plain'), etapa);
                }}
                className={`flex w-72 flex-col rounded-xl p-3 transition-colors ${destino === etapa ? 'bg-indigo-100' : 'bg-slate-100'}`}
              >
                <header className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${corEtapa[etapa]}`} />
                    <h2 className="text-sm font-semibold text-slate-800">{rotuloEtapa[etapa]}</h2>
                    <span className="text-xs text-slate-500">{cartoes.length}</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-slate-500">{moeda(total)}</span>
                </header>
                <div className="flex min-h-24 flex-col gap-2">
                  {cartoes.map((o) => (
                    <CartaoOportunidade key={o.id} o={o} aoAbrir={() => setAberta(o)} />
                  ))}
                  {!['GANHO', 'PERDIDO'].includes(etapa) && (
                    <button onClick={() => setAberta({ nova: etapa })} className="rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
                      + Adicionar
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500">Negócios ganhos e perdidos há mais de 30 dias saem do quadro.</p>

      {aberta && (
        <ModalOportunidade
          oportunidade={'nova' in aberta ? undefined : aberta}
          etapaInicial={'nova' in aberta ? aberta.nova : undefined}
          aoFechar={() => setAberta(null)}
          aoMudar={atualizarTudo}
        />
      )}
    </>
  );
}
