// Cria uma empresa de demonstração com seis meses de dados de exemplo.
// Rode com: npm run db:seed
// Login: admin@demo.com / demo123 (também gerente@, vendedor@, financeiro@, estoque@ e caixa@demo.com)
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { criarCadastrosIniciais } from '../src/auth/auth.service';
import { PrismaClient } from '../src/generated/prisma/client';
import { popularExemplos } from './exemplos';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  // Na hospedagem o seed roda a cada início; SEED_DEMO=false desliga a empresa de demonstração.
  if (process.env.SEED_DEMO === 'false') {
    console.log('SEED_DEMO=false: empresa de demonstração não será criada.');
    return;
  }
  if (!(await prisma.usuario.findUnique({ where: { email: 'admin@demo.com' } }))) await criarEmpresaDemo();

  // Histórico de seis meses, gerado só enquanto a empresa de demonstração não tem pedidos.
  const { empresaId } = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin@demo.com' } });
  if (await prisma.pedidoVenda.count({ where: { empresaId } })) {
    console.log('Empresa de demonstração já tem movimento. Nada a fazer.');
    return;
  }
  await prisma.$transaction((tx) => popularExemplos(tx, empresaId), { timeout: 300_000, maxWait: 30_000 });
}

async function criarEmpresaDemo() {
  await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: { nome: 'Loja Demonstração Ltda', cnpj: '00.000.000/0001-00', plano: 'PROFISSIONAL' },
    });
    const empresaId = empresa.id;
    await criarCadastrosIniciais(tx, empresaId);

    const senhaHash = await bcrypt.hash('demo123', 10);
    await tx.usuario.createMany({
      data: [
        { empresaId, nome: 'Administrador', email: 'admin@demo.com', senhaHash, perfil: 'ADMIN' },
        { empresaId, nome: 'Vendedor Demo', email: 'vendedor@demo.com', senhaHash, perfil: 'VENDEDOR' },
      ],
    });

    await tx.pessoa.createMany({
      data: [
        { empresaId, nome: 'Maria Oliveira', documento: '529.982.247-25', email: 'maria@email.com', telefone: '(11) 99999-0001', cidade: 'São Paulo', uf: 'SP' },
        { empresaId, nome: 'João Santos', documento: '390.533.447-05', telefone: '(21) 99999-0002', cidade: 'Rio de Janeiro', uf: 'RJ' },
        { empresaId, tipo: 'JURIDICA', nome: 'Mercado Bom Preço Ltda', nomeFantasia: 'Bom Preço', documento: '11.222.333/0001-81', cidade: 'Campinas', uf: 'SP' },
        { empresaId, tipo: 'JURIDICA', nome: 'Distribuidora Alfa S.A.', documento: '11.444.777/0001-61', cliente: false, fornecedor: true, cidade: 'Curitiba', uf: 'PR' },
      ],
    });

    const [bebidas, mercearia] = await Promise.all([
      tx.categoria.create({ data: { empresaId, nome: 'Bebidas' } }),
      tx.categoria.create({ data: { empresaId, nome: 'Mercearia' } }),
    ]);
    const deposito = await tx.deposito.findFirstOrThrow({ where: { empresaId } });

    const produtos = [
      { codigo: '001', nome: 'Café torrado 500g', categoriaId: mercearia.id, precoCusto: 12.5, precoVenda: 21.9, estoqueMinimo: 10, saldo: 40 },
      { codigo: '002', nome: 'Açúcar refinado 1kg', categoriaId: mercearia.id, precoCusto: 3.8, precoVenda: 5.99, estoqueMinimo: 20, saldo: 15 },
      { codigo: '003', nome: 'Refrigerante 2L', categoriaId: bebidas.id, precoCusto: 6, precoVenda: 9.49, estoqueMinimo: 24, saldo: 60 },
      { codigo: '004', nome: 'Água mineral 500ml', categoriaId: bebidas.id, precoCusto: 0.9, precoVenda: 2.5, estoqueMinimo: 48, saldo: 120 },
    ];
    for (const { saldo, ...p } of produtos) {
      const produto = await tx.produto.create({ data: { ...p, empresaId } });
      await tx.estoque.create({ data: { empresaId, produtoId: produto.id, depositoId: deposito.id, quantidade: saldo } });
      await tx.movimentoEstoque.create({
        data: {
          empresaId,
          produtoId: produto.id,
          depositoId: deposito.id,
          tipo: 'ENTRADA',
          quantidade: saldo,
          saldoAnterior: 0,
          saldoNovo: saldo,
          custoUnitario: p.precoCusto,
          observacao: 'Estoque inicial',
        },
      });
    }
    await tx.produto.create({ data: { empresaId, codigo: 'S01', nome: 'Entrega em domicílio', servico: true, precoVenda: 10 } });

    const aluguel = await tx.categoriaFinanceira.findFirstOrThrow({ where: { empresaId, nome: 'Aluguel' } });
    const fornecedor = await tx.pessoa.findFirstOrThrow({ where: { empresaId, fornecedor: true } });
    const caixa = await tx.contaBancaria.findFirstOrThrow({ where: { empresaId } });
    const hoje = new Date();
    const dia = (d: number) => new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), d));
    await tx.lancamento.createMany({
      data: [
        { empresaId, tipo: 'PAGAR', descricao: 'Aluguel da loja', categoriaId: aluguel.id, valor: 2500, vencimento: dia(10), contaBancariaId: caixa.id },
        { empresaId, tipo: 'PAGAR', descricao: 'Compra de mercadorias', pessoaId: fornecedor.id, valor: 1840.5, vencimento: dia(25), contaBancariaId: caixa.id },
      ],
    });
  });

  console.log('Empresa de demonstração criada. Login: admin@demo.com / demo123');
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
