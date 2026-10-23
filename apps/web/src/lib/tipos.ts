// Formatos devolvidos pela API. Valores decimais chegam como texto (ex.: "21.90").

export type Perfil = 'ADMIN' | 'GERENTE' | 'VENDEDOR' | 'FINANCEIRO' | 'ESTOQUISTA' | 'CAIXA';

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
  pedidoCompra: { id: string; numero: number } | null;
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
  pedidoCompra: { id: string; numero: number } | null;
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

// ─────────── PDV ───────────

export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'CREDIARIO';

export interface Caixa {
  id: string;
  numero: number;
  status: 'ABERTO' | 'FECHADO';
  valorAbertura: string;
  valorFechamento: string | null;
  valorEsperado: string | null;
  abertoEm: string;
  fechadoEm: string | null;
  observacoes: string | null;
  usuario: { id: string; nome: string };
  contaBancaria: { id: string; nome: string };
}

export interface CaixaDetalhado extends Caixa {
  movimentos: { id: string; tipo: 'SUPRIMENTO' | 'SANGRIA'; valor: string; motivo: string | null; createdAt: string }[];
  vendas: {
    id: string;
    numero: number;
    status: StatusPedido;
    total: string;
    createdAt: string;
    cliente: { id: string; nome: string };
    pagamentos: { forma: FormaPagamento; valor: string; troco: string }[];
  }[];
  resumo: {
    quantidadeVendas: number;
    totalVendas: number;
    ticketMedio: number;
    porForma: { forma: FormaPagamento; rotulo: string; valor: number }[];
    suprimentos: number;
    sangrias: number;
    dinheiroEsperado: number;
    diferenca: number | null;
  };
}

// ─────────── Compras ───────────

export type StatusCompra = 'RASCUNHO' | 'ENVIADO' | 'RECEBIDO' | 'CANCELADO';

export interface CompraResumo {
  id: string;
  numero: number;
  status: StatusCompra;
  total: string;
  previsaoEntrega: string | null;
  createdAt: string;
  fornecedor: { id: string; nome: string };
}

export interface Compra extends CompraResumo {
  fornecedorId: string;
  depositoId: string;
  subtotal: string;
  desconto: string;
  frete: string;
  parcelas: number;
  observacoes: string | null;
  recebidoEm: string | null;
  fornecedor: { id: string; nome: string; documento: string | null; telefone: string | null; email: string | null };
  deposito: { id: string; nome: string };
  itens: {
    id: string;
    produtoId: string;
    descricao: string;
    quantidade: string;
    custoUnitario: string;
    total: string;
    produto: { id: string; codigo: string; unidade: string };
  }[];
  lancamentos: { id: string; parcela: number; totalParcelas: number; valor: string; vencimento: string; status: StatusLancamento }[];
}

export interface SugestaoCompra {
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  custoUnitario: number;
  saldo: number;
  estoqueMinimo: number;
  jaPedido: number;
  sugerido: number;
}

// ─────────── CRM ───────────

export type EtapaOportunidade = 'PROSPECCAO' | 'QUALIFICACAO' | 'PROPOSTA' | 'NEGOCIACAO' | 'GANHO' | 'PERDIDO';
export type TipoAtividade = 'LIGACAO' | 'WHATSAPP' | 'EMAIL' | 'REUNIAO' | 'VISITA' | 'TAREFA' | 'NOTA';

export interface Oportunidade {
  id: string;
  titulo: string;
  pessoaId: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  valorEstimado: string;
  etapa: EtapaOportunidade;
  responsavelId: string | null;
  previsaoFechamento: string | null;
  origem: string | null;
  motivoPerda: string | null;
  observacoes: string | null;
  fechadaEm: string | null;
  createdAt: string;
  updatedAt: string;
  pessoa: { id: string; nome: string; telefone: string | null; email: string | null } | null;
  responsavel: { id: string; nome: string } | null;
  _count: { atividades: number };
}

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  descricao: string;
  agendadaPara: string | null;
  concluida: boolean;
  concluidaEm: string | null;
  createdAt: string;
  usuario: { id: string; nome: string };
  pessoa: { id: string; nome: string } | null;
  oportunidade: { id: string; titulo: string } | null;
}
