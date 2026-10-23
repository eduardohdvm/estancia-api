import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { AtualizarProdutoDto, CategoriaDto, CriarProdutoDto, FiltroProdutoDto } from './produtos.dto';
import { ProdutosService } from './produtos.service';

@Controller()
export class ProdutosController {
  constructor(private readonly produtos: ProdutosService) {}

  @Get('produtos')
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroProdutoDto) {
    return this.produtos.listar(u.empresaId, filtro);
  }

  @Get('produtos/:id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.produtos.buscar(u.empresaId, id);
  }

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Post('produtos')
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarProdutoDto) {
    return this.produtos.criar(u.empresaId, dto);
  }

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Patch('produtos/:id')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarProdutoDto) {
    return this.produtos.atualizar(u.empresaId, id, dto);
  }

  @Perfis('GERENTE')
  @Delete('produtos/:id')
  @HttpCode(204)
  remover(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.produtos.remover(u.empresaId, id);
  }

  @Get('categorias')
  listarCategorias(@Usuario() u: UsuarioLogado) {
    return this.produtos.listarCategorias(u.empresaId);
  }

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Post('categorias')
  criarCategoria(@Usuario() u: UsuarioLogado, @Body() dto: CategoriaDto) {
    return this.produtos.criarCategoria(u.empresaId, dto);
  }

  @Perfis('GERENTE')
  @Delete('categorias/:id')
  @HttpCode(204)
  removerCategoria(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.produtos.removerCategoria(u.empresaId, id);
  }
}
