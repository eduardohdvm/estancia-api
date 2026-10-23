import { BadRequestException, Injectable } from '@nestjs/common';
import { EstoqueService } from '../estoque/estoque.service';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { ImportacaoDto, ImportacaoEstoqueDto, ImportacaoPessoasDto } from './importacao.dto';
import { booleano, emailValido, LinhaBruta, mapearColunas, normalizar, numero, soDigitos, texto } from './planilha';

/** O que acontece com cada linha da planilha. */
type Acao = 'criar' | 'atualizar' | 'erro';
interface Analise<D> {
  linha: number; // número da linha na planilha (a 1 é o cabeçalho)
  acao: Acao;
  resumo: string;
  erros: string[];
  dados?: D;
  id?: string; // registro existente, quando for atualização
}

const APELIDOS_PRODUTO = {
  codigo: ['codigo', 'cod', 'codigointerno', 'sku', 'referencia', 'ref'],
  nome: ['nome', 'nomedoproduto', 'produto', 'descricao'],
  codigoBarras: ['codigodebarras', 'codigobarras', 'ean', 'gtin', 'barras', 'codbarras'],
  categoria: ['categoria', 'grupo', 'departamento'],
  unidade: ['unidade', 'un', 'und', 'unid', 'unidadedemedida'],
  precoCusto: ['precodecusto', 'precocusto', 'custo', 'valorcusto', 'custounitario'],
  precoVenda: ['precodevenda', 'precovenda', 'preco', 'valorvenda', 'venda', 'valor'],
  estoqueMinimo: ['estoqueminimo', 'minimo', 'estmin', 'qtdminima'],
  servico: ['servico', 'eservico'],
  descricao: ['descricaocompleta', 'detalhes', 'observacao', 'observacoes'],
};

