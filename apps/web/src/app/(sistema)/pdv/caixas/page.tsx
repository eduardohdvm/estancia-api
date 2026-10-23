'use client';

import { useState } from 'react';
import { Alerta, Cabecalho, Celula, Modal, Paginacao, Selecao, Status, Tabela } from '@/components/ui';
import { qs } from '@/lib/api';
import { dataHora, moeda } from '@/lib/formato';
import type { Caixa, CaixaDetalhado, Paginado } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { ResumoCaixa } from '@/components/resumo-caixa';

export default function FechamentosDeCaixa() {
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando } = useDados<Paginado<Caixa>>(`/pdv/caixas${qs({ status, pagina })}`);
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <>
      <Cabecalho titulo="Fechamentos de caixa" descricao="Histórico das sessões do PDV e conferência de diferenças" />
      <div className="mb-4">
        <Selecao value={status} onChange={(e) => (setStatus(e.target.value), setPagina(1))} className="sm:w-44">
          <option value="">Todos</option>
          <option value="ABERTO">Abertos</option>
          <option value="FECHADO">Fechados</option>
        </Selecao>
      </div>
      <Alerta>{erro}</Alerta>
      <Tabela cabecalhos={['Nº', 'Operador', 'Abertura', 'Fechamento', 'Esperado', 'Contado', 'Diferença', 'Status']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((c) => {
          const diferenca = c.valorFechamento !== null && c.valorEsperado !== null ? Number(c.valorFechamento) - Number(c.valorEsperado) : null;
          return (
            <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setAberto(c.id)}>
              <Celula className="font-medium text-slate-900">#{c.numero}</Celula>
              <Celula>{c.usuario.nome}</Celula>
              <Celula className="text-slate-500">{dataHora(c.abertoEm)}</Celula>
              <Celula className="text-slate-500">{dataHora(c.fechadoEm)}</Celula>
              <Celula className="tabular-nums">{c.valorEsperado ? moeda(c.valorEsperado) : '—'}</Celula>
              <Celula className="tabular-nums">{c.valorFechamento ? moeda(c.valorFechamento) : '—'}</Celula>
              <Celula className={`tabular-nums ${diferenca ? 'font-medium text-rose-600' : diferenca === 0 ? 'text-emerald-600' : ''}`}>
                {diferenca === null ? '—' : moeda(diferenca)}
              </Celula>
              <Celula>
                <Status valor={c.status} />
              </Celula>
            </tr>
          );
        })}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}
      {aberto && <DetalheCaixa id={aberto} aoFechar={() => setAberto(null)} />}
    </>
  );
}

function DetalheCaixa({ id, aoFechar }: { id: string; aoFechar: () => void }) {
  const { dados, erro } = useDados<CaixaDetalhado>(`/pdv/caixas/${id}`);
  return (
    <Modal titulo={dados ? `Caixa nº ${dados.numero} — ${dados.usuario.nome}` : 'Caixa'} aberto aoFechar={aoFechar}>
      <Alerta>{erro}</Alerta>
      {dados && (
        <>
          <ResumoCaixa caixa={dados} />
          {dados.movimentos.length > 0 && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Sangrias e suprimentos</p>
              {dados.movimentos.map((m) => (
                <p key={m.id} className="flex justify-between text-sm text-slate-600">
                  <span>
                    {dataHora(m.createdAt)} · {m.tipo === 'SANGRIA' ? 'Sangria' : 'Suprimento'}
                    {m.motivo ? ` · ${m.motivo}` : ''}
                  </span>
                  <span className="tabular-nums">{moeda(m.valor)}</span>
                </p>
              ))}
            </div>
          )}
          {dados.observacoes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{dados.observacoes}</p>}
        </>
      )}
    </Modal>
  );
}
