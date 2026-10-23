'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FormularioPedido } from '@/components/formulario-pedido';
import { Cabecalho } from '@/components/ui';

export default function NovoPedido() {
  return (
    <>
      <Cabecalho titulo="Novo pedido" descricao="O pedido começa como orçamento e pode ser aprovado e faturado depois" />
      <Suspense>
        <FormularioComCliente />
      </Suspense>
    </>
  );
}

/** `?cliente=<id>` já deixa o cliente escolhido (ex.: vindo de um negócio ganho no CRM). */
function FormularioComCliente() {
  return <FormularioPedido clienteInicial={useSearchParams().get('cliente') ?? undefined} />;
}
