'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alerta, Busca, Cabecalho, Celula, Paginacao, Selecao, Status, Tabela } from '@/components/ui';
import { qs } from '@/lib/api';
import { data, dataHora, moeda } from '@/lib/formato';
import type { CompraResumo, Paginado } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function PaginaCompras() {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const { dados, erro, carregando } = useDados<Paginado<CompraResumo>>(`/compras${qs({ busca, status, pagina })}`);

  return (
    <>
      <Cabecalho titulo="Compras" descricao="Pedidos de compra a fornecedores e recebimento de mercadorias">
        <Link href="/compras/novo" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="size-4" /> Novo pedido de compra
        </Link>
      </Cabecalho>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Busca valor={busca} aoMudar={(v) => (setBusca(v), setPagina(1))} placeholder="Número ou fornecedor" />
        <Selecao value={status} onChange={(e) => (setStatus(e.target.value), setPagina(1))} className="sm:w-52">
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunhos</option>
          <option value="ENVIADO">Aguardando entrega</option>
          <option value="RECEBIDO">Recebidos</option>
          <option value="CANCELADO">Cancelados</option>
        </Selecao>
      </div>
      <Alerta>{erro}</Alerta>

      <Tabela cabecalhos={['Nº', 'Data', 'Fornecedor', 'Previsão de entrega', 'Status', 'Total']} vazio={dados?.itens.length === 0} carregando={carregando && !dados}>
        {dados?.itens.map((c) => (
          <tr key={c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => router.push(`/compras/ver?id=${c.id}`)}>
            <Celula className="font-medium text-slate-900">#{c.numero}</Celula>
            <Celula className="text-slate-500">{dataHora(c.createdAt)}</Celula>
            <Celula>{c.fornecedor.nome}</Celula>
            <Celula>{data(c.previsaoEntrega)}</Celula>
            <Celula>
              <Status valor={c.status} />
            </Celula>
            <Celula className="text-right font-medium tabular-nums text-slate-900">{moeda(c.total)}</Celula>
          </tr>
        ))}
      </Tabela>
      {dados && <Paginacao pagina={dados.pagina} paginas={dados.paginas} total={dados.total} aoMudar={setPagina} />}
    </>
  );
}
