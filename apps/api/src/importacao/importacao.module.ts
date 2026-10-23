import { Body, Controller, HttpCode, Module, Post } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { EstoqueModule } from '../estoque/estoque.module';
import { ImportacaoDto, ImportacaoEstoqueDto, ImportacaoPessoasDto } from './importacao.dto';
import { ImportacaoService } from './importacao.service';

/** Importação de planilhas. Com `simular: true` só confere; com `false` grava as linhas válidas. */
@Controller('importacao')
export class ImportacaoController {
  constructor(private readonly importacao: ImportacaoService) {}

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Post('produtos')
  @HttpCode(200)
  produtos(@Usuario() u: UsuarioLogado, @Body() dto: ImportacaoDto) {
    return this.importacao.produtos(u.empresaId, dto);
  }

  @Perfis('GERENTE', 'VENDEDOR', 'FINANCEIRO')
  @Post('pessoas')
  @HttpCode(200)
  pessoas(@Usuario() u: UsuarioLogado, @Body() dto: ImportacaoPessoasDto) {
    return this.importacao.pessoas(u.empresaId, dto);
  }

  @Perfis('GERENTE', 'ESTOQUISTA')
  @Post('estoque')
  @HttpCode(200)
  estoque(@Usuario() u: UsuarioLogado, @Body() dto: ImportacaoEstoqueDto) {
    return this.importacao.estoqueInicial(u.empresaId, u.id, dto);
  }
}

@Module({
  imports: [EstoqueModule],
  controllers: [ImportacaoController],
  providers: [ImportacaoService],
})
export class ImportacaoModule {}
