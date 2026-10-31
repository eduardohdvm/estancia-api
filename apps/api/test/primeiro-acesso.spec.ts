// Integração: o primeiro acesso cria um único administrador, mesmo com pedidos simultâneos.
// Roda num schema temporário (banco vazio) dentro de DATABASE_URL_TESTE e o apaga no fim.
import 'dotenv/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../src/auth/auth.service';
import type { EmailService } from '../src/email/email.module';
import { PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

const url = process.env.DATABASE_URL_TESTE;
// Migrations precisam de conexão direta (sem pooler); o Neon marca o pooler com "-pooler" no host.
const direta = url?.replace('-pooler', '');
const schema = `teste_primeiro_acesso_${Date.now()}`;
const comSchema = (u: string) => `${u}${u.includes('?') ? '&' : '?'}schema=${schema}`;

describe.skipIf(!url)('primeiro acesso (Postgres, banco vazio)', () => {
  let prisma: PrismaClient;
  let auth: AuthService;

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DIRECT_URL: comSchema(direta!), DATABASE_URL: comSchema(direta!) },
      stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 6 }, { schema }) });
    const jwt = new JwtService({ secret: 'segredo-de-teste-com-mais-de-32-caracteres' });
    auth = new AuthService(prisma as unknown as PrismaService, jwt, {} as EmailService);
  }, 180_000);

  afterAll(async () => {
    await prisma?.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); // eslint-disable-line no-restricted-properties
    await prisma?.$disconnect();
  });

  it('fica disponível enquanto não há usuários', async () => {
    expect(await auth.primeiroAcessoDisponivel()).toEqual({ disponivel: true });
  });

  it('pedidos simultâneos criam um único administrador da Estância Maciel', async () => {
    const tentativas = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) => auth.primeiroAcesso({ nome: `Pessoa ${i}`, email: `admin${i}@estancia.test`, senha: 'senha-forte-123' })),
    );
    expect(tentativas.filter((t) => t.status === 'fulfilled')).toHaveLength(1);
    expect(tentativas.filter((t) => t.status === 'rejected').every((t) => (t as PromiseRejectedResult).reason.status === 404)).toBe(true);

    const usuarios = await prisma.usuario.findMany({ include: { empresa: true } });
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].perfil).toBe('ADMIN');
    expect(usuarios[0].empresa.nome).toBe('Estância Maciel');
    // Cadastros iniciais prontos para uso.
    expect(await prisma.deposito.count()).toBe(1);
  });

  it('depois disso deixa de existir', async () => {
    expect(await auth.primeiroAcessoDisponivel()).toEqual({ disponivel: false });
    await expect(auth.primeiroAcesso({ nome: 'Intruso', email: 'x@x.com', senha: 'qualquer-senha' })).rejects.toMatchObject({ status: 404 });
  });
});
