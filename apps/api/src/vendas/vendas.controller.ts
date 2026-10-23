import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { FaturarPedidoDto, FiltroPedidoDto, SalvarPedidoDto } from './vendas.dto';
import { VendasService } from './vendas.service';

@Perfis('GERENTE', 'VENDEDOR')
@Controller('pedidos')
export class VendasController {
  constructor(private readonly vendas: VendasService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroPedidoDto) {
    return this.vendas.listar(u.empresaId, filtro);
  }

  @Get(':id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendas.buscar(u.empresaId, id);
  }

  @Post()
  criar(@Usuario() u: UsuarioLogado, @Body() dto: SalvarPedidoDto) {
    return this.vendas.criar(u, dto);
  }

  @Put(':id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SalvarPedidoDto) {
    return this.vendas.atualizar(u.empresaId, id, dto);
  }

  @Post(':id/aprovar')
  aprovar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendas.aprovar(u.empresaId, id);
  }

  @Post(':id/faturar')
  faturar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: FaturarPedidoDto) {
    return this.vendas.faturar(u, id, dto);
  }

  @Perfis('GERENTE')
  @Post(':id/cancelar')
  cancelar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.vendas.cancelar(u, id);
  }
}
