import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { appEnv, conferirBancos, conferirSegredos } from './common/ambiente';

async function bootstrap() {
  // Recusa subir com configuração perigosa: segredos faltando ou banco de outro ambiente (ADR-006).
  const ambiente = appEnv();
  conferirSegredos(ambiente);
  const hostBanco = conferirBancos(ambiente)[0];

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Na hospedagem há um proxy na frente: o IP real do visitante vem no cabeçalho X-Forwarded-For.
  app.set('trust proxy', 1);
  // Cabeçalhos de segurança. A CSP fica para quando o painel deixar de usar scripts inline do Next.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  if (ambiente !== 'prd') {
    const doc = new DocumentBuilder()
      .setTitle('Estância Maciel API')
      .setDescription(`Ambiente ${ambiente.toUpperCase()}`)
      .setVersion('1')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  }
  // Importação de planilhas envia até 5.000 linhas de uma vez.
  app.useBodyParser('json', { limit: '10mb' });
  app.enableCors({ origin: (process.env.WEB_URL ?? 'http://localhost:3000').split(',') });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos que não estão no DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Em produção a API também entrega o site (gerado por `npm run build -w apps/web`).
  const site = process.env.WEB_DIST ?? join(__dirname, '..', '..', 'web', 'out');
  if (existsSync(site)) {
    // O Next pede os arquivos de pré-carregamento como "__next.a.b.__PAGE__.txt",
    // mas a exportação grava em pastas: "__next.a/b/__PAGE__.txt".
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const m = req.path.match(/^(.*\/)__next\.([^/]+)\.txt$/);
      if (m && !existsSync(join(site, req.path))) {
        const [primeiro, ...resto] = m[2].split('.');
        const aninhado = `${m[1]}__next.${primeiro}/${resto.join('/')}.txt`;
        if (existsSync(join(site, aninhado))) req.url = aninhado + req.url.slice(req.path.length);
      }
      next();
    });
    app.useStaticAssets(site);
    // Qualquer outro endereço que não seja da API mostra a página "não encontrada" do site.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.status(404).sendFile(join(site, '404.html'));
    });
  }

  const porta = Number(process.env.PORT ?? 3333);
  await app.listen(porta);
  console.log(`Estância Maciel (${ambiente}) rodando em http://localhost:${porta}${existsSync(site) ? '' : '/api'} · banco ${hostBanco}`);
}
void bootstrap();
