'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alerta, Busca, Cabecalho, Celula, Paginacao, Selecao, Status, Tabela } from '@/components/ui';
import { qs } from '@/lib/api';
import { dataHora, moeda } from '@/lib/formato';
import type { Paginado, PedidoResumo } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function PaginaVendas() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando } = useDados<Paginado<PedidoResumo>>(`/pedidos${qs({ busca, status, pagina })}`);

  return (
    <>
      <Cabecalho titulo="Vendas" descricao="Orçamentos e pedidos de venda">
        <Link href="/vendas/novo" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="size-4" /> Novo pedido
        </Link>
      </Cabecalho>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Número ou cliente" />
        <Selecao value={status} onChange={(e) => (setStatus(e.target.value), setPagina(1))} className="sm:w-44">
          <option value="">Todos os status</option>
          <option value="ORCAMENTO">Orçamentos</option>
          <option value="APROVADO">Aprovados</option>
          <option value="FATURADO">Faturados</option>
          <option value="CANCELADO">Cancelados</option>
        </Selecao>
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Nº', 'Data', 'Cliente', 'Vendedor', 'Status', 'Total']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((p) => (
          <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/vendas/ver?id=${p.id}`)}>
            <Celula className="font-medium text-slate-900">#{p.numero}</Celula>
            <Celula className="text-slate-500">{dataHora(p.createdAt)}</Celula>
            <Celula>{p.cliente.nome}</Celula>
            <Celula>{p.vendedor?.nome ?? '—'}</Celula>
            <Celula>
              <Status valor={p.status} />
            </Celula>
            <Celula className="text-right font-medium tabular-nums text-slate-900">{moeda(p.total)}</Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}
    </>
  );
}
