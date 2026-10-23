import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import {
  AtualizarAtividadeDto,
  AtualizarOportunidadeDto,
  CriarAtividadeDto,
  CriarOportunidadeDto,
  FiltroAtividadeDto,
  FiltroOportunidadeDto,
} from './crm.dto';
import { CrmService } from './crm.service';

@Perfis('GERENTE', 'VENDEDOR')
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('funil')
  funil(@Usuario() u: UsuarioLogado) {
    return this.crm.funil(u.empresaId);
  }

  @Get('oportunidades')
  listarOportunidades(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroOportunidadeDto) {
    return this.crm.listarOportunidades(u.empresaId, filtro);
  }

  @Get('oportunidades/:id')
  buscarOportunidade(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.crm.buscarOportunidade(u.empresaId, id);
  }

  @Post('oportunidades')
  criarOportunidade(@Usuario() u: UsuarioLogado, @Body() dto: CriarOportunidadeDto) {
    return this.crm.criarOportunidade(u, dto);
  }

  @Patch('oportunidades/:id')
  atualizarOportunidade(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarOportunidadeDto) {
    return this.crm.atualizarOportunidade(u, id, dto);
  }

  @Delete('oportunidades/:id')
  @HttpCode(204)
  removerOportunidade(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.crm.removerOportunidade(u.empresaId, id);
  }

  @Get('atividades')
  listarAtividades(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroAtividadeDto) {
    return this.crm.listarAtividades(u, filtro);
  }

  @Post('atividades')
  criarAtividade(@Usuario() u: UsuarioLogado, @Body() dto: CriarAtividadeDto) {
    return this.crm.criarAtividade(u, dto);
  }

  @Patch('atividades/:id')
  atualizarAtividade(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarAtividadeDto) {
    return this.crm.atualizarAtividade(u.empresaId, id, dto);
  }

  @Delete('atividades/:id')
  @HttpCode(204)
  removerAtividade(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.crm.removerAtividade(u.empresaId, id);
  }
}
