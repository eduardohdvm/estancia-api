import { Controller, Get, Module } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { DashboardService } from './dashboard.service';

@Perfis('GERENTE', 'VENDEDOR', 'FINANCEIRO', 'ESTOQUISTA')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  resumo(@Usuario() u: UsuarioLogado) {
    return this.dashboard.resumo(u.empresaId);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
