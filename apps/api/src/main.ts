import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('Defina JWT_SECRET no arquivo .env');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  // Na hospedagem há um proxy na frente: o IP real do visitante vem no cabeçalho X-Forwarded-For.
  app.set('trust proxy', 1);
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
  console.log(`Verissimo ERP rodando em http://localhost:${porta}${existsSync(site) ? '' : '/api'}`);
}
void bootstrap();
