'use client';

import { useParams } from 'next/navigation';
import { FormularioPedido } from '@/components/formulario-pedido';
import { Alerta, Cabecalho } from '@/components/ui';
import type { Pedido } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function EditarPedido() {
  const { id } = useParams<{ id: string }>();
  const { dados, erro } = useDados<Pedido>(`/pedidos/${id}`);

  return (
    <>
      <Cabecalho titulo={dados ? `Editar pedido #${dados.numero}` : 'Editar pedido'} />
      <Alerta>{erro}</Alerta>
      {dados && <FormularioPedido pedido={dados} />}
    </>
  );
}
