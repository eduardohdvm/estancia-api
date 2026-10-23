'use client';

import { CheckCircle2, Circle, Plus } from 'lucide-react';
import { useState } from 'react';
import { ModalOportunidade } from '@/components/modal-oportunidade';
import { AcoesFormulario, Alerta, AreaTexto, Botao, Cabecalho, Caixa, Campo, Cartao, Etiqueta, Modal, Selecao } from '@/components/ui';
import { api, qs } from '@/lib/api';
import { dataHora, rotuloAtividade } from '@/lib/formato';
import type { Atividade, Oportunidade, Paginado, Pessoa } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

/** Agrupa as tarefas pendentes por prazo. */
function grupo(a: Atividade) {
  if (!a.agendadaPara) return 'Sem data';
  const fimDeHoje = new Date();
  fimDeHoje.setHours(23, 59, 59, 999);
  const data = new Date(a.agendadaPara);
  if (data < new Date()) return 'Atrasadas';
  if (data <= fimDeHoje) return 'Hoje';
  return 'Próximas';
}
const ordemGrupos = ['Atrasadas', 'Hoje', 'Próximas', 'Sem data'];

export default function Tarefas() {
  const [minhas, setMinhas] = useState(true);
  const { dados, erro, recarregar } = useDados<Atividade[]>(`/crm/atividades${qs({ pendentes: true, minhas: minhas || undefined })}`);
  const [novaAberta, setNovaAberta] = useState(false);
  const [oportunidade, setOportunidade] = useState<Oportunidade | null>(null);

  async function concluir(a: Atividade) {
    await api(`/crm/atividades/${a.id}`, { metodo: 'PATCH', corpo: { concluida: true } });
    await recarregar();
  }

  async function abrirOportunidade(id: string) {
    setOportunidade(await api<Oportunidade>(`/crm/oportunidades/${id}`));
  }

  const grupos = ordemGrupos
    .map((nome) => ({ nome, itens: dados?.filter((a) => grupo(a) === nome) ?? [] }))
    .filter((g) => g.itens.length);

  return (
    <>
      <Cabecalho titulo="Tarefas e follow-ups" descricao="Retornos, ligações e compromissos agendados">
        <Botao onClick={() => setNovaAberta(true)}>
          <Plus className="size-4" /> Nova tarefa
        </Botao>
      </Cabecalho>
      <div className="mb-4">
        <Caixa rotulo="Só as minhas" checked={minhas} onChange={(e) => setMinhas(e.target.checked)} />
      </div>
      <Alerta>{erro}</Alerta>

      {dados?.length === 0 && (
        <Cartao className="p-10 text-center text-sm text-slate-500">
          <CheckCircle2 className="mx-auto mb-2 size-8 text-emerald-500" />
          Nenhuma tarefa pendente. Tudo em dia!
        </Cartao>
      )}

      <div className="flex flex-col gap-6">
        {grupos.map((g) => (
          <section key={g.nome}>
            <h2 className={`mb-2 text-sm font-semibold ${g.nome === 'Atrasadas' ? 'text-rose-600' : 'text-slate-700'}`}>
              {g.nome} ({g.itens.length})
            </h2>
            <Cartao className="divide-y divide-slate-100">
              {g.itens.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-4">
                  <button onClick={() => concluir(a)} className="mt-0.5 text-slate-400 hover:text-emerald-600" aria-label="Concluir">
                    <Circle className="size-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      <Etiqueta tom="roxo">{rotuloAtividade[a.tipo]}</Etiqueta> {a.descricao}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.agendadaPara ? dataHora(a.agendadaPara) : 'Sem data'}
                      {a.pessoa && ` · ${a.pessoa.nome}`}
                      {!minhas && ` · ${a.usuario.nome}`}
                    </p>
                    {a.oportunidade && (
                      <button onClick={() => abrirOportunidade(a.oportunidade!.id)} className="mt-1 text-xs text-indigo-600 hover:underline">
                        Negócio: {a.oportunidade.titulo}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Cartao>
          </section>
        ))}
      </div>

      {novaAberta && <ModalNovaTarefa aoFechar={() => setNovaAberta(false)} aoSalvar={() => (setNovaAberta(false), recarregar())} />}
      {oportunidade && <ModalOportunidade oportunidade={oportunidade} aoFechar={() => setOportunidade(null)} aoMudar={recarregar} />}
    </>
  );
}

function ModalNovaTarefa({ aoFechar, aoSalvar }: { aoFechar: () => void; aoSalvar: () => void }) {
  const clientes = useDados<Paginado<Pessoa>>('/pessoas?papel=cliente&porPagina=200');
  const [descricao, setDescricao] = useState('');
  const [agendadaPara, setAgendadaPara] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api('/crm/atividades', {
        metodo: 'POST',
        corpo: { tipo: 'TAREFA', descricao, pessoaId: pessoaId || undefined, agendadaPara: agendadaPara ? new Date(agendadaPara).toISOString() : undefined },
      });
      aoSalvar();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal titulo="Nova tarefa" aberto aoFechar={aoFechar}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <AreaTexto rotulo="O que precisa ser feito?" required autoFocus value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Campo rotulo="Quando" type="datetime-local" value={agendadaPara} onChange={(e) => setAgendadaPara(e.target.value)} />
        <Selecao rotulo="Cliente (opcional)" value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">Nenhum</option>
          {clientes.dados?.itens.filter((c) => c.nome !== 'Consumidor final').map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
        <Alerta>{erro}</Alerta>
        <AcoesFormulario aoCancelar={aoFechar} salvando={salvando} />
      </form>
    </Modal>
  );
}
