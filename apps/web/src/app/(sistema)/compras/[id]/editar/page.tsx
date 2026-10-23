'use client';

import { useParams } from 'next/navigation';
import { FormularioCompra } from '@/components/formulario-compra';
import { Alerta, Cabecalho } from '@/components/ui';
import type { Compra } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function EditarCompra() {
  const { id } = useParams<{ id: string }>();
  const { dados, erro } = useDados<Compra>(`/compras/${id}`);

  return (
    <>
      <Cabecalho titulo={dados ? `Editar compra #${dados.numero}` : 'Editar compra'} />
      <Alerta>{erro}</Alerta>
      {dados && <FormularioCompra compra={dados} />}
    </>
  );
}
