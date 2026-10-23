import { Suspense } from 'react';
import { PaginaLancamentos } from '@/components/pagina-lancamentos';

export default function ContasPagar() {
  return (
    <Suspense>
      <PaginaLancamentos tipo="PAGAR" />
    </Suspense>
  );
}
