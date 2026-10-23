import { Controller, Get, Module, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { FiltroRelatorioDto } from './relatorios.dto';
import { RelatoriosService } from './relatorios.service';

@Perfis('GERENTE', 'FINANCEIRO')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('vendas-periodo')
  porPeriodo(@Usuario() u: UsuarioLogado, @Query() f: FiltroRelatorioDto) {
    return this.relatorios.porPeriodo(u.empresaId, f);
  }

  @Get('vendas-produto')
  porProduto(@Usuario() u: UsuarioLogado, @Query() f: FiltroRelatorioDto) {
    return this.relatorios.porProduto(u.empresaId, f);
  }

  @Get('vendas-vendedor')
  porVendedor(@Usuario() u: UsuarioLogado, @Query() f: FiltroRelatorioDto) {
    return this.relatorios.porVendedor(u.empresaId, f);
  }

  @Get('curva-abc')
  curvaAbc(@Usuario() u: UsuarioLogado, @Query() f: FiltroRelatorioDto) {
    return this.relatorios.curvaAbc(u.empresaId, f);
  }

  @Get('dre')
  dre(@Usuario() u: UsuarioLogado, @Query() f: FiltroRelatorioDto) {
    return this.relatorios.dre(u.empresaId, f);
  }
}

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
