import { Injectable } from '@nestjs/common';
import { paginar, resultado } from '../common/paginacao';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarPessoaDto, CriarPessoaDto, FiltroPessoaDto } from './pessoas.dto';

@Injectable()
export class PessoasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(empresaId: string, filtro: FiltroPessoaDto) {
    const where: Prisma.PessoaWhereInput = { empresaId };
    if (filtro.papel === 'cliente') where.cliente = true;
    if (filtro.papel === 'fornecedor') where.fornecedor = true;
    if (filtro.busca) {
      where.OR = [
        { nome: { contains: filtro.busca, mode: 'insensitive' } },
        { nomeFantasia: { contains: filtro.busca, mode: 'insensitive' } },
        { documento: { contains: filtro.busca } },
        { email: { contains: filtro.busca, mode: 'insensitive' } },
      ];
    }
    const [itens, total] = await Promise.all([
      this.prisma.pessoa.findMany({ where, orderBy: { nome: 'asc' }, ...paginar(filtro) }),
      this.prisma.pessoa.count({ where }),
    ]);
    return resultado(itens, total, filtro);
  }

  buscar(empresaId: string, id: string) {
    return this.prisma.pessoa.findFirstOrThrow({ where: { id, empresaId } });
  }

  criar(empresaId: string, dto: CriarPessoaDto) {
    return this.prisma.pessoa.create({ data: { ...dto, empresaId } });
  }

  async atualizar(empresaId: string, id: string, dto: AtualizarPessoaDto) {
    await this.buscar(empresaId, id);
    return this.prisma.pessoa.update({ where: { id }, data: dto });
  }

  async remover(empresaId: string, id: string) {
    await this.buscar(empresaId, id);
    await this.prisma.pessoa.delete({ where: { id } });
  }
}
