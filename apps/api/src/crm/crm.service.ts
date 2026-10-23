import { BadRequestException, Injectable } from '@nestjs/common';
import { centavos, somarDias } from '../common/datas';
import { UsuarioLogado } from '../common/usuario-logado';
import { Prisma } from '../generated/prisma/client';
import { EtapaOportunidade } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  AtualizarAtividadeDto,
  AtualizarOportunidadeDto,
  CriarAtividadeDto,
  CriarOportunidadeDto,
  FiltroAtividadeDto,
  FiltroOportunidadeDto,
} from './crm.dto';

const ETAPAS_FECHADAS: EtapaOportunidade[] = ['GANHO', 'PERDIDO'];

const incluirOportunidade = {
  pessoa: { select: { id: true, nome: true, telefone: true, email: true } },
  responsavel: { select: { id: true, nome: true } },
  _count: { select: { atividades: { where: { concluida: false } } } },
} satisfies Prisma.OportunidadeInclude;

const incluirAtividade = {
  usuario: { select: { id: true, nome: true } },
  pessoa: { select: { id: true, nome: true } },
  oportunidade: { select: { id: true, titulo: true } },
} satisfies Prisma.AtividadeInclude;

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────── Oportunidades (funil) ───────────

  listarOportunidades(empresaId: string, filtro: FiltroOportunidadeDto) {
    const where: Prisma.OportunidadeWhereInput = {
      empresaId,
      responsavelId: filtro.responsavelId,
      pessoaId: filtro.pessoaId,
    };
    if (!filtro.todasFechadas) {
      // Negócios fechados há mais de 30 dias saem do quadro para não poluir.
      where.OR = [{ etapa: { notIn: ETAPAS_FECHADAS } }, { fechadaEm: { gte: somarDias(new Date(), -30) } }];
    }
    if (filtro.busca) {
      where.AND = {
        OR: [
          { titulo: { contains: filtro.busca, mode: 'insensitive' } },
          { contatoNome: { contains: filtro.busca, mode: 'insensitive' } },
          { pessoa: { nome: { contains: filtro.busca, mode: 'insensitive' } } },
        ],
      };
    }
    return this.prisma.oportunidade.findMany({
      where,
      include: incluirOportunidade,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });
  }

  /** Quantidade e valor por etapa, taxa de conversão e previsão ponderada. */
  async funil(empresaId: string) {
    const grupos = await this.prisma.oportunidade.groupBy({
      by: ['etapa'],
      where: { empresaId },
      _count: true,
      _sum: { valorEstimado: true },
    });
    const etapas = Object.values(EtapaOportunidade).map((etapa) => {
      const g = grupos.find((x) => x.etapa === etapa);
      return { etapa, quantidade: g?._count ?? 0, valor: Number(g?._sum.valorEstimado ?? 0) };
    });
    // Chance de fechar em cada etapa, usada para a previsão ponderada.
    const chance: Partial<Record<EtapaOportunidade, number>> = { PROSPECCAO: 0.1, QUALIFICACAO: 0.25, PROPOSTA: 0.5, NEGOCIACAO: 0.75 };
    const ganhas = etapas.find((e) => e.etapa === 'GANHO')!.quantidade;
    const perdidas = etapas.find((e) => e.etapa === 'PERDIDO')!.quantidade;
    return {
      etapas,
      emAberto: etapas.filter((e) => !ETAPAS_FECHADAS.includes(e.etapa)).reduce((s, e) => s + e.valor, 0),
      previsaoPonderada: centavos(etapas.reduce((s, e) => s + e.valor * (chance[e.etapa] ?? 0), 0)),
      taxaConversao: ganhas + perdidas ? ganhas / (ganhas + perdidas) : null,
    };
  }

  buscarOportunidade(empresaId: string, id: string) {
    return this.prisma.oportunidade.findFirstOrThrow({ where: { id, empresaId }, include: incluirOportunidade });
  }

  async criarOportunidade(usuario: UsuarioLogado, dto: CriarOportunidadeDto) {
    await this.validarVinculos(usuario.empresaId, dto);
    const etapa = dto.etapa ?? 'PROSPECCAO';
    this.validarFechamento(etapa, dto.motivoPerda);
    return this.prisma.oportunidade.create({
      data: {
        ...dto,
        empresaId: usuario.empresaId,
        etapa,
        responsavelId: dto.responsavelId === undefined ? usuario.id : dto.responsavelId,
        previsaoFechamento: dto.previsaoFechamento ? new Date(dto.previsaoFechamento) : null,
        fechadaEm: ETAPAS_FECHADAS.includes(etapa) ? new Date() : null,
      },
      include: incluirOportunidade,
    });
  }

  async atualizarOportunidade(usuario: UsuarioLogado, id: string, dto: AtualizarOportunidadeDto) {
    const atual = await this.prisma.oportunidade.findFirstOrThrow({ where: { id, empresaId: usuario.empresaId } });
    await this.validarVinculos(usuario.empresaId, dto);
    const etapa = dto.etapa ?? atual.etapa;
    this.validarFechamento(etapa, dto.motivoPerda === undefined ? atual.motivoPerda : dto.motivoPerda);

    const mudouEtapa = dto.etapa && dto.etapa !== atual.etapa;
    return this.prisma.$transaction(async (tx) => {
      if (mudouEtapa) {
        // A mudança de etapa fica registrada no histórico do negócio.
        await tx.atividade.create({
          data: {
            empresaId: usuario.empresaId,
            tipo: 'NOTA',
            descricao: `Etapa alterada: ${rotuloEtapa[atual.etapa]} → ${rotuloEtapa[etapa]}`,
            oportunidadeId: id,
            pessoaId: atual.pessoaId,
            usuarioId: usuario.id,
            concluida: true,
            concluidaEm: new Date(),
          },
        });
      }
      return tx.oportunidade.update({
        where: { id },
        data: {
          ...dto,
          previsaoFechamento: dto.previsaoFechamento === undefined ? undefined : dto.previsaoFechamento ? new Date(dto.previsaoFechamento) : null,
          ...(mudouEtapa ? { fechadaEm: ETAPAS_FECHADAS.includes(etapa) ? new Date() : null } : {}),
          ...(mudouEtapa && etapa !== 'PERDIDO' ? { motivoPerda: null } : {}),
        },
        include: incluirOportunidade,
      });
    });
  }

  async removerOportunidade(empresaId: string, id: string) {
    await this.prisma.oportunidade.findFirstOrThrow({ where: { id, empresaId } });
    await this.prisma.oportunidade.delete({ where: { id } });
  }

  // ─────────── Atividades e tarefas ───────────

  listarAtividades(usuario: UsuarioLogado, filtro: FiltroAtividadeDto) {
    return this.prisma.atividade.findMany({
      where: {
        empresaId: usuario.empresaId,
        oportunidadeId: filtro.oportunidadeId,
        pessoaId: filtro.pessoaId,
        ...(filtro.pendentes ? { concluida: false } : {}),
        ...(filtro.minhas ? { usuarioId: usuario.id } : {}),
      },
      include: incluirAtividade,
      // Pendentes: as mais urgentes primeiro. Histórico: as mais recentes primeiro.
      orderBy: filtro.pendentes ? [{ agendadaPara: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] : [{ createdAt: 'desc' }],
      take: 300,
    });
  }

  async criarAtividade(usuario: UsuarioLogado, dto: CriarAtividadeDto) {
    const { empresaId } = usuario;
    let pessoaId = dto.pessoaId;
    if (dto.oportunidadeId) {
      const oportunidade = await this.prisma.oportunidade.findFirstOrThrow({ where: { id: dto.oportunidadeId, empresaId } });
      pessoaId ??= oportunidade.pessoaId ?? undefined;
    }
    if (pessoaId) await this.prisma.pessoa.findFirstOrThrow({ where: { id: pessoaId, empresaId } });
    if (!dto.oportunidadeId && !pessoaId && dto.tipo !== 'TAREFA') {
      throw new BadRequestException('Ligue a atividade a um cliente ou negócio');
    }
    // Registro de algo que já aconteceu (ligação, nota...) nasce concluído; tarefa agendada nasce pendente.
    const concluida = dto.concluida ?? (!dto.agendadaPara && dto.tipo !== 'TAREFA');
    return this.prisma.atividade.create({
      data: {
        ...dto,
        empresaId,
        pessoaId,
        usuarioId: usuario.id,
        agendadaPara: dto.agendadaPara ? new Date(dto.agendadaPara) : null,
        concluida,
        concluidaEm: concluida ? new Date() : null,
      },
      include: incluirAtividade,
    });
  }

  async atualizarAtividade(empresaId: string, id: string, dto: AtualizarAtividadeDto) {
    const atual = await this.prisma.atividade.findFirstOrThrow({ where: { id, empresaId } });
    return this.prisma.atividade.update({
      where: { id },
      data: {
        ...dto,
        agendadaPara: dto.agendadaPara === undefined ? undefined : dto.agendadaPara ? new Date(dto.agendadaPara) : null,
        ...(dto.concluida !== undefined && dto.concluida !== atual.concluida ? { concluidaEm: dto.concluida ? new Date() : null } : {}),
      },
      include: incluirAtividade,
    });
  }

  async removerAtividade(empresaId: string, id: string) {
    await this.prisma.atividade.findFirstOrThrow({ where: { id, empresaId } });
    await this.prisma.atividade.delete({ where: { id } });
  }

  private validarFechamento(etapa: EtapaOportunidade, motivoPerda?: string | null) {
    if (etapa === 'PERDIDO' && !motivoPerda) throw new BadRequestException('Informe o motivo da perda');
  }

  private async validarVinculos(empresaId: string, dto: { pessoaId?: string | null; responsavelId?: string | null }) {
    await Promise.all([
      dto.pessoaId && this.prisma.pessoa.findFirstOrThrow({ where: { id: dto.pessoaId, empresaId } }),
      dto.responsavelId && this.prisma.usuario.findFirstOrThrow({ where: { id: dto.responsavelId, empresaId } }),
    ]);
  }
}

const rotuloEtapa: Record<EtapaOportunidade, string> = {
  PROSPECCAO: 'Prospecção',
  QUALIFICACAO: 'Qualificação',
  PROPOSTA: 'Proposta',
  NEGOCIACAO: 'Negociação',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};
