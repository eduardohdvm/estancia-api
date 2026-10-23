import { FormularioPedido } from '@/components/formulario-pedido';
import { Cabecalho } from '@/components/ui';

export default function NovoPedido() {
  return (
    <>
      <Cabecalho titulo="Novo pedido" descricao="O pedido começa como orçamento e pode ser aprovado e faturado depois" />
      <FormularioPedido />
    </>
  );
}
