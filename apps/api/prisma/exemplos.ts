// Gera seis meses de histórico para a empresa de demonstração: produtos, clientes,
// compras, vendas, PDV, despesas e CRM, com datas no passado e tudo coerente entre si
// (o saldo de estoque bate com as movimentações e cada venda tem seus lançamentos).
// Roda uma única vez: o seed só chama quando a empresa ainda não tem nenhum pedido.
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client';
import type { FormaPagamento } from '../src/generated/prisma/enums';

type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

// Sorteio com semente fixa: os dados saem iguais em toda execução.
let semente = 20261023;
function sorteio() {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const inteiro = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
const escolher = <T>(lista: T[]) => lista[Math.floor(sorteio() * lista.length)];
const centavos = (v: number) => Math.round(v * 100) / 100;

const AGORA = new Date();
/** Momento `dias` atrás, em horário comercial. Negativo = no futuro. */
function diasAtras(dias: number, hora = inteiro(8, 18), minuto = inteiro(0, 59)) {
  const d = new Date(AGORA);
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, 0, 0);
  return d;
}
/** Só a data (meia-noite UTC), para colunas do tipo date. */
const soData = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const somarDias = (d: Date, dias: number) => new Date(d.getTime() + dias * 86_400_000);
const HOJE = soData(AGORA);

const PRODUTOS = [
  // código, nome, categoria, unidade, custo, venda, mínimo
  ['001', 'Café torrado 500g', 'Mercearia', 'UN', 12.5, 21.9, 10],
  ['002', 'Açúcar refinado 1kg', 'Mercearia', 'UN', 3.8, 5.99, 20],
  ['003', 'Refrigerante 2L', 'Bebidas', 'UN', 6, 9.49, 24],
  ['004', 'Água mineral 500ml', 'Bebidas', 'UN', 0.9, 2.5, 48],
  ['005', 'Suco de uva integral 1L', 'Bebidas', 'UN', 6.5, 11.9, 12],
  ['006', 'Cerveja lata 350ml', 'Bebidas', 'UN', 2.9, 4.99, 48],
  ['007', 'Energético 250ml', 'Bebidas', 'UN', 5.2, 9.9, 12],
  ['008', 'Arroz tipo 1 5kg', 'Mercearia', 'UN', 19.9, 29.9, 15],
  ['009', 'Feijão carioca 1kg', 'Mercearia', 'UN', 6.8, 9.99, 20],
  ['010', 'Óleo de soja 900ml', 'Mercearia', 'UN', 5.9, 8.49, 20],
  ['011', 'Macarrão espaguete 500g', 'Mercearia', 'UN', 3.1, 4.99, 25],
  ['012', 'Farinha de trigo 1kg', 'Mercearia', 'UN', 4.2, 6.49, 10],
  ['013', 'Leite integral 1L', 'Mercearia', 'UN', 3.9, 5.79, 36],
  ['014', 'Detergente 500ml', 'Limpeza', 'UN', 1.6, 2.99, 24],
  ['015', 'Sabão em pó 1kg', 'Limpeza', 'UN', 9.5, 15.9, 10],
  ['016', 'Água sanitária 2L', 'Limpeza', 'UN', 4.1, 6.99, 12],
  ['017', 'Papel higiênico 12 rolos', 'Higiene', 'PC', 14.9, 22.9, 10],
  ['018', 'Sabonete 90g', 'Higiene', 'UN', 1.4, 2.79, 30],
  ['019', 'Creme dental 90g', 'Higiene', 'UN', 3.2, 5.49, 20],
  ['020', 'Shampoo 350ml', 'Higiene', 'UN', 8.9, 15.9, 8],
] as const;

