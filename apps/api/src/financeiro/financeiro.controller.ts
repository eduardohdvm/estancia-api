import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import {
  AtualizarLancamentoDto,
  BaixarLancamentoDto,
  CategoriaFinanceiraDto,
  ContaBancariaDto,
  CriarLancamentoDto,
  FiltroLancamentoDto,
} from './financeiro.dto';
import { FinanceiroService } from './financeiro.service';

@Perfis('GERENTE', 'FINANCEIRO')
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly financeiro: FinanceiroService) {}

  @Get('resumo')
  resumo(@Usuario() u: UsuarioLogado) {
    return this.financeiro.resumo(u.empresaId);
  }

  @Get('lancamentos')
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroLancamentoDto) {
    return this.financeiro.listar(u.empresaId, filtro);
  }

  @Get('lancamentos/:id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeiro.buscar(u.empresaId, id);
  }

  @Post('lancamentos')
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarLancamentoDto) {
    return this.financeiro.criar(u.empresaId, dto);
  }

  @Patch('lancamentos/:id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarLancamentoDto) {
    return this.financeiro.atualizar(u.empresaId, id, dto);
  }

  @Post('lancamentos/:id/baixar')
  baixar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BaixarLancamentoDto) {
    return this.financeiro.baixar(u.empresaId, id, dto);
  }

  @Post('lancamentos/:id/estornar')
  estornar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeiro.estornar(u.empresaId, id);
  }

  @Post('lancamentos/:id/cancelar')
  cancelar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.financeiro.cancelar(u.empresaId, id);
  }

  @Get('contas')
  listarContas(@Usuario() u: UsuarioLogado) {
    return this.financeiro.listarContas(u.empresaId);
  }

  @Post('contas')
  criarConta(@Usuario() u: UsuarioLogado, @Body() dto: ContaBancariaDto) {
    return this.financeiro.criarConta(u.empresaId, dto);
  }

  @Patch('contas/:id')
  atualizarConta(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContaBancariaDto) {
    return this.financeiro.atualizarConta(u.empresaId, id, dto);
  }

  @Get('categorias')
  listarCategorias(@Usuario() u: UsuarioLogado) {
    return this.financeiro.listarCategorias(u.empresaId);
  }

  @Post('categorias')
  criarCategoria(@Usuario() u: UsuarioLogado, @Body() dto: CategoriaFinanceiraDto) {
    return this.financeiro.criarCategoria(u.empresaId, dto);
  }
}
