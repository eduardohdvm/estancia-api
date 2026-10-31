import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { AtualizarPessoaDto, CriarPessoaDto, FiltroPessoaDto } from './pessoas.dto';
import { PessoasService } from './pessoas.service';

/** Clientes e fornecedores. Use `?papel=cliente` ou `?papel=fornecedor` para filtrar. */
@Controller('pessoas')
export class PessoasController {
  constructor(private readonly pessoas: PessoasService) {}

  @Get()
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroPessoaDto) {
    return this.pessoas.listar(u.empresaId, filtro);
  }

  @Get(':id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.pessoas.buscar(u.empresaId, id);
  }

  @Post()
  @Perfis('GERENTE', 'VENDEDOR', 'FINANCEIRO', 'ESTOQUISTA', 'CAIXA')
  criar(@Usuario() u: UsuarioLogado, @Body() dto: CriarPessoaDto) {
    return this.pessoas.criar(u.empresaId, dto);
  }

  @Patch(':id')
  @Perfis('GERENTE', 'VENDEDOR', 'FINANCEIRO', 'ESTOQUISTA', 'CAIXA')
  atualizar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AtualizarPessoaDto) {
    return this.pessoas.atualizar(u.empresaId, id, dto);
  }

  // Excluir cliente/fornecedor apaga histórico de contato: só administrador e gerente.
  @Delete(':id')
  @Perfis('GERENTE')
  @HttpCode(204)
  remover(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.pessoas.remover(u.empresaId, id);
  }
}
