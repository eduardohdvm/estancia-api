import { Suspense } from 'react';
import { PaginaLancamentos } from '@/components/pagina-lancamentos';

export default function ContasReceber() {
  return (
    <Suspense>
      <PaginaLancamentos tipo="RECEBER" />
    </Suspense>
  );
}
