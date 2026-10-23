import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarUsuarioDto, CriarUsuarioDto } from './usuarios.dto';

const campos = { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true };

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  listar(empresaId: string) {
    return this.prisma.usuario.findMany({ where: { empresaId }, select: campos, orderBy: { nome: 'asc' } });
  }

  async criar(empresaId: string, { senha, ...dto }: CriarUsuarioDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { email } })) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }
    return this.prisma.usuario.create({
      data: { ...dto, email, empresaId, senhaHash: await bcrypt.hash(senha, 10) },
      select: campos,
    });
  }

  async atualizar(empresaId: string, id: string, usuarioLogadoId: string, { senha, ...dto }: AtualizarUsuarioDto) {
    await this.prisma.usuario.findFirstOrThrow({ where: { id, empresaId } });
    if (id === usuarioLogadoId && (dto.ativo === false || (dto.perfil && dto.perfil !== 'ADMIN'))) {
      throw new BadRequestException('Você não pode desativar ou rebaixar o próprio usuário');
    }
    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...dto,
        email: dto.email?.toLowerCase(),
        ...(senha ? { senhaHash: await bcrypt.hash(senha, 10) } : {}),
      },
      select: campos,
    });
  }
}
