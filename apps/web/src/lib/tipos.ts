// Formatos devolvidos pela API. Valores decimais chegam como texto (ex.: "21.90").

export type Perfil = 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'FINANCEIRO' | 'ESTOQUISTA';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  empresa: { id: string; nome: string; plano: string };
}

export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  porPagina: number;
  paginas: number;
}

export interface Pessoa {
  id: string;
  tipo: 'FISICA' | 'JURIDICA';
  nome: string;
  nomeFantasia: string | null;
  documento: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  observacoes: string | null;
  cliente: boolean;
  fornecedor: boolean;
  ativo: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  _count?: { produtos: number };
}

export interface Deposito {
  id: string;
  nome: string;
  padrao: boolean;
}

export interface Produto {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  nome: string;
  descricao: string | null;
  unidade: string;
  precoCusto: string;
  precoVenda: string;
  estoqueMinimo: string;
  servico: boolean;
  ativo: boolean;
  categoriaId: string | null;
  categoria: { id: string; nome: string } | null;
  estoques: { quantidade: string; deposito: { id: string; nome: string } }[];
  saldo: number;
  estoqueBaixo: boolean;
}

export type TipoMovimento = 'ENTRADA' | 'SAIDA' | 'AJUSTE';

export interface MovimentoEstoque {
  id: string;
  tipo: TipoMovimento;
  quantidade: string;
  saldoAnterior: string;
  saldoNovo: string;
  custoUnitario: string | null;
  observacao: string | null;
  createdAt: string;
  produto: { id: string; codigo: string; nome: string; unidade: string };
  deposito: { id: string; nome: string };
  pedido: { id: string; numero: number } | null;
}

export type StatusPedido = 'ORCAMENTO' | 'APROVADO' | 'FATURADO' | 'CANCELADO';

export interface PedidoResumo {
  id: string;
  numero: number;
  status: StatusPedido;
  total: string;
  createdAt: string;
  cliente: { id: string; nome: string };
  vendedor: { id: string; nome: string } | null;
}

export interface Pedido extends PedidoResumo {
  cliente: { id: string; nome: string; documento: string | null };
  clienteId: string;
  depositoId: string;
  subtotal: string;
  desconto: string;
  frete: string;
  parcelas: number;
  observacoes: string | null;
  faturadoEm: string | null;
  deposito: { id: string; nome: string };
  itens: {
    id: string;
    produtoId: string;
    descricao: string;
    quantidade: string;
    precoUnitario: string;
    desconto: string;
    total: string;
    produto: { id: string; codigo: string; unidade: string; servico: boolean };
  }[];
  lancamentos: { id: string; parcela: number; totalParcelas: number; valor: string; vencimento: string; status: StatusLancamento }[];
}

export type TipoLancamento = 'PAGAR' | 'RECEBER';
export type StatusLancamento = 'ABERTO' | 'PAGO' | 'CANCELADO';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  status: StatusLancamento;
  descricao: string;
  valor: string;
  valorPago: string | null;
  vencimento: string;
  pagoEm: string | null;
  parcela: number;
  totalParcelas: number;
  observacoes: string | null;
  pessoaId: string | null;
  categoriaId: string | null;
  contaBancariaId: string | null;
  pessoa: { id: string; nome: string } | null;
  categoria: { id: string; nome: string } | null;
  contaBancaria: { id: string; nome: string } | null;
  pedido: { id: string; numero: number } | null;
}

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  saldoInicial: string;
  saldoAtual: number;
  ativa: boolean;
}

export interface CategoriaFinanceira {
  id: string;
  nome: string;
  tipo: TipoLancamento;
}

export interface UsuarioEmpresa {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  createdAt: string;
}
