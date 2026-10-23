import { Module } from '@nestjs/common';
import { PessoasController } from './pessoas.controller';
import { PessoasService } from './pessoas.service';

@Module({
  controllers: [PessoasController],
  providers: [PessoasService],
})
export class PessoasModule {}
