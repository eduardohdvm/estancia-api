import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module';
import { VendasModule } from '../vendas/vendas.module';
import { PdvController } from './pdv.controller';
import { PdvService } from './pdv.service';

@Module({
  imports: [EstoqueModule, VendasModule],
  controllers: [PdvController],
  providers: [PdvService],
})
export class PdvModule {}
