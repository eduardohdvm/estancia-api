import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { CriarMovimentoDto, DepositoDto, FiltroMovimentoDto } from './estoque.dto';
import { EstoqueService } from './estoque.service';

@Controller('estoque')
export class EstoqueController {
  constructor(private readonly estoque: EstoqueService) {}

  @Get('movimentos')
  listarMovimentos(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroMovimentoDto) {
    return this.estoque.listarMovimentos(u.empresaId, filtro);
  }

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Post('movimentos')
  lancarMovimento(@Usuario() u: UsuarioLogado, @Body() dto: CriarMovimentoDto) {
    return this.estoque.lancarMovimento(u.empresaId, u.id, dto);
  }

  @Get('depositos')
  listarDepositos(@Usuario() u: UsuarioLogado) {
    return this.estoque.listarDepositos(u.empresaId);
  }

  @Perfis('GERENTE')
  @Post('depositos')
  criarDeposito(@Usuario() u: UsuarioLogado, @Body() dto: DepositoDto) {
    return this.estoque.criarDeposito(u.empresaId, dto);
  }

  @Perfis('GERENTE')
  @Patch('depositos/:id')
  atualizarDeposito(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DepositoDto) {
    return this.estoque.atualizarDeposito(u.empresaId, id, dto);
  }
}
