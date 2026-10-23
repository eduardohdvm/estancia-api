import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { AbrirCaixaDto, FecharCaixaDto, FiltroCaixaDto, MovimentoCaixaDto, VendaPdvDto } from './pdv.dto';
import { PdvService } from './pdv.service';

@Perfis('GERENTE', 'VENDEDOR', 'CAIXA')
@Controller('pdv')
export class PdvController {
  constructor(private readonly pdv: PdvService) {}

  @Get('caixa')
  atual(@Usuario() u: UsuarioLogado) {
    return this.pdv.atual(u);
  }

  @Post('caixa/abrir')
  abrir(@Usuario() u: UsuarioLogado, @Body() dto: AbrirCaixaDto) {
    return this.pdv.abrir(u, dto);
  }

  @Post('caixa/movimentos')
  movimentar(@Usuario() u: UsuarioLogado, @Body() dto: MovimentoCaixaDto) {
    return this.pdv.movimentar(u, dto);
  }

  @Post('caixa/fechar')
  fechar(@Usuario() u: UsuarioLogado, @Body() dto: FecharCaixaDto) {
    return this.pdv.fechar(u, dto);
  }

  @Get('caixas')
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroCaixaDto) {
    return this.pdv.listar(u, filtro);
  }

  @Perfis('GERENTE')
  @Get('caixas/:id')
  detalhar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.pdv.detalhar(u.empresaId, id);
  }

  @Get('produto/:codigo')
  produtoPorCodigo(@Usuario() u: UsuarioLogado, @Param('codigo') codigo: string) {
    return this.pdv.produtoPorCodigo(u.empresaId, codigo);
  }

  @Post('vendas')
  vender(@Usuario() u: UsuarioLogado, @Body() dto: VendaPdvDto) {
    return this.pdv.vender(u, dto);
  }

  @Post('vendas/:id/cancelar')
  cancelarVenda(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.pdv.cancelarVenda(u, id);
  }
}
