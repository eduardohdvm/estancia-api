'use client';

import Link from 'next/link';
import { Alerta, Cabecalho, Cartao, Indicador } from '@/components/ui';
import { moeda } from '@/lib/formato';
import type { ContaBancaria } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

interface Resumo {
  saldoAtual: number;
  receber: { aberto: number; vencido: number; proximos30dias: number };
  pagar: { aberto: number; vencido: number; proximos30dias: number };
  saldoPrevisto30dias: number;
  contas: ContaBancaria[];
}

export default function VisaoFinanceira() {
  const { dados, erro } = useDados<Resumo>('/financeiro/resumo');

  return (
    <>
      <Cabecalho titulo="Financeiro" descricao="Saldo, contas a receber e a pagar" />
      <Alerta>{erro}</Alerta>
      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Saldo atual (caixa e bancos)" valor={moeda(dados.saldoAtual)} tom={dados.saldoAtual < 0 ? 'ruim' : 'neutro'} />
            <Indicador rotulo="A receber (em aberto)" valor={moeda(dados.receber.aberto)} detalhe={dados.receber.vencido ? `${moeda(dados.receber.vencido)} vencido` : 'nada vencido'} tom="bom" />
            <Indicador rotulo="A pagar (em aberto)" valor={moeda(dados.pagar.aberto)} detalhe={dados.pagar.vencido ? `${moeda(dados.pagar.vencido)} vencido` : 'nada vencido'} tom="ruim" />
            <Indicador
              rotulo="Saldo previsto em 30 dias"
              valor={moeda(dados.saldoPrevisto30dias)}
              detalhe="saldo + a receber − a pagar (inclui vencidos)"
              tom={dados.saldoPrevisto30dias < 0 ? 'ruim' : 'bom'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Cartao className="p-5">
              <h2 className="font-semibold text-slate-900">Próximos 30 dias</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <Linha rotulo="Entradas previstas" valor={moeda(dados.receber.proximos30dias)} cor="text-emerald-600" href="/financeiro/receber" />
                <Linha rotulo="Saídas previstas" valor={moeda(dados.pagar.proximos30dias)} cor="text-rose-600" href="/financeiro/pagar" />
                <Linha rotulo="Recebimentos em atraso" valor={moeda(dados.receber.vencido)} cor="text-amber-600" href="/financeiro/receber?vencidos=true" />
                <Linha rotulo="Pagamentos em atraso" valor={moeda(dados.pagar.vencido)} cor="text-amber-600" href="/financeiro/pagar?vencidos=true" />
              </div>
            </Cartao>
            <Cartao className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Saldo por conta</h2>
                <Link href="/financeiro/contas" className="text-sm text-indigo-600 hover:underline">
                  gerenciar
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-slate-100 text-sm">
                {dados.contas
                  .filter((c) => c.ativa)
                  .map((c) => (
                    <li key={c.id} className="flex justify-between py-2">
                      <span className="text-slate-700">{c.nome}</span>
                      <span className={`tabular-nums ${c.saldoAtual < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{moeda(c.saldoAtual)}</span>
                    </li>
                  ))}
              </ul>
            </Cartao>
          </div>
        </div>
      )}
    </>
  );
}

function Linha({ rotulo, valor, cor, href }: { rotulo: string; valor: string; cor: string; href: string }) {
  return (
    <Link href={href} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <span className="text-slate-600">{rotulo}</span>
      <span className={`font-medium tabular-nums ${cor}`}>{valor}</span>
    </Link>
  );
}
