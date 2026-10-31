import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrations usam a conexão direta (sem pooler) do Neon; a aplicação usa DATABASE_URL (com pooler).
    // Sem nenhuma das duas, os comandos que não usam o banco (ex.: generate) continuam funcionando.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
    // Banco auxiliar que o `migrate dev` usa para comparar o schema (opcional).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
