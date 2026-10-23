import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { AtualizarUsuarioDto, CriarUsuarioDto } from './usuarios.dto';
import { UsuariosService } from './usuarios.service';

@Perfis('ADMIN')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado) {
    return this.usuarios.listar(u.empresaId);
  }

  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarUsuarioDto) {
    return this.usuarios.criar(u.empresaId, dto);
  }

  @Patch(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarUsuarioDto) {
    return this.usuarios.atualizar(u.empresaId, id, u.id, dto);
  }
}