const CLIENTES = [
  { nome: 'Ana Paula Ferreira', documento: '333.333.333-33', telefone: '(11) 98888-1001', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Carlos Eduardo Lima', documento: '444.444.444-44', telefone: '(11) 98888-1002', cidade: 'Guarulhos', uf: 'SP' },
  { nome: 'Fernanda Costa', documento: '555.555.555-55', telefone: '(11) 98888-1003', email: 'fernanda@email.com', cidade: 'São Paulo', uf: 'SP' },
  { nome: 'Juliana Mendes', documento: '666.666.666-66', telefone: '(19) 98888-1004', cidade: 'Campinas', uf: 'SP' },
  { nome: 'Roberto Alves', documento: '777.777.777-77', telefone: '(11) 98888-1005', cidade: 'Osasco', uf: 'SP' },
  { tipo: 'JURIDICA' as const, nome: 'Restaurante Sabor Caseiro Ltda', nomeFantasia: 'Sabor Caseiro', documento: '33.333.333/0001-33', telefone: '(11) 3333-2001', email: 'compras@saborcaseiro.com.br', cidade: 'São Paulo', uf: 'SP' },
  { tipo: 'JURIDICA' as const, nome: 'Padaria Pão Quente ME', nomeFantasia: 'Pão Quente', documento: '44.444.444/0001-44', telefone: '(11) 3333-2002', cidade: 'São Paulo', uf: 'SP' },
  { tipo: 'JURIDICA' as const, nome: 'Lanchonete do Zé Ltda', nomeFantasia: 'Lanchonete do Zé', documento: '55.555.555/0001-55', telefone: '(11) 3333-2003', cidade: 'Santo André', uf: 'SP' },
  { tipo: 'JURIDICA' as const, nome: 'Mercadinho São Jorge Ltda', nomeFantasia: 'São Jorge', documento: '66.666.666/0001-66', telefone: '(11) 3333-2004', cidade: 'São Bernardo do Campo', uf: 'SP' },
];

const FORNECEDORES = [
  { nome: 'Atacadão Central Ltda', documento: '77.777.777/0001-77', telefone: '(11) 4004-3001', email: 'vendas@atacadaocentral.com.br', cidade: 'São Paulo', uf: 'SP', categorias: ['Mercearia'] },
  { nome: 'Bebidas Rio Distribuidora Ltda', documento: '88.888.888/0001-88', telefone: '(21) 4004-3002', email: 'pedidos@bebidasrio.com.br', cidade: 'Rio de Janeiro', uf: 'RJ', categorias: ['Bebidas'] },
  { nome: 'Limpa Bem Distribuidora Ltda', documento: '99.999.999/0001-99', telefone: '(11) 4004-3003', cidade: 'Barueri', uf: 'SP', categorias: ['Limpeza', 'Higiene'] },
];

export async function popularExemplos(tx: Tx, empresaId: string) {
  // ─────────── Cadastros ───────────

  const senhaHash = await bcrypt.hash('demo123', 10);
  for (const [email, nome, perfil] of [
    ['gerente@demo.com', 'Gerente Demo', 'GERENTE'],
    ['financeiro@demo.com', 'Financeiro Demo', 'FINANCEIRO'],
    ['estoque@demo.com', 'Estoquista Demo', 'ESTOQUISTA'],
    ['caixa@demo.com', 'Operador de Caixa Demo', 'CAIXA'],
  ] as const) {
    if (!(await tx.usuario.findUnique({ where: { email } }))) {
      await tx.usuario.create({ data: { empresaId, email, nome, perfil, senhaHash } });
    }
  }
  const usuarios = await tx.usuario.findMany({ where: { empresaId } });
  const porEmail = (email: string) => usuarios.find((u) => u.email === email) ?? usuarios[0];
  const admin = porEmail('admin@demo.com');
  const vendedor = porEmail('vendedor@demo.com');
  const operador = porEmail('caixa@demo.com');

  const categorias = new Map<string, string>();
  for (const nome of ['Bebidas', 'Mercearia', 'Limpeza', 'Higiene']) {
    const c = await tx.categoria.upsert({
      where: { empresaId_nome: { empresaId, nome } },
      create: { empresaId, nome },
      update: {},
    });
    categorias.set(nome, c.id);
  }

  const deposito = await tx.deposito.findFirstOrThrow({ where: { empresaId }, orderBy: { padrao: 'desc' } });
  const caixa = await tx.contaBancaria.findFirstOrThrow({ where: { empresaId }, orderBy: { createdAt: 'asc' } });
  const banco =
    (await tx.contaBancaria.findFirst({ where: { empresaId, nome: 'Banco do Brasil' } })) ??
    (await tx.contaBancaria.create({
      data: { empresaId, nome: 'Banco do Brasil', banco: '001', agencia: '1234-5', conta: '98765-0', saldoInicial: 25000 },
    }));
  const catFin = async (nome: string, tipo: 'PAGAR' | 'RECEBER') =>
    (await tx.categoriaFinanceira.findFirstOrThrow({ where: { empresaId, nome, tipo } })).id;
  const catVendas = await catFin('Vendas', 'RECEBER');
  const catFornecedores = await catFin('Fornecedores', 'PAGAR');

  // Produtos: os que já existem ganham categoria e código de barras; os outros são criados.
  const inicio = diasAtras(182, 8, 0);
  const produtos: { id: string; codigo: string; nome: string; categoria: string; custo: number; venda: number; minimo: number; servico: boolean }[] = [];
  const saldo = new Map<string, number>();
  const movimentos: Prisma.MovimentoEstoqueCreateManyInput[] = [];
  const mover = (produtoId: string, tipo: 'ENTRADA' | 'SAIDA', quantidade: number, data: Date, extra: { observacao: string; custoUnitario?: number; pedidoId?: string; pedidoCompraId?: string; usuarioId?: string }) => {
    const anterior = saldo.get(produtoId) ?? 0;
    const novo = tipo === 'ENTRADA' ? anterior + quantidade : anterior - quantidade;
    saldo.set(produtoId, novo);
    movimentos.push({ empresaId, produtoId, depositoId: deposito.id, tipo, quantidade, saldoAnterior: anterior, saldoNovo: novo, createdAt: data, ...extra });
  };

  for (const [codigo, nome, categoria, unidade, custo, venda, minimo] of PRODUTOS) {
    const dados = {
      nome,
      unidade,
      categoriaId: categorias.get(categoria),
      codigoBarras: `7891000${codigo.padStart(6, '0')}`,
      precoCusto: custo,
      precoVenda: venda,
      estoqueMinimo: minimo,
    };
    const produto = await tx.produto.upsert({
      where: { empresaId_codigo: { empresaId, codigo } },
      create: { ...dados, empresaId, codigo, createdAt: inicio },
      update: dados,
    });
    produtos.push({ id: produto.id, codigo, nome, categoria, custo, venda, minimo, servico: false });
  }
  const servicos = [];
  for (const [codigo, nome, preco] of [['S01', 'Entrega em domicílio', 10], ['S02', 'Montagem de cesta básica', 15]] as const) {
    servicos.push(
      await tx.produto.upsert({
        where: { empresaId_codigo: { empresaId, codigo } },
        create: { empresaId, codigo, nome, servico: true, precoVenda: preco, createdAt: inicio },
        update: {},
      }),
    );
  }

  // O estoque recomeça com uma carga inicial há seis meses; o histórico antigo do seed sai.
  await tx.movimentoEstoque.deleteMany({ where: { empresaId, pedidoId: null, pedidoCompraId: null } });
  for (const p of produtos) mover(p.id, 'ENTRADA', p.minimo * 6, inicio, { observacao: 'Estoque inicial', custoUnitario: p.custo });

  for (const c of CLIENTES) {
    await tx.pessoa.upsert({
      where: { empresaId_documento: { empresaId, documento: c.documento } },
      create: { ...c, empresaId, createdAt: diasAtras(inteiro(60, 180)) },
      update: {},
    });
  }
  const fornecedores = [];
  for (const { categorias: cats, ...f } of FORNECEDORES) {
    const p = await tx.pessoa.upsert({
      where: { empresaId_documento: { empresaId, documento: f.documento } },
      create: { ...f, tipo: 'JURIDICA', cliente: false, fornecedor: true, empresaId, createdAt: inicio },
      update: {},
    });
    fornecedores.push({ ...p, cats });
  }
  const clientes = await tx.pessoa.findMany({ where: { empresaId, cliente: true, NOT: { nome: 'Consumidor final' } } });
  const empresas = clientes.filter((c) => c.tipo === 'JURIDICA');
  const consumidor =
    (await tx.pessoa.findFirst({ where: { empresaId, nome: 'Consumidor final', documento: null } })) ??
    (await tx.pessoa.create({ data: { empresaId, nome: 'Consumidor final' } }));

  // ─────────── Linha do tempo ───────────
  // Os eventos são processados em ordem de data, para o estoque e a numeração ficarem corretos.

  type Evento = { data: Date; executar: () => Promise<void> };
  const eventos: Evento[] = [];
  let numeroPedido = ((await tx.pedidoVenda.aggregate({ where: { empresaId }, _max: { numero: true } }))._max.numero ?? 0) + 1;
  let numeroCompra = ((await tx.pedidoCompra.aggregate({ where: { empresaId }, _max: { numero: true } }))._max.numero ?? 0) + 1;
  let numeroCaixa = ((await tx.caixa.aggregate({ where: { empresaId }, _max: { numero: true } }))._max.numero ?? 0) + 1;

  /** Parcelas de um título: pagas se já venceram (a maioria), em aberto se não. */
  function parcelas(total: number, n: number, primeiroVencimento: Date, chanceAtraso: number) {
    const valor = centavos(total / n);
    return Array.from({ length: n }, (_, i) => {
      const vencimento = somarDias(primeiroVencimento, 30 * i);
      const pago = vencimento < HOJE && sorteio() > chanceAtraso;
      return {
        parcela: i + 1,
        totalParcelas: n,
        valor: i === n - 1 ? centavos(total - valor * (n - 1)) : valor,
        vencimento,
        status: pago ? ('PAGO' as const) : ('ABERTO' as const),
        valorPago: pago ? (i === n - 1 ? centavos(total - valor * (n - 1)) : valor) : null,
        pagoEm: pago ? somarDias(vencimento, -inteiro(0, 3)) : null,
      };
    });
  }

  // Compras: a cada ~12 dias, cada fornecedor repõe o que estiver abaixo de 4x o mínimo.
  for (let dia = 172; dia >= 8; dia -= inteiro(10, 14)) {
    for (const f of fornecedores) {
      eventos.push({
        data: diasAtras(dia, 9),
        executar: async () => {
          const itens = produtos
            .filter((p) => f.cats.includes(p.categoria) && (saldo.get(p.id) ?? 0) < p.minimo * 4)
            .map((p) => ({ p, quantidade: p.minimo * 8, custo: centavos(p.custo * (0.95 + sorteio() * 0.1)) }));
          if (!itens.length) return;
          const data = diasAtras(dia, 9);
          const recebido = diasAtras(dia - 3, 14);
          const subtotal = centavos(itens.reduce((s, i) => s + i.quantidade * i.custo, 0));
          const frete = itens.length > 3 ? 45 : 0;
          const total = centavos(subtotal + frete);
          const n = total > 800 ? 2 : 1;
          const compra = await tx.pedidoCompra.create({
            data: {
              empresaId,
              numero: numeroCompra++,
              fornecedorId: f.id,
              depositoId: deposito.id,
              status: 'RECEBIDO',
              subtotal,
              frete,
              total,
              parcelas: n,
              previsaoEntrega: soData(recebido),
              recebidoEm: recebido,
              createdAt: data,
              updatedAt: recebido,
              itens: { create: itens.map((i) => ({ produtoId: i.p.id, descricao: i.p.nome, quantidade: i.quantidade, custoUnitario: i.custo, total: centavos(i.quantidade * i.custo) })) },
            },
          });
          for (const i of itens) {
            mover(i.p.id, 'ENTRADA', i.quantidade, recebido, { observacao: `Compra nº ${compra.numero} - ${f.nome}`, custoUnitario: i.custo, pedidoCompraId: compra.id, usuarioId: admin.id });
          }
          await tx.lancamento.createMany({
            data: parcelas(total, n, somarDias(soData(recebido), 28), 0).map((p) => ({
              ...p,
              empresaId,
              tipo: 'PAGAR' as const,
              descricao: `Compra nº ${compra.numero} - ${f.nome}`,
              pessoaId: f.id,
              pedidoCompraId: compra.id,
              categoriaId: catFornecedores,
              contaBancariaId: banco.id,
              createdAt: recebido,
            })),
          });
        },
      });
    }
  }

  // Vendas para empresas e clientes cadastrados, crescendo mês a mês.
  for (let dia = 178; dia >= 1; dia--) {
    const chance = 0.55 + (178 - dia) / 178 * 0.4; // de ~1 venda a cada 2 dias até quase 1 por dia
    if (sorteio() > chance) continue;
    const data = diasAtras(dia);
    eventos.push({
      data,
      executar: async () => {
        const cliente = sorteio() < 0.7 ? escolher(empresas) : escolher(clientes);
        const atacado = cliente.tipo === 'JURIDICA';
        const itens = [];
        for (const p of [...produtos].sort(() => sorteio() - 0.5).slice(0, inteiro(3, 7))) {
          const desejado = atacado ? inteiro(10, 36) : inteiro(2, 8);
          const quantidade = Math.min(desejado, Math.floor((saldo.get(p.id) ?? 0) * 0.4));
          if (quantidade > 0) itens.push({ p, quantidade, preco: atacado ? centavos(p.venda * 0.92) : p.venda });
        }
        if (!itens.length) return;
        const subtotal = centavos(itens.reduce((s, i) => s + i.quantidade * i.preco, 0));
        const frete = atacado && subtotal < 300 ? 15 : 0;
        const desconto = subtotal > 600 ? centavos(subtotal * 0.03) : 0;
        const total = centavos(subtotal - desconto + frete);
        const n = total > 900 ? 3 : total > 400 ? 2 : 1;

        // As vendas dos últimos dias ficam em orçamento/aprovado; uma ou outra foi cancelada.
        const status = dia <= 4 ? escolher(['ORCAMENTO', 'APROVADO'] as const) : sorteio() < 0.04 ? 'CANCELADO' : 'FATURADO';
        const faturadoEm = status === 'FATURADO' ? new Date(data.getTime() + inteiro(1, 20) * 3_600_000) : null;
        const pedido = await tx.pedidoVenda.create({
          data: {
            empresaId,
            numero: numeroPedido++,
            clienteId: cliente.id,
            vendedorId: sorteio() < 0.65 ? vendedor.id : admin.id,
            depositoId: deposito.id,
            status,
            subtotal,
            desconto,
            frete,
            total,
            parcelas: n,
            faturadoEm,
            createdAt: data,
            updatedAt: faturadoEm ?? data,
            itens: { create: itens.map((i) => ({ produtoId: i.p.id, descricao: i.p.nome, quantidade: i.quantidade, precoUnitario: i.preco, total: centavos(i.quantidade * i.preco) })) },
          },
        });
        if (!faturadoEm) return;
        for (const i of itens) {
          mover(i.p.id, 'SAIDA', i.quantidade, faturadoEm, { observacao: `Venda nº ${pedido.numero}`, pedidoId: pedido.id, usuarioId: pedido.vendedorId ?? admin.id });
        }
        await tx.lancamento.createMany({
          data: parcelas(total, n, somarDias(soData(faturadoEm), 30), 0.08).map((p) => ({
            ...p,
            empresaId,
            tipo: 'RECEBER' as const,
            descricao: `Venda nº ${pedido.numero} - ${cliente.nome}`,
            pessoaId: cliente.id,
            pedidoId: pedido.id,
            categoriaId: catVendas,
            contaBancariaId: banco.id,
            createdAt: faturadoEm,
          })),
        });
      },
    });
  }

  // PDV: um caixa por dia nos últimos 6 dias, com vendas de balcão.
  for (let dia = 6; dia >= 1; dia--) {
    eventos.push({
      data: diasAtras(dia, 8, 0),
      executar: async () => {
        const abertura = diasAtras(dia, 8, 0);
        const sessao = await tx.caixa.create({
          data: { empresaId, usuarioId: operador.id, contaBancariaId: caixa.id, numero: numeroCaixa++, status: 'FECHADO', valorAbertura: 100, abertoEm: abertura },
        });
        let dinheiro = 0;
        let minuto = 0;
        for (let v = 0, total = inteiro(8, 15); v < total; v++) {
          minuto += inteiro(15, 50);
          const data = new Date(abertura.getTime() + minuto * 60_000);
          const itens = [];
          for (const p of [...produtos].sort(() => sorteio() - 0.5).slice(0, inteiro(1, 4))) {
            const quantidade = Math.min(inteiro(1, 3), Math.floor((saldo.get(p.id) ?? 0) * 0.3));
            if (quantidade > 0) itens.push({ p, quantidade });
          }
          if (!itens.length) continue;
          const valor = centavos(itens.reduce((s, i) => s + i.quantidade * i.p.venda, 0));
          const forma: FormaPagamento = escolher(['DINHEIRO', 'DINHEIRO', 'PIX', 'PIX', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO']);
          const entregue = forma === 'DINHEIRO' ? Math.ceil(valor / escolher([5, 10, 20, 50])) * escolher([5, 10, 20, 50]) : valor;
          const troco = forma === 'DINHEIRO' ? centavos(Math.max(0, entregue - valor)) : 0;
          if (forma === 'DINHEIRO') dinheiro += valor;
          const pedido = await tx.pedidoVenda.create({
            data: {
              empresaId,
              numero: numeroPedido++,
              origem: 'PDV',
              caixaId: sessao.id,
              clienteId: consumidor.id,
              vendedorId: operador.id,
              depositoId: deposito.id,
              status: 'FATURADO',
              subtotal: valor,
              total: valor,
              faturadoEm: data,
              createdAt: data,
              updatedAt: data,
              itens: { create: itens.map((i) => ({ produtoId: i.p.id, descricao: i.p.nome, quantidade: i.quantidade, precoUnitario: i.p.venda, total: centavos(i.quantidade * i.p.venda) })) },
              pagamentos: { create: [{ forma, valor, troco, caixaId: sessao.id }] },
            },
          });
          for (const i of itens) {
            mover(i.p.id, 'SAIDA', i.quantidade, data, { observacao: `PDV - venda nº ${pedido.numero}`, pedidoId: pedido.id, usuarioId: operador.id });
          }
          await tx.lancamento.create({
            data: {
              empresaId,
              tipo: 'RECEBER',
              status: 'PAGO',
              descricao: `PDV - venda nº ${pedido.numero}`,
              pessoaId: consumidor.id,
              pedidoId: pedido.id,
              categoriaId: catVendas,
              contaBancariaId: caixa.id,
              valor,
              valorPago: valor,
              vencimento: soData(data),
              pagoEm: soData(data),
              createdAt: data,
            },
          });
        }
        const sangria = dinheiro > 150 ? 100 : 0;
        if (sangria) {
          await tx.movimentoCaixa.create({ data: { caixaId: sessao.id, tipo: 'SANGRIA', valor: sangria, motivo: 'Levado ao cofre', createdAt: new Date(abertura.getTime() + 5 * 3_600_000) } });
        }
        const esperado = centavos(100 + dinheiro - sangria);
        const diferenca = dia === 3 ? -2.5 : 0; // um dia fechou com pequena falta, para ver a conferência
        await tx.caixa.update({
          where: { id: sessao.id },
          data: {
            fechadoEm: new Date(abertura.getTime() + (minuto + 20) * 60_000),
            valorEsperado: esperado,
            valorFechamento: centavos(esperado + diferenca),
            observacoes: diferenca ? 'Diferença de troco não identificada' : null,
          },
        });
      },
    });
  }

  for (const evento of eventos.sort((a, b) => a.data.getTime() - b.data.getTime())) await evento.executar();

  // ─────────── Estoque final ───────────

  await tx.movimentoEstoque.createMany({ data: movimentos });
  for (const p of produtos) {
    await tx.estoque.upsert({
      where: { produtoId_depositoId: { produtoId: p.id, depositoId: deposito.id } },
      create: { empresaId, produtoId: p.id, depositoId: deposito.id, quantidade: saldo.get(p.id) ?? 0 },
      update: { quantidade: saldo.get(p.id) ?? 0 },
    });
  }

  // Compras em andamento: uma aguardando entrega e um rascunho.
  const baixos = produtos.filter((p) => (saldo.get(p.id) ?? 0) < p.minimo * 1.5);
  for (const [status, f, dias] of [['ENVIADO', fornecedores[0], 4], ['RASCUNHO', fornecedores[1], 1]] as const) {
    const itens = (baixos.filter((p) => f.cats.includes(p.categoria)).length ? baixos.filter((p) => f.cats.includes(p.categoria)) : produtos.filter((p) => f.cats.includes(p.categoria)).slice(0, 3)).map((p) => ({
      produtoId: p.id,
      descricao: p.nome,
      quantidade: p.minimo * 3,
      custoUnitario: p.custo,
      total: centavos(p.minimo * 3 * p.custo),
    }));
    const total = centavos(itens.reduce((s, i) => s + i.total, 0));
    await tx.pedidoCompra.create({
      data: {
        empresaId,
        numero: numeroCompra++,
        fornecedorId: f.id,
        depositoId: deposito.id,
        status,
        subtotal: total,
        total,
        previsaoEntrega: somarDias(HOJE, 3),
        createdAt: diasAtras(dias),
        itens: { create: itens },
      },
    });
  }

  // ─────────── Despesas fixas ───────────

  const despesas = [
    { descricao: 'Aluguel da loja', categoria: 'Aluguel', dia: 10, valor: () => 1800 },
    { descricao: 'Folha de pagamento', categoria: 'Salários', dia: 5, valor: () => 2200 },
    { descricao: 'Energia elétrica', categoria: 'Água, luz e internet', dia: 15, valor: () => centavos(280 + sorteio() * 100) },
    { descricao: 'Internet e telefone', categoria: 'Água, luz e internet', dia: 20, valor: () => 129.9 },
    { descricao: 'Simples Nacional', categoria: 'Impostos', dia: 20, valor: () => centavos(900 + sorteio() * 400) },
  ];
  const jaTemAluguelNoMes = await tx.lancamento.findFirst({ where: { empresaId, descricao: 'Aluguel da loja' } });
  for (let mes = -5; mes <= 1; mes++) {
    for (const d of despesas) {
      if (mes === 0 && d.descricao === 'Aluguel da loja' && jaTemAluguelNoMes) continue;
      const vencimento = new Date(Date.UTC(AGORA.getFullYear(), AGORA.getMonth() + mes, d.dia));
      const valor = d.valor();
      const pago = vencimento < HOJE;
      await tx.lancamento.create({
        data: {
          empresaId,
          tipo: 'PAGAR',
          status: pago ? 'PAGO' : 'ABERTO',
          descricao: `${d.descricao} - ${vencimento.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric', timeZone: 'UTC' })}`,
          categoriaId: await catFin(d.categoria, 'PAGAR'),
          contaBancariaId: banco.id,
          valor,
          valorPago: pago ? valor : null,
          vencimento,
          pagoEm: pago ? vencimento : null,
          createdAt: somarDias(vencimento, -10),
        },
      });
    }
  }

  // ─────────── CRM ───────────

  const negocios = [
    { titulo: 'Fornecimento mensal - Sabor Caseiro', cliente: 'Restaurante Sabor Caseiro Ltda', valor: 4200, etapa: 'NEGOCIACAO', dias: 20, previsao: 7 },
    { titulo: 'Contrato de bebidas - Lanchonete do Zé', cliente: 'Lanchonete do Zé Ltda', valor: 1800, etapa: 'PROPOSTA', dias: 12, previsao: 15 },
    { titulo: 'Cestas básicas para funcionários', contato: ['Marcos Ribeiro', '(11) 97777-5001'], valor: 3500, etapa: 'QUALIFICACAO', dias: 8, previsao: 30, origem: 'Indicação' },
    { titulo: 'Reposição semanal - Pão Quente', cliente: 'Padaria Pão Quente ME', valor: 2600, etapa: 'PROPOSTA', dias: 15, previsao: -2 },
    { titulo: 'Kit limpeza para condomínio', contato: ['Síndica Regina', '(11) 97777-5002'], valor: 1200, etapa: 'PROSPECCAO', dias: 3, previsao: 40, origem: 'Instagram' },
    { titulo: 'Festa de fim de ano - escritório', contato: ['Patrícia Gomes', '(11) 97777-5003'], valor: 950, etapa: 'PROSPECCAO', dias: 2, previsao: 50, origem: 'Site' },
    { titulo: 'Abastecimento - Mercadinho São Jorge', cliente: 'Mercadinho São Jorge Ltda', valor: 5800, etapa: 'GANHO', dias: 25, previsao: -5 },
    { titulo: 'Bebidas para evento', contato: ['Diego Martins', '(21) 97777-5004'], valor: 2100, etapa: 'PERDIDO', dias: 18, previsao: -8, motivo: 'Preço acima do concorrente' },
    { titulo: 'Higiene para clínica', contato: ['Dra. Camila', '(11) 97777-5005'], valor: 1600, etapa: 'QUALIFICACAO', dias: 6, previsao: 20, origem: 'Indicação' },
  ] as const;

  for (const n of negocios) {
    const cliente = 'cliente' in n ? clientes.find((c) => c.nome === n.cliente) : undefined;
    const fechado = n.etapa === 'GANHO' || n.etapa === 'PERDIDO';
    const criado = diasAtras(n.dias);
    const responsavel = sorteio() < 0.6 ? vendedor : admin;
    const oportunidade = await tx.oportunidade.create({
      data: {
        empresaId,
        titulo: n.titulo,
        pessoaId: cliente?.id,
        contatoNome: 'contato' in n ? n.contato[0] : null,
        contatoTelefone: 'contato' in n ? n.contato[1] : null,
        valorEstimado: n.valor,
        etapa: n.etapa,
        responsavelId: responsavel.id,
        previsaoFechamento: somarDias(HOJE, n.previsao),
        origem: 'origem' in n ? n.origem : 'Carteira de clientes',
        motivoPerda: 'motivo' in n ? n.motivo : null,
        fechadaEm: fechado ? diasAtras(2) : null,
        createdAt: criado,
        updatedAt: diasAtras(Math.min(n.dias, 2)),
      },
    });
    const historico = [
      { tipo: 'LIGACAO' as const, descricao: 'Primeiro contato: apresentei a empresa e o catálogo.', dias: n.dias },
      { tipo: 'WHATSAPP' as const, descricao: 'Enviei a tabela de preços pelo WhatsApp.', dias: Math.max(1, n.dias - 2) },
      ...(n.dias > 10 ? [{ tipo: 'REUNIAO' as const, descricao: 'Reunião para entender volume e frequência de compra.', dias: n.dias - 6 }] : []),
    ];
    for (const h of historico) {
      const data = diasAtras(h.dias);
      await tx.atividade.create({
        data: { empresaId, tipo: h.tipo, descricao: h.descricao, oportunidadeId: oportunidade.id, pessoaId: cliente?.id, usuarioId: responsavel.id, concluida: true, concluidaEm: data, createdAt: data },
      });
    }
  }

  // Tarefas pendentes: atrasadas, para hoje e próximas.
  const abertas = await tx.oportunidade.findMany({ where: { empresaId, etapa: { notIn: ['GANHO', 'PERDIDO'] } } });
  const tarefas = [
    { descricao: 'Retornar com a proposta revisada', dias: 2, hora: 10 },
    { descricao: 'Ligar para confirmar o volume do pedido', dias: 1, hora: 15 },
    { descricao: 'Enviar amostras dos produtos de limpeza', dias: 0, hora: 16 },
    { descricao: 'Follow-up da proposta enviada', dias: 0, hora: 11 },
    { descricao: 'Visitar o cliente para apresentar novidades', dias: -2, hora: 9 },
    { descricao: 'Fechar condições de pagamento', dias: -4, hora: 14 },
  ];
  for (const [i, t] of tarefas.entries()) {
    const oportunidade = abertas[i % abertas.length];
    await tx.atividade.create({
      data: {
        empresaId,
        tipo: 'TAREFA',
        descricao: t.descricao,
        oportunidadeId: oportunidade?.id,
        pessoaId: oportunidade?.pessoaId,
        usuarioId: i % 2 ? admin.id : vendedor.id,
        agendadaPara: diasAtras(t.dias, t.hora, 0),
        createdAt: diasAtras(t.dias + 3),
      },
    });
  }

  const totais = {
    pedidos: await tx.pedidoVenda.count({ where: { empresaId } }),
    compras: await tx.pedidoCompra.count({ where: { empresaId } }),
    lancamentos: await tx.lancamento.count({ where: { empresaId } }),
    movimentos: movimentos.length,
  };
  console.log(`Dados de exemplo criados: ${totais.pedidos} pedidos, ${totais.compras} compras, ${totais.lancamentos} lançamentos, ${totais.movimentos} movimentações de estoque.`);
}
