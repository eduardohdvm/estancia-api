// Produtos iniciais da Estância Maciel, publicados no catálogo. Só para DEV/HML.
// Os PREÇOS SÃO DE EXEMPLO: ajuste no painel (Produtos) antes de usar com clientes.
// Rode com: npm run db:exemplo -w apps/api   (pode rodar de novo: não duplica)
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { criarCadastrosIniciais } from '../src/auth/auth.service';
import { PrismaClient } from '../src/generated/prisma/client';
import type { Armazenamento } from '../src/generated/prisma/enums';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Exemplo = {
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  unidade: string;
  preco: number;
  armazenamento: Armazenamento;
  vendaFracionada?: boolean;
};

const PRODUTOS: Exemplo[] = [
  { codigo: 'PQ-500', nome: 'Pão de queijo congelado 500 g', descricao: 'Receita da casa com queijo meia cura. Do freezer direto para o forno.', categoria: 'Congelados', unidade: 'PCT', preco: 22, armazenamento: 'CONGELADO' },
  { codigo: 'PQ-1000', nome: 'Pão de queijo congelado 1 kg', descricao: 'Receita da casa com queijo meia cura. Do freezer direto para o forno.', categoria: 'Congelados', unidade: 'PCT', preco: 40, armazenamento: 'CONGELADO' },
  { codigo: 'POL-MAR', nome: 'Polpa de maracujá 1 kg', descricao: 'Fruta selecionada, sem conservantes. Pacotinhos de 100 g.', categoria: 'Congelados', unidade: 'PCT', preco: 24, armazenamento: 'CONGELADO' },
  { codigo: 'POL-ACE', nome: 'Polpa de acerola 1 kg', descricao: 'Fruta selecionada, sem conservantes. Pacotinhos de 100 g.', categoria: 'Congelados', unidade: 'PCT', preco: 20, armazenamento: 'CONGELADO' },
  { codigo: 'LIN-KG', nome: 'Linguiça caseira', descricao: 'Pernil temperado na receita de família. Vendida por quilo.', categoria: 'Carnes temperadas', unidade: 'KG', preco: 39.9, armazenamento: 'CONGELADO', vendaFracionada: true },
  { codigo: 'COS-KG', nome: 'Costelinha de porco temperada', descricao: 'Pronta para assar, temperada com alho e ervas. Vendida por quilo.', categoria: 'Carnes temperadas', unidade: 'KG', preco: 42.9, armazenamento: 'CONGELADO', vendaFracionada: true },
  { codigo: 'DL-400', nome: 'Doce de leite 400 g', descricao: 'Feito no tacho, ponto de colher.', categoria: 'Doces caseiros', unidade: 'UN', preco: 18, armazenamento: 'AMBIENTE' },
  { codigo: 'RAP-500', nome: 'Rapadura 500 g', descricao: 'Rapadura de cana, tradicional.', categoria: 'Doces caseiros', unidade: 'UN', preco: 12, armazenamento: 'AMBIENTE' },
  { codigo: 'ROS-UN', nome: 'Rosca artesanal', descricao: 'Rosca trançada de leite, assada no dia.', categoria: 'Padaria artesanal', unidade: 'UN', preco: 20, armazenamento: 'AMBIENTE' },
];

async function main() {
  let empresa = await prisma.empresa.findFirst({ where: { nome: 'Estância Maciel' }, orderBy: { createdAt: 'asc' } });
  if (!empresa) {
    empresa = await prisma.empresa.create({ data: { nome: 'Estância Maciel' } });
    await prisma.$transaction((tx) => criarCadastrosIniciais(tx, empresa!.id));
  }
  const empresaId = empresa.id;

  for (const p of PRODUTOS) {
    const categoria = await prisma.categoria.upsert({
      where: { empresaId_nome: { empresaId, nome: p.categoria } },
      create: { empresaId, nome: p.categoria },
      update: {},
    });
    const existe = await prisma.produto.findUnique({ where: { empresaId_codigo: { empresaId, codigo: p.codigo } } });
    if (existe) continue;
    await prisma.produto.create({
      data: {
        empresaId,
        categoriaId: categoria.id,
        codigo: p.codigo,
        nome: p.nome,
        descricao: p.descricao,
        unidade: p.unidade,
        precoVenda: p.preco,
        armazenamento: p.armazenamento,
        vendaFracionada: p.vendaFracionada ?? false,
        publicado: true,
      },
    });
  }
  console.log(`Estância Maciel: ${PRODUTOS.length} produtos de exemplo publicados no catálogo (preços de exemplo).`);
}

main().finally(() => prisma.$disconnect());
