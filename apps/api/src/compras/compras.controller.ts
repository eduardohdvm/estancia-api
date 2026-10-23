import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { FiltroCompraDto, ReceberCompraDto, SalvarCompraDto } from './compras.dto';
import { ComprasService } from './compras.service';

@Perfis('GERENTE', 'ESTOQUISTA')
@Controller('compras')
export class ComprasController {
  constructor(private readonly compras: ComprasService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroCompraDto) {
    return this.compras.listar(u.empresaId, filtro);
  }

  @Get('sugestao')
  sugestao(@Usuario() u: UsuarioLogado) {
    return this.compras.sugestao(u.empresaId);
  }

  @Get(':id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.compras.buscar(u.empresaId, id);
  }

  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: SalvarCompraDto) {
    return this.compras.criar(u.empresaId, dto);
  }

  @Put(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SalvarCompraDto) {
    return this.compras.atualizar(u.empresaId, id, dto);
  }

  @Post(':id/enviar')
  enviar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.compras.enviar(u.empresaId, id);
  }

  @Post(':id/receber')
  receber(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReceberCompraDto) {
    return this.compras.receber(u, id, dto);
  }

  @Perfis('GERENTE')
  @Post(':id/cancelar')
  cancelar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.compras.cancelar(u, id);
  }
}
