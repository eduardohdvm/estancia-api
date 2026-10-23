import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './common/auth.guard';
import { PrismaErroFilter } from './common/prisma-erro.filter';
import { ComprasModule } from './compras/compras.module';
import { CrmModule } from './crm/crm.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EmailModule } from './email/email.module';
import { EstoqueModule } from './estoque/estoque.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { ImportacaoModule } from './importacao/importacao.module';
import { PdvModule } from './pdv/pdv.module';
import { PessoasModule } from './pessoas/pessoas.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProdutosModule } from './produtos/produtos.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { SaudeController } from './saude.controller';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VendasModule } from './vendas/vendas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as `${number}h` },
    }),
    PrismaModule,
    AuthModule,
    UsuariosModule,
    PessoasModule,
    ProdutosModule,
    EstoqueModule,
    VendasModule,
    FinanceiroModule,
    DashboardModule,
    PdvModule,
    ComprasModule,
    CrmModule,
    RelatoriosModule,
    ImportacaoModule,
    EmailModule,
  ],
  controllers: [SaudeController],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: PrismaErroFilter },
  ],
})
export class AppModule {}
