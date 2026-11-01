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
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  codigoMunicipio: string | null;
  uf: string | null;
  inscricaoEstadual: string | null;
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
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  csosn: string | null;
  origem: number;
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
  origem: 'PEDIDO' | 'PDV' | 'CATALOGO';
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
  notas: { id: string; modelo: ModeloNota; serie: number; numero: number; status: StatusNota; chave: string; ambiente: AmbienteFiscal; motivo: string | null; codigoStatus: number | null }[];
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

// ─────────── Fiscal ───────────

export type AmbienteFiscal = 'SIMULACAO' | 'HOMOLOGACAO' | 'PRODUCAO';
export type ModeloNota = 'NFE' | 'NFCE';
export type StatusNota = 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA' | 'DENEGADA';

export interface ConfiguracaoFiscal {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string | null;
  cnae: string | null;
  crt: number;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string | null;
  ambiente: AmbienteFiscal;
  serieNfe: number;
  proximoNumeroNfe: number;
  serieNfce: number;
  proximoNumeroNfce: number;
  cfopPadrao: string;
  csosnPadrao: string;
  informacoesAdicionais: string | null;
  emitirNfceNoPdv: boolean;
  cscId: string | null;
  cscConfigurado: boolean;
  certificado: { titular: string; validade: string; diasRestantes: number } | null;
  transmissaoDisponivel: { nfe: boolean; nfce: boolean };
  responsavelTecnicoConfigurado: boolean;
}

export interface NotaFiscal {
  id: string;
  modelo: ModeloNota;
  serie: number;
  numero: number;
  chave: string;
  ambiente: AmbienteFiscal;
  status: StatusNota;
  destinatarioNome: string | null;
  destinatarioDocumento: string | null;
  valorTotal: string;
  protocolo: string | null;
  codigoStatus: number | null;
  motivo: string | null;
  qrCode: string | null;
  urlConsulta: string | null;
  autorizadaEm: string | null;
  canceladaEm: string | null;
  justificativaCancelamento: string | null;
  createdAt: string;
  temXmlAutorizado: boolean;
  pedido: { id: string; numero: number; origem: 'PEDIDO' | 'PDV' } | null;
  xml?: string;
}
