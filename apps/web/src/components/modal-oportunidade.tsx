'use client';

import { CheckCircle2, Circle, ShoppingCart, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { dataHora, hojeIso, moeda, rotuloAtividade, rotuloEtapa } from '@/lib/formato';
import type { Atividade, EtapaOportunidade, Oportunidade, Paginado, Pessoa, TipoAtividade } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { Alerta, AreaTexto, Botao, Campo, Etiqueta, Modal, Selecao } from './ui';

export const etapas: EtapaOportunidade[] = ['PROSPECCAO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'];
const tiposAtividade: TipoAtividade[] = ['LIGACAO', 'WHATSAPP', 'EMAIL', 'REUNIAO', 'VISITA', 'TAREFA', 'NOTA'];

/** Criação e edição de um negócio, com o histórico de atividades. */
export function ModalOportunidade({
  oportunidade,
  etapaInicial,
  aoFechar,
  aoMudar,
}: {
  oportunidade?: Oportunidade;
  etapaInicial?: EtapaOportunidade;
  aoFechar: () => void;
  aoMudar: () => void;
}) {
  const clientes = useDados<Paginado<Pessoa>>('/pessoas?papel=cliente&porPagina=200');
  const equipe = useDados<{ id: string; nome: string }[]>('/usuarios/equipe');
  const [form, setForm] = useState({
    titulo: oportunidade?.titulo ?? '',
    pessoaId: oportunidade?.pessoaId ?? '',
    contatoNome: oportunidade?.contatoNome ?? '',
    contatoTelefone: oportunidade?.contatoTelefone ?? '',
    contatoEmail: oportunidade?.contatoEmail ?? '',
    valorEstimado: oportunidade ? String(Number(oportunidade.valorEstimado)) : '',
    etapa: oportunidade?.etapa ?? etapaInicial ?? 'PROSPECCAO',
    responsavelId: oportunidade?.responsavelId ?? '',
    previsaoFechamento: oportunidade?.previsaoFechamento?.slice(0, 10) ?? '',
    origem: oportunidade?.origem ?? '',
    motivoPerda: oportunidade?.motivoPerda ?? '',
    observacoes: oportunidade?.observacoes ?? '',
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
      ...form,
      valorEstimado: Number(form.valorEstimado || 0),
      // Sem responsável escolhido em um negócio novo, a API usa o usuário logado.
      responsavelId: form.responsavelId || (oportunidade ? null : undefined),
      motivoPerda: form.etapa === 'PERDIDO' ? form.motivoPerda : '',
    };
    try {
      await api(oportunidade ? `/crm/oportunidades/${oportunidade.id}` : '/crm/oportunidades', { metodo: oportunidade ? 'PATCH' : 'POST', corpo });
      aoMudar();
      aoFechar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!oportunidade || !confirm(`Excluir o negócio "${oportunidade.titulo}" e todo o histórico?`)) return;
    await api(`/crm/oportunidades/${oportunidade.id}`, { metodo: 'DELETE' });
    aoMudar();
    aoFechar();
  }

  return (
    <Modal titulo={oportunidade ? oportunidade.titulo : 'Novo negócio'} aberto aoFechar={aoFechar} largura="max-w-4xl">
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={salvar} className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-3">
          <Campo rotulo="Título do negócio" required className="sm:col-span-2" placeholder="Ex.: Fornecimento mensal para restaurante" {...campo('titulo')} />
          <Selecao rotulo="Cliente cadastrado" className="sm:col-span-2" {...campo('pessoaId')}>
            <option value="">Ainda não é cliente (preencher contato)</option>
            {clientes.dados?.itens.filter((c) => c.nome !== 'Consumidor final').map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
          {!form.pessoaId && (
            <>
              <Campo rotulo="Nome do contato" {...campo('contatoNome')} />
              <Campo rotulo="Telefone" {...campo('contatoTelefone')} />
              <Campo rotulo="E-mail" type="email" className="sm:col-span-2" {...campo('contatoEmail')} />
            </>
          )}
          <Campo rotulo="Valor estimado (R$)" type="number" step="0.01" min="0" {...campo('valorEstimado')} />
          <Selecao rotulo="Etapa" {...campo('etapa')}>
            {etapas.map((e) => (
              <option key={e} value={e}>
                {rotuloEtapa[e]}
              </option>
            ))}
          </Selecao>
          {form.etapa === 'PERDIDO' && <Campo rotulo="Motivo da perda" required className="sm:col-span-2" placeholder="Ex.: preço, prazo, concorrente" {...campo('motivoPerda')} />}
          <Selecao rotulo="Responsável" {...campo('responsavelId')}>
            <option value="">{oportunidade ? 'Ninguém' : 'Eu'}</option>
            {equipe.dados?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
          <Campo rotulo="Previsão de fechamento" type="date" {...campo('previsaoFechamento')} />
          <Campo rotulo="Origem" className="sm:col-span-2" placeholder="Ex.: indicação, Instagram, site" {...campo('origem')} />
          <AreaTexto rotulo="Observações" className="sm:col-span-2" {...campo('observacoes')} />
          <div className="sm:col-span-2">
            <Alerta>{erro}</Alerta>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
            <div className="flex gap-2">
              {oportunidade && (
                <Botao variante="fantasma" onClick={excluir}>
                  <Trash2 className="size-4" /> Excluir
                </Botao>
              )}
              {oportunidade?.etapa === 'GANHO' && oportunidade.pessoaId && (
                <Link
                  href={`/vendas/novo?cliente=${oportunidade.pessoaId}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ShoppingCart className="size-4" /> Criar pedido
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={aoFechar}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={salvando}>
                Salvar
              </Botao>
            </div>
          </div>
        </form>

        <div className="lg:col-span-2 lg:border-l lg:border-slate-200 lg:pl-6">
          {oportunidade ? (
            <Historico filtro={`oportunidadeId=${oportunidade.id}`} oportunidadeId={oportunidade.id} aoMudar={aoMudar} />
          ) : (
            <p className="text-sm text-slate-500">Salve o negócio para registrar ligações, reuniões e tarefas.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Lista de atividades com o formulário para registrar uma nova. */
export function Historico({ filtro, oportunidadeId, pessoaId, aoMudar }: { filtro: string; oportunidadeId?: string; pessoaId?: string; aoMudar?: () => void }) {
  const { dados, recarregar } = useDados<Atividade[]>(`/crm/atividades?${filtro}`);
  const [tipo, setTipo] = useState<TipoAtividade>('LIGACAO');
  const [descricao, setDescricao] = useState('');
  const [agendadaPara, setAgendadaPara] = useState('');
  const [erro, setErro] = useState('');

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/crm/atividades', {
        metodo: 'POST',
        corpo: { tipo, descricao, oportunidadeId, pessoaId, agendadaPara: agendadaPara ? new Date(agendadaPara).toISOString() : undefined },
      });
      setDescricao('');
      setAgendadaPara('');
      setErro('');
      await recarregar();
      aoMudar?.();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function alternar(a: Atividade) {
    await api(`/crm/atividades/${a.id}`, { metodo: 'PATCH', corpo: { concluida: !a.concluida } });
    await recarregar();
    aoMudar?.();
  }

  return (
    <div>
      <h3 className="font-semibold text-slate-900">Atividades</h3>
      <form onSubmit={registrar} className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {tiposAtividade.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${tipo === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {rotuloAtividade[t]}
            </button>
          ))}
        </div>
        <AreaTexto placeholder={tipo === 'TAREFA' ? 'O que precisa ser feito?' : 'O que foi conversado?'} required value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Campo rotulo="Agendar para (opcional)" type="datetime-local" value={agendadaPara} onChange={(e) => setAgendadaPara(e.target.value)} />
        <Alerta>{erro}</Alerta>
        <Botao type="submit" variante="secundario">
          Registrar
        </Botao>
      </form>

      <ol className="mt-5 flex flex-col gap-3">
        {dados?.map((a) => {
          const atrasada = !a.concluida && a.agendadaPara && new Date(a.agendadaPara) < new Date();
          return (
            <li key={a.id} className="flex gap-2 text-sm">
              <button onClick={() => alternar(a)} className="mt-0.5 shrink-0 text-slate-400 hover:text-indigo-600" aria-label={a.concluida ? 'Reabrir' : 'Concluir'}>
                {a.concluida ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Circle className="size-4" />}
              </button>
              <div className="min-w-0">
                <p className={a.concluida && a.tipo === 'TAREFA' ? 'text-slate-400 line-through' : 'text-slate-700'}>
                  <span className="font-medium">{rotuloAtividade[a.tipo]}:</span> {a.descricao}
                </p>
                <p className="text-xs text-slate-400">
                  {a.usuario.nome} · {dataHora(a.createdAt)}
                  {a.agendadaPara && (
                    <span className={atrasada ? 'font-medium text-rose-600' : ''}> · para {dataHora(a.agendadaPara)}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
        {dados?.length === 0 && <li className="text-sm text-slate-500">Nenhuma atividade ainda.</li>}
      </ol>
    </div>
  );
}

/** Cartão do quadro do funil. */
export function CartaoOportunidade({ o, aoAbrir }: { o: Oportunidade; aoAbrir: () => void }) {
  const atrasada = o.previsaoFechamento && !['GANHO', 'PERDIDO'].includes(o.etapa) && o.previsaoFechamento.slice(0, 10) < hojeIso();
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', o.id)}
      onClick={aoAbrir}
      className="w-full cursor-grab rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-indigo-300 active:cursor-grabbing"
    >
      <p className="font-medium text-slate-900">{o.titulo}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{o.pessoa?.nome ?? o.contatoNome ?? 'Sem contato'}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-900">{moeda(o.valorEstimado)}</span>
        <div className="flex gap-1">
          {o._count.atividades > 0 && <Etiqueta tom="amarelo">{o._count.atividades} tarefa(s)</Etiqueta>}
          {atrasada && <Etiqueta tom="vermelho">Atrasado</Etiqueta>}
        </div>
      </div>
      {o.etapa === 'PERDIDO' && o.motivoPerda && <p className="mt-1 text-xs text-rose-600">Motivo: {o.motivoPerda}</p>}
      {o.responsavel && <p className="mt-2 text-xs text-slate-400">{o.responsavel.nome}</p>}
    </button>
  );
}
