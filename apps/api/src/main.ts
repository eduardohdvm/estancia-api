import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('Defina JWT_SECRET no arquivo .env');

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos que não estão no DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const porta = Number(process.env.PORT ?? 3333);
  await app.listen(porta);
  console.log(`Verissimo ERP API rodando em http://localhost:${porta}/api`);
}
void bootstrap();
