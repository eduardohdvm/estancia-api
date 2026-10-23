import { FormularioCompra } from '@/components/formulario-compra';
import { Cabecalho } from '@/components/ui';

export default function NovaCompra() {
  return (
    <>
      <Cabecalho titulo="Novo pedido de compra" descricao="Use a sugestão de compra para trazer os produtos abaixo do estoque mínimo" />
      <FormularioCompra />
    </>
  );
}
