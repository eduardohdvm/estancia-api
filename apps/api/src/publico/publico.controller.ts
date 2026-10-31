import { Body, Controller, Get, HttpCode, Ip, Post } from '@nestjs/common';
import { Publico } from '../common/decorators';
import { LimiteTentativas } from '../common/limite';
import { CriarOrcamentoPublicoDto, WhatsappAbertoDto } from './publico.dto';
import { PublicoService } from './publico.service';

// Freio contra robôs: cada IP pode criar poucos orçamentos por hora.
const orcamentosPorIp = new LimiteTentativas(15, 60 * 60 * 1000);

/** Rotas do catálogo público (sem login). */
@Publico()
@Controller('public')
export class PublicoController {
  constructor(private readonly publico: PublicoService) {}

  @Get('catalogo')
  catalogo() {
    return this.publico.catalogo();
  }

  @Post('orcamentos')
  criarOrcamento(@Body() dto: CriarOrcamentoPublicoDto, @Ip() ip: string) {
    orcamentosPorIp.registrar(ip);
    return this.publico.criarOrcamento(dto);
  }

  @Post('orcamentos/whatsapp-aberto')
  @HttpCode(200)
  whatsappAberto(@Body() dto: WhatsappAbertoDto) {
    return this.publico.whatsappAberto(dto.chave);
  }
}
