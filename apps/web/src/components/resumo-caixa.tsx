import { moeda } from '@/lib/formato';
import type { CaixaDetalhado } from '@/lib/tipos';

/** Resumo de uma sessão de caixa: vendas por forma de pagamento e conferência do dinheiro. */
export function ResumoCaixa({ caixa }: { caixa: CaixaDetalhado }) {
  const r = caixa.resumo;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {r.porForma
        .filter((f) => f.valor > 0)
        .map((f) => (
          <Linha key={f.forma} rotulo={f.rotulo} valor={moeda(f.valor)} />
        ))}
      <div className="my-1 border-t border-slate-200" />
      <Linha rotulo={`Total vendido (${r.quantidadeVendas} venda(s))`} valor={moeda(r.totalVendas)} forte />
      <div className="my-1 border-t border-slate-200" />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Dinheiro na gaveta</p>
      <Linha rotulo="Troco inicial" valor={moeda(caixa.valorAbertura)} />
      <Linha rotulo="+ Vendas em dinheiro" valor={moeda(r.porForma.find((f) => f.forma === 'DINHEIRO')?.valor ?? 0)} />
      <Linha rotulo="+ Suprimentos" valor={moeda(r.suprimentos)} />
      <Linha rotulo="− Sangrias" valor={moeda(r.sangrias)} />
      <Linha rotulo="= Esperado na gaveta" valor={moeda(caixa.valorEsperado ?? r.dinheiroEsperado)} forte />
      {caixa.valorFechamento !== null && r.diferenca !== null && (
        <>
          <Linha rotulo="Contado no fechamento" valor={moeda(caixa.valorFechamento)} />
          <Linha
            rotulo={r.diferenca === 0 ? 'Diferença' : r.diferenca > 0 ? 'Sobra' : 'Falta'}
            valor={moeda(Math.abs(r.diferenca))}
            forte
            cor={r.diferenca === 0 ? 'text-emerald-600' : 'text-rose-600'}
          />
        </>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, forte, cor }: { rotulo: string; valor: string; forte?: boolean; cor?: string }) {
  return (
    <div className={`flex justify-between ${forte ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span>{rotulo}</span>
      <span className={`tabular-nums ${cor ?? ''}`}>{valor}</span>
    </div>
  );
}
