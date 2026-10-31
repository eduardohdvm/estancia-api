import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { telefoneE164, telefoneFormatado } from '../common/telefone';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { proximoNumeroPedido, VendasService } from '../vendas/vendas.service';
import { CriarOrcamentoPublicoDto } from './publico.dto';

const NOME_LOJA = 'Estância Maciel';

/** Nº do pedido como o cliente vê: 125 → "EM-000125". */
export const numeroPublico = (numero: number) => `EM-${String(numero).padStart(6, '0')}`;

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "2 pacotes", "1,5 kg", "1 unidade". */
export function quantidadeComUnidade(quantidade: number, unidade: string) {
  const q = quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const plural = quantidade !== 1;
  switch (unidade.toUpperCase()) {
    case 'KG':
      return `${q} kg`;
    case 'G':
      return `${q} g`;
    case 'L':
      return `${q} L`;
    case 'PCT':
      return `${q} ${plural ? 'pacotes' : 'pacote'}`;
    case 'DZ':
      return `${q} ${plural ? 'dúzias' : 'dúzia'}`;
    case 'CX':
      return `${q} ${plural ? 'caixas' : 'caixa'}`;
    default:
      return `${q} ${plural ? 'unidades' : 'unidade'}`;
  }
}

/** Texto que o cliente envia pelo WhatsApp (modelo definido no prompt do projeto). */
export function mensagemOrcamento(o: {
  numero: string;
  itens: { descricao: string; quantidade: number; unidade: string }[];
  total: number;
  modalidade: 'RETIRADA' | 'ENTREGA';
}) {
  const linhas = [
    'Olá! Gostaria de solicitar um orçamento na Estância Maciel.',
    `Orçamento: #${o.numero}`,
    'Produtos:',
    ...o.itens.map((i) => `• ${i.descricao} — ${quantidadeComUnidade(i.quantidade, i.unidade)}.`),
    `Valor estimado: ${moeda(o.total)}.`,
    o.modalidade === 'ENTREGA'
      ? 'Gostaria de confirmar disponibilidade e condições de entrega.'
      : 'Gostaria de confirmar disponibilidade para retirada.',
  ];
  return linhas.join('\n');
}

