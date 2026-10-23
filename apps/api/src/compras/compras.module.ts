import { Module } from '@nestjs/common';
import { EstoqueModule } from '../estoque/estoque.module';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';

@Module({
  imports: [EstoqueModule],
  controllers: [ComprasController],
  providers: [ComprasService],
})
export class ComprasModule {}