const APELIDOS_PESSOA = {
  nome: ['nome', 'razaosocial', 'nomerazaosocial', 'nomecompleto', 'cliente', 'fornecedor'],
  nomeFantasia: ['nomefantasia', 'fantasia', 'apelido'],
  documento: ['cpfcnpj', 'cnpjcpf', 'documento', 'cpf', 'cnpj', 'cpfoucnpj', 'doc'],
  tipo: ['tipo', 'tipopessoa', 'tipodepessoa', 'pessoa'],
  email: ['email', 'emailprincipal'],
  telefone: ['telefone', 'fone', 'celular', 'whatsapp', 'tel'],
  cep: ['cep'],
  endereco: ['endereco', 'logradouro', 'rua'],
  numero: ['numero', 'num', 'nro', 'n'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  uf: ['uf', 'estado'],
  observacoes: ['observacoes', 'observacao', 'obs'],
  ehCliente: ['ecliente', 'cliente'],
  ehFornecedor: ['efornecedor', 'fornecedor'],
};

const APELIDOS_ESTOQUE = {
  produto: ['codigo', 'cod', 'sku', 'referencia', 'codigodebarras', 'codigobarras', 'ean', 'produto'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'quant', 'saldo', 'estoque', 'estoqueatual'],
  custo: ['custo', 'custounitario', 'precodecusto', 'precocusto'],
  deposito: ['deposito', 'local', 'almoxarifado'],
};

const cabecalhos = (linhas: LinhaBruta[]) => [...new Set(linhas.flatMap((l) => Object.keys(l)))];

@Injectable()
export class ImportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  // ─────────── Produtos ───────────

  async produtos(empresaId: string, dto: ImportacaoDto) {
    const col = mapearColunas(cabecalhos(dto.linhas), APELIDOS_PRODUTO);
    if (!col.codigo || !col.nome) throw new BadRequestException('A planilha precisa das colunas "Código" e "Nome"');

    const existentes = new Map(
      (await this.prisma.produto.findMany({ where: { empresaId }, select: { id: true, codigo: true } })).map((p) => [p.codigo.toLowerCase(), p.id]),
    );
    const vistos = new Set<string>();
    const analises: Analise<Prisma.ProdutoUncheckedUpdateInput & { categoriaNome?: string }>[] = dto.linhas.map((l, i) => {
      const erros: string[] = [];
      const codigo = texto(l[col.codigo!]);
      const nome = texto(l[col.nome!]);
      if (!codigo) erros.push('Código vazio');
      if (!nome || nome.length < 2) erros.push('Nome vazio');
      if (codigo && vistos.has(codigo.toLowerCase())) erros.push(`Código "${codigo}" repetido na planilha`);
      if (codigo) vistos.add(codigo.toLowerCase());

      const dados: Prisma.ProdutoUncheckedUpdateInput & { categoriaNome?: string } = { codigo, nome };
      for (const campo of ['precoCusto', 'precoVenda', 'estoqueMinimo'] as const) {
        const coluna = col[campo];
        if (!coluna) continue;
        const valor = numero(l[coluna]);
        if (Number.isNaN(valor)) erros.push(`"${coluna}" não é um número`);
        else if (valor !== undefined && valor < 0) erros.push(`"${coluna}" não pode ser negativo`);
        else if (valor !== undefined) dados[campo] = valor;
      }
      if (col.servico) {
        const servico = booleano(l[col.servico]);
        if (servico === null) erros.push(`"${col.servico}" deve ser Sim ou Não`);
        else if (servico !== undefined) dados.servico = servico;
      }
      // Célula vazia não apaga o que já está cadastrado.
      const codigoBarras = col.codigoBarras ? texto(l[col.codigoBarras]) : undefined;
      if (codigoBarras) dados.codigoBarras = codigoBarras;
      const unidade = col.unidade ? texto(l[col.unidade]) : undefined;
      if (unidade) dados.unidade = unidade.toUpperCase().slice(0, 6);
      const descricao = col.descricao ? texto(l[col.descricao]) : undefined;
      if (descricao) dados.descricao = descricao;
      if (col.categoria) dados.categoriaNome = texto(l[col.categoria]);

      const id = codigo ? existentes.get(codigo.toLowerCase()) : undefined;
      return { linha: i + 2, acao: erros.length ? 'erro' : id ? 'atualizar' : 'criar', resumo: `${codigo ?? '?'} — ${nome ?? '?'}`, erros, dados, id };
    });

    if (dto.simular) return resultado(analises, true);

    await this.prisma.$transaction(
      async (tx) => {
        const categorias = new Map(
          (await tx.categoria.findMany({ where: { empresaId } })).map((c) => [normalizar(c.nome), c.id]),
        );
        for (const a of analises.filter((a) => a.acao !== 'erro')) {
          const { categoriaNome, ...dados } = a.dados!;
          if (categoriaNome) {
            let categoriaId = categorias.get(normalizar(categoriaNome));
            if (!categoriaId) {
              categoriaId = (await tx.categoria.create({ data: { empresaId, nome: categoriaNome } })).id;
              categorias.set(normalizar(categoriaNome), categoriaId);
            }
            dados.categoriaId = categoriaId;
          }
          if (a.id) await tx.produto.update({ where: { id: a.id }, data: dados });
          else await tx.produto.create({ data: { ...(dados as Prisma.ProdutoUncheckedCreateInput), empresaId } });
        }
      },
      { timeout: 120_000 },
    );
    return resultado(analises, false);
  }

  // ─────────── Clientes e fornecedores ───────────

  async pessoas(empresaId: string, dto: ImportacaoPessoasDto) {
    const col = mapearColunas(cabecalhos(dto.linhas), APELIDOS_PESSOA);
    if (!col.nome) throw new BadRequestException('A planilha precisa da coluna "Nome" (ou "Razão social")');

    const atuais = await this.prisma.pessoa.findMany({ where: { empresaId }, select: { id: true, nome: true, documento: true } });
    const porDocumento = new Map(atuais.filter((p) => p.documento).map((p) => [soDigitos(p.documento!), p.id]));
    const porNome = new Map(atuais.map((p) => [normalizar(p.nome), p.id]));
    const vistos = new Set<string>();

    const analises: Analise<Prisma.PessoaUncheckedUpdateInput>[] = dto.linhas.map((l, i) => {
      const erros: string[] = [];
      const nome = texto(l[col.nome!]);
      if (!nome || nome.length < 2) erros.push('Nome vazio');

      const documento = col.documento ? texto(l[col.documento]) : undefined;
      const digitos = documento ? soDigitos(documento) : '';
      if (documento && digitos.length !== 11 && digitos.length !== 14) erros.push(`CPF/CNPJ "${documento}" deve ter 11 ou 14 dígitos`);
      const chave = digitos || (nome ? `nome:${normalizar(nome)}` : '');
      if (chave && vistos.has(chave)) erros.push(digitos ? `CPF/CNPJ repetido na planilha` : `Nome repetido na planilha (sem CPF/CNPJ)`);
      if (chave) vistos.add(chave);

      // Tipo: coluna "Tipo" (PF/PJ, Física/Jurídica) ou pelo tamanho do documento.
      const tipoTexto = col.tipo ? normalizar(texto(l[col.tipo]) ?? '') : '';
      const tipo = ['pj', 'juridica', 'j', 'empresa'].includes(tipoTexto) || (!tipoTexto && digitos.length === 14) ? 'JURIDICA' : 'FISICA';

      // Célula vazia não apaga o que já está cadastrado: só entram os valores preenchidos.
      const dados: Prisma.PessoaUncheckedUpdateInput = { nome, tipo };
      if (documento) dados.documento = documento;
      for (const campo of ['nomeFantasia', 'telefone', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'observacoes'] as const) {
        const valor = col[campo] ? texto(l[col[campo]!]) : undefined;
        if (valor !== undefined) dados[campo] = valor;
      }
      const email = col.email ? texto(l[col.email]) : undefined;
      if (email && !emailValido(email)) erros.push(`E-mail "${email}" inválido`);
      if (email) dados.email = email.toLowerCase();
      const uf = col.uf ? texto(l[col.uf])?.toUpperCase() : undefined;
      if (uf && !/^[A-Z]{2}$/.test(uf)) erros.push(`UF "${uf}" deve ter 2 letras`);
      if (uf) dados.uf = uf;

      const id = (digitos && porDocumento.get(digitos)) || (!digitos && nome ? porNome.get(normalizar(nome)) : undefined);

      // Cliente/fornecedor: pelas colunas da planilha ou pelo papel escolhido na tela.
      // Sem as colunas, quem já existe só ganha o papel novo (um cliente importado como fornecedor continua cliente).
      const cliente = col.ehCliente ? booleano(l[col.ehCliente]) : undefined;
      const fornecedor = col.ehFornecedor ? booleano(l[col.ehFornecedor]) : undefined;
      if (cliente === null || fornecedor === null) erros.push('As colunas "Cliente"/"Fornecedor" devem ser Sim ou Não');
      if (cliente !== undefined && cliente !== null) dados.cliente = cliente;
      if (fornecedor !== undefined && fornecedor !== null) dados.fornecedor = fornecedor;
      if (cliente === undefined && fornecedor === undefined) {
        const papelFornecedor = dto.papel === 'fornecedor';
        if (id) dados[papelFornecedor ? 'fornecedor' : 'cliente'] = true;
        else Object.assign(dados, { cliente: !papelFornecedor, fornecedor: papelFornecedor });
      }
      return { linha: i + 2, acao: erros.length ? 'erro' : id ? 'atualizar' : 'criar', resumo: `${nome ?? '?'}${documento ? ` — ${documento}` : ''}`, erros, dados, id };
    });

    if (dto.simular) return resultado(analises, true);

    await this.prisma.$transaction(
      async (tx) => {
        for (const a of analises.filter((a) => a.acao !== 'erro')) {
          if (a.id) await tx.pessoa.update({ where: { id: a.id }, data: a.dados! });
          else await tx.pessoa.create({ data: { ...(a.dados as Prisma.PessoaUncheckedCreateInput), empresaId } });
        }
      },
      { timeout: 120_000 },
    );
    return resultado(analises, false);
  }

  // ─────────── Estoque ───────────

  async estoqueInicial(empresaId: string, usuarioId: string, dto: ImportacaoEstoqueDto) {
    const col = mapearColunas(cabecalhos(dto.linhas), APELIDOS_ESTOQUE);
    if (!col.produto || !col.quantidade) throw new BadRequestException('A planilha precisa das colunas "Código" e "Quantidade"');

    const produtos = await this.prisma.produto.findMany({
      where: { empresaId },
      select: { id: true, codigo: true, codigoBarras: true, nome: true, servico: true },
    });
    const porCodigo = new Map<string, (typeof produtos)[number]>();
    for (const p of produtos) {
      porCodigo.set(p.codigo.toLowerCase(), p);
      if (p.codigoBarras) porCodigo.set(p.codigoBarras.toLowerCase(), p);
    }
    const depositos = await this.prisma.deposito.findMany({ where: { empresaId }, orderBy: { padrao: 'desc' } });
    if (!depositos.length) throw new BadRequestException('Cadastre um depósito antes de importar o estoque');
    const vistos = new Set<string>();

    const analises: Analise<{ produtoId: string; depositoId: string; quantidade: number; custoUnitario?: number }>[] = dto.linhas.map((l, i) => {
      const erros: string[] = [];
      const codigo = texto(l[col.produto!]);
      const produto = codigo ? porCodigo.get(codigo.toLowerCase()) : undefined;
      if (!codigo) erros.push('Código do produto vazio');
      else if (!produto) erros.push(`Produto "${codigo}" não cadastrado`);
      else if (produto.servico) erros.push(`"${produto.nome}" é um serviço e não tem estoque`);

      const quantidade = numero(l[col.quantidade!]);
      if (quantidade === undefined || Number.isNaN(quantidade)) erros.push('Quantidade vazia ou inválida');
      else if (quantidade < 0) erros.push('Quantidade não pode ser negativa');

      const custo = col.custo ? numero(l[col.custo]) : undefined;
      if (Number.isNaN(custo)) erros.push('Custo inválido');

      const nomeDeposito = col.deposito ? texto(l[col.deposito]) : undefined;
      const deposito = nomeDeposito ? depositos.find((d) => normalizar(d.nome) === normalizar(nomeDeposito)) : depositos[0];
      if (!deposito) erros.push(`Depósito "${nomeDeposito}" não cadastrado`);

      const chave = `${produto?.id}:${deposito?.id}`;
      if (produto && deposito && vistos.has(chave)) erros.push('Produto repetido na planilha para o mesmo depósito');
      vistos.add(chave);

      const ok = !erros.length;
      return {
        linha: i + 2,
        acao: ok ? 'atualizar' : 'erro',
        resumo: `${produto?.nome ?? codigo ?? '?'}: ${dto.modo === 'AJUSTE' ? 'saldo' : '+'} ${quantidade ?? '?'}${deposito && depositos.length > 1 ? ` (${deposito.nome})` : ''}`,
        erros,
        dados: ok ? { produtoId: produto!.id, depositoId: deposito!.id, quantidade: quantidade!, custoUnitario: custo || undefined } : undefined,
      };
    });

    if (dto.simular) return resultado(analises, true);

    await this.prisma.$transaction(
      async (tx: Tx) => {
        for (const a of analises.filter((a) => a.acao !== 'erro')) {
          const { custoUnitario, ...m } = a.dados!;
          await this.estoque.movimentar(tx, {
            ...m,
            empresaId,
            usuarioId,
            tipo: dto.modo,
            custoUnitario,
            observacao: dto.modo === 'AJUSTE' ? 'Importação de planilha (inventário)' : 'Importação de planilha (entrada)',
          });
          if (custoUnitario) await tx.produto.update({ where: { id: m.produtoId }, data: { precoCusto: custoUnitario } });
        }
      },
      { timeout: 120_000 },
    );
    return resultado(analises, false);
  }
}

/** Resumo devolvido para a tela: contagens, erros e uma amostra das linhas. */
function resultado<D>(analises: Analise<D>[], simulado: boolean) {
  const contar = (acao: Acao) => analises.filter((a) => a.acao === acao).length;
  return {
    simulado,
    total: analises.length,
    criar: contar('criar'),
    atualizar: contar('atualizar'),
    comErro: contar('erro'),
    erros: analises.filter((a) => a.acao === 'erro').map(({ linha, resumo, erros }) => ({ linha, resumo, erros })),
    amostra: analises.slice(0, 100).map(({ linha, acao, resumo }) => ({ linha, acao, resumo })),
  };
}