@Injectable()
export class PublicoService {
  private empresaCache: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vendas: VendasService,
  ) {}

  /** A empresa da loja (ADR-007): EMPRESA_ID, ou a empresa chamada "Estância Maciel". */
  private async empresaId() {
    if (this.empresaCache) return this.empresaCache;
    const empresa = process.env.EMPRESA_ID
      ? await this.prisma.empresa.findUnique({ where: { id: process.env.EMPRESA_ID } })
      : await this.prisma.empresa.findFirst({ where: { nome: NOME_LOJA, ativa: true }, orderBy: { createdAt: 'asc' } });
    if (!empresa) throw new NotFoundException('Catálogo em montagem. Volte em breve!');
    this.empresaCache = empresa.id;
    return empresa.id;
  }

  private whatsappLoja() {
    const numero = (process.env.LOJA_WHATSAPP ?? '').replace(/\D/g, '');
    return numero.length >= 12 ? numero : null;
  }

  /** Produtos publicados, com preço oficial. O catálogo não calcula preço: só mostra. */
  async catalogo() {
    const empresaId = await this.empresaId();
    const produtos = await this.prisma.produto.findMany({
      where: { empresaId, ativo: true, publicado: true, servico: false },
      include: { categoria: { select: { id: true, nome: true } } },
      orderBy: [{ categoria: { nome: 'asc' } }, { nome: 'asc' }],
    });
    const categorias = new Map<string, { id: string; nome: string }>();
    for (const p of produtos) if (p.categoria) categorias.set(p.categoria.id, p.categoria);
    return {
      loja: { nome: NOME_LOJA, temWhatsapp: !!this.whatsappLoja() },
      categorias: [...categorias.values()],
      produtos: produtos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        descricao: p.descricao,
        categoriaId: p.categoriaId,
        unidade: p.unidade,
        preco: Number(p.precoVenda).toFixed(2),
        armazenamento: p.armazenamento,
        vendaFracionada: p.vendaFracionada,
      })),
    };
  }

  /**
   * Registra o orçamento do catálogo: preços recalculados aqui, cópia do pedido guardada,
   * número EM-xxxxxx gerado e mensagem do WhatsApp pronta. Reenviar a mesma `chave`
   * devolve o mesmo orçamento (idempotente).
   */
  async criarOrcamento(dto: CriarOrcamentoPublicoDto) {
    const empresaId = await this.empresaId();

    const repetido = await this.prisma.pedidoVenda.findFirst({
      where: { empresaId, origem: 'CATALOGO', solicitacaoOriginal: { path: ['chave'], equals: dto.chave } },
      include: { itens: { include: { produto: { select: { unidade: true } } } } },
    });
    if (repetido) return this.resposta(repetido);

    const telefone = telefoneE164(dto.cliente.telefone);
    if (!telefone) throw new BadRequestException('Telefone inválido. Informe com DDD, ex.: (11) 99999-8888');
    if (dto.modalidade === 'ENTREGA' && !dto.endereco) throw new BadRequestException('Informe o endereço de entrega');

    const ids = [...new Set(dto.itens.map((i) => i.produtoId))];
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: ids }, empresaId, ativo: true, publicado: true },
    });
    if (produtos.length !== ids.length) {
      throw new BadRequestException('Algum produto do carrinho não está mais disponível. Atualize a página.');
    }
    for (const item of dto.itens) {
      const p = produtos.find((x) => x.id === item.produtoId)!;
      if (!p.vendaFracionada && !Number.isInteger(item.quantidade)) {
        throw new BadRequestException(`"${p.nome}" só é vendido em quantidade inteira`);
      }
    }

    // Cliente identificado pelo telefone. Dados de um cliente existente nunca são alterados por aqui.
    const cliente =
      (await this.prisma.pessoa.findFirst({ where: { empresaId, telefoneE164: telefone } })) ??
      (await this.prisma.pessoa.create({
        data: { empresaId, nome: dto.cliente.nome.trim(), telefone: telefoneFormatado(telefone), telefoneE164: telefone, cliente: true },
      }));

    const calculado = await this.vendas.calcular(empresaId, {
      clienteId: cliente.id,
      itens: dto.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      observacoes: dto.observacao,
    });

    const pedido = await this.prisma.$transaction(async (tx) =>
      tx.pedidoVenda.create({
        data: {
          ...calculado.pedido,
          empresaId,
          numero: await proximoNumeroPedido(tx, empresaId),
          origem: 'CATALOGO',
          modalidade: dto.modalidade,
          enderecoEntrega: dto.modalidade === 'ENTREGA' ? (dto.endereco as unknown as Prisma.InputJsonValue) : undefined,
          solicitacaoOriginal: {
            chave: dto.chave,
            nomeInformado: dto.cliente.nome,
            itens: calculado.itens.map((i) => ({ ...i })),
            total: calculado.pedido.total,
            criadoEm: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          itens: { create: calculado.itens },
        },
        include: { itens: { include: { produto: { select: { unidade: true } } } } },
      }),
    );
    return this.resposta(pedido);
  }

  /** O cliente tocou em "Enviar pelo WhatsApp". Só registra a intenção (não há como saber se enviou). */
  async whatsappAberto(chave: string) {
    const empresaId = await this.empresaId();
    const { count } = await this.prisma.pedidoVenda.updateMany({
      where: { empresaId, origem: 'CATALOGO', whatsappAbertoEm: null, solicitacaoOriginal: { path: ['chave'], equals: chave } },
      data: { whatsappAbertoEm: new Date() },
    });
    return { registrado: count > 0 };
  }

  private resposta(p: {
    numero: number;
    total: Prisma.Decimal;
    modalidade: 'RETIRADA' | 'ENTREGA';
    itens: { descricao: string; quantidade: Prisma.Decimal; precoUnitario: Prisma.Decimal; total: Prisma.Decimal; produto: { unidade: string } }[];
  }) {
    const numero = numeroPublico(p.numero);
    const itens = p.itens.map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      unidade: i.produto.unidade,
      precoUnitario: Number(i.precoUnitario).toFixed(2),
      total: Number(i.total).toFixed(2),
    }));
    const mensagem = mensagemOrcamento({ numero, itens, total: Number(p.total), modalidade: p.modalidade });
    const whatsapp = this.whatsappLoja();
    return {
      numero,
      itens,
      total: Number(p.total).toFixed(2),
      mensagem,
      whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}` : null,
    };
  }
}
