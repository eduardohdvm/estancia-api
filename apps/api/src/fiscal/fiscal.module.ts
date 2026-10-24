import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Perfis } from '../common/decorators';
import { Usuario, type UsuarioLogado } from '../common/usuario-logado';
import { CancelarNotaDto, CertificadoDto, ConfiguracaoFiscalDto, EmitirNfceDto, FiltroNotaDto } from './fiscal.dto';
import { FiscalService } from './fiscal.service';

@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Perfis('GERENTE', 'FINANCEIRO')
  @Get('configuracao')
  configuracao(@Usuario() u: UsuarioLogado) {
    return this.fiscal.configuracao(u.empresaId);
  }

  @Perfis('GERENTE')
  @Put('configuracao')
  salvarConfiguracao(@Usuario() u: UsuarioLogado, @Body() dto: ConfiguracaoFiscalDto) {
    return this.fiscal.salvarConfiguracao(u.empresaId, dto);
  }

  @Perfis('GERENTE')
  @Post('certificado')
  @HttpCode(200)
  enviarCertificado(@Usuario() u: UsuarioLogado, @Body() dto: CertificadoDto) {
    return this.fiscal.enviarCertificado(u.empresaId, dto);
  }

  @Perfis('GERENTE')
  @Delete('certificado')
  removerCertificado(@Usuario() u: UsuarioLogado) {
    return this.fiscal.removerCertificado(u.empresaId);
  }

  @Perfis('GERENTE')
  @Post('testar-conexao')
  @HttpCode(200)
  testarConexao(@Usuario() u: UsuarioLogado, @Query('modelo') modelo?: 'NFE' | 'NFCE') {
    return this.fiscal.testarConexao(u.empresaId, modelo);
  }

  @Perfis('GERENTE', 'FINANCEIRO', 'VENDEDOR', 'CAIXA')
  @Get('notas')
  listar(@Usuario() u: UsuarioLogado, @Query() filtro: FiltroNotaDto) {
    return this.fiscal.listar(u.empresaId, filtro);
  }

  @Perfis('GERENTE', 'FINANCEIRO', 'VENDEDOR', 'CAIXA')
  @Get('notas/:id')
  buscar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string) {
    return this.fiscal.buscar(u.empresaId, id);
  }

  @Perfis('GERENTE', 'FINANCEIRO', 'VENDEDOR')
  @Post('pedidos/:pedidoId/nfe')
  @HttpCode(200)
  emitirNfe(@Usuario() u: UsuarioLogado, @Param('pedidoId', ParseUUIDPipe) pedidoId: string) {
    return this.fiscal.emitirNfe(u, pedidoId);
  }

  @Perfis('GERENTE', 'VENDEDOR', 'CAIXA')
  @Post('pedidos/:pedidoId/nfce')
  @HttpCode(200)
  emitirNfce(@Usuario() u: UsuarioLogado, @Param('pedidoId', ParseUUIDPipe) pedidoId: string, @Body() dto: EmitirNfceDto) {
    return this.fiscal.emitirNfce(u, pedidoId, dto);
  }

  @Perfis('GERENTE')
  @Post('notas/:id/cancelar')
  @HttpCode(200)
  cancelar(@Usuario() u: UsuarioLogado, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelarNotaDto) {
    return this.fiscal.cancelar(u.empresaId, id, dto);
  }
}

@Module({
  controllers: [FiscalController],
  providers: [FiscalService],
  exports: [FiscalService],
})
export class FiscalModule {}
