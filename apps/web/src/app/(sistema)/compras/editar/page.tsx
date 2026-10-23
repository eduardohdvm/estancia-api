'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FormularioCompra } from '@/components/formulario-compra';
import { Alerta, Cabecalho } from '@/components/ui';
import type { Compra } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

function EditarCompra() {
  const id = useSearchParams().get('id') ?? '';
  const { dados, erro } = useDados<Compra>(`/compras/${id}`);

  return (
    <>
      <Cabecalho titulo={dados ? `Editar compra #${dados.numero}` : 'Editar compra'} />
      <Alerta>{erro}</Alerta>
      {dados && <FormularioCompra compra={dados} />}
    </>
  );
}

// O id vem do endereço (?id=...), o que permite publicar o site como arquivos estáticos.
export default function Pagina() {
  return (
    <Suspense>
      <EditarCompra />
    </Suspense>
  );
}
