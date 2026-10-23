import { Controller, Get } from '@nestjs/common';
import { Publico } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';

/** Usado pela hospedagem para saber se o sistema está no ar (e com banco respondendo). */
@Controller('saude')
export class SaudeController {
  constructor(private readonly prisma: PrismaService) {}

  @Publico()
  @Get()
  async verificar() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
