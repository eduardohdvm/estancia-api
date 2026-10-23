import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Sem DATABASE_URL os comandos que não usam o banco (ex.: generate) continuam funcionando.
    url: process.env.DATABASE_URL ?? '',
  },
});
