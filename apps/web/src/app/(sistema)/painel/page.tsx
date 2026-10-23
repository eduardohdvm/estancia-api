'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Alerta, Cabecalho, Cartao, Indicador, Status } from '@/components/ui';
import { moeda, numero } from '@/lib/formato';
import { useSessao } from '@/lib/sessao';
import type { StatusPedido } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

interface Painel {
  vendasMes: { total: number; quantidade: number; ticketMedio: number };
  orcamentosAbertos: number;
  receberHoje: number;
  receberVencido: number;
  pagarHojeEVencido: number;
  vendasPorMes: { mes: string; total: number }[];
  estoqueBaixo: { id: string; nome: string; saldo: number; estoqueMinimo: number }[];
  totalEstoqueBaixo: number;
  ultimosPedidos: { id: string; numero: number; status: StatusPedido; total: string; cliente: { nome: string } }[];
}

const nomeMes = (mes: string) =>
  new Date(`${mes}-15`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

export default function PaginaPainel() {
  const { usuario } = useSessao();
  const router = useRouter();
  const operadorDeCaixa = usuario?.perfil === 'CAIXA';
  const { dados, erro } = useDados<Painel>(operadorDeCaixa ? null : '/dashboard');

  // O operador de caixa só usa o PDV: vai direto para lá.
  useEffect(() => {
    if (operadorDeCaixa) router.replace('/pdv');
  }, [operadorDeCaixa, router]);
  const maior = Math.max(1, ...(dados?.vendasPorMes.map((m) => m.total) ?? []));

  return (
    <>
      <Cabecalho titulo={`Olá, ${usuario?.nome.split(' ')[0]}`} descricao="Resumo do seu negócio hoje" />
      <Alerta>{erro}</Alerta>

      {dados && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Indicador rotulo="Vendas no mês" valor={moeda(dados.vendasMes.total)} detalhe={`${dados.vendasMes.quantidade} venda(s) · ticket médio ${moeda(dados.vendasMes.ticketMedio)}`} />
            <Indicador rotulo="Orçamentos em aberto" valor={String(dados.orcamentosAbertos)} detalhe="aguardando aprovação ou faturamento" />
            <Indicador
              rotulo="A receber hoje"
              valor={moeda(dados.receberHoje)}
              detalhe={dados.receberVencido ? `${moeda(dados.receberVencido)} em atraso` : 'nada em atraso'}
              tom={dados.receberVencido ? 'ruim' : 'bom'}
            />
            <Indicador rotulo="A pagar (hoje e vencidas)" valor={moeda(dados.pagarHojeEVencido)} tom={dados.pagarHojeEVencido ? 'ruim' : 'neutro'} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Cartao className="p-5 lg:col-span-2">
              <h2 className="font-semibold text-slate-900">Vendas faturadas — últimos 6 meses</h2>
              <div className="mt-6 flex h-48 items-end gap-3">
                {dados.vendasPorMes.map((m) => (
                  <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-xs tabular-nums text-slate-500">{m.total ? moeda(m.total).replace(',00', '') : ''}</span>
                    <div className="w-full max-w-12 rounded-t-md bg-indigo-500" style={{ height: `${Math.max(2, (m.total / maior) * 100)}%` }} title={moeda(m.total)} />
                    <span className="text-xs capitalize text-slate-500">{nomeMes(m.mes)}</span>
                  </div>
                ))}
              </div>
            </Cartao>

            <Cartao className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Estoque baixo</h2>
                {dados.totalEstoqueBaixo > 0 && (
                  <Link href="/produtos?estoqueBaixo=true" className="text-sm text-indigo-600 hover:underline">
                    ver todos ({dados.totalEstoqueBaixo})
                  </Link>
                )}
              </div>
              {dados.estoqueBaixo.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">Todos os produtos estão acima do estoque mínimo.</p>
              ) : (
                <ul className="mt-4 divide-y divide-slate-100">
                  {dados.estoqueBaixo.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 py-2 text-sm">
                      <span className="truncate text-slate-700">{p.nome}</span>
                      <span className="shrink-0 tabular-nums text-rose-600">
                        {numero(p.saldo)} / {numero(p.estoqueMinimo)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <Cartao className="p-5">
            <h2 className="font-semibold text-slate-900">Últimos pedidos</h2>
            {dados.ultimosPedidos.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Nenhum pedido ainda.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {dados.ultimosPedidos.map((p) => (
                  <li key={p.id}>
                    <Link href={`/vendas/ver?id=${p.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-slate-50">
                      <span className="w-14 font-medium text-slate-900">#{p.numero}</span>
                      <span className="flex-1 truncate text-slate-700">{p.cliente.nome}</span>
                      <Status valor={p.status} />
                      <span className="w-28 text-right tabular-nums text-slate-900">{moeda(p.total)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      )}
    </>
  );
}
