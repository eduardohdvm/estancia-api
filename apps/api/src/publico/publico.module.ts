import { Module } from '@nestjs/common';
import { VendasModule } from '../vendas/vendas.module';
import { PublicoController } from './publico.controller';
import { PublicoService } from './publico.service';

@Module({
  imports: [VendasModule],
  controllers: [PublicoController],
  providers: [PublicoService],
})
export class PublicoModule {}
