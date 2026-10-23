'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FormularioPedido } from '@/components/formulario-pedido';
import { Alerta, Cabecalho } from '@/components/ui';
import type { Pedido } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

function EditarPedido() {
  const id = useSearchParams().get('id') ?? '';
  const { dados, erro } = useDados<Pedido>(`/pedidos/${id}`);

  return (
    <>
      <Cabecalho titulo={dados ? `Editar pedido #${dados.numero}` : 'Editar pedido'} />
      <Alerta>{erro}</Alerta>
      {dados && <FormularioPedido pedido={dados} />}
    </>
  );
}

// O id vem do endereço (?id=...), o que permite publicar o site como arquivos estáticos.
export default function Pagina() {
  return (
    <Suspense>
      <EditarPedido />
    </Suspense>
  );
}
