import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

// Certificado digital, senha e CSC ficam criptografados no banco (AES-256-GCM).
// A chave vem de FISCAL_CHAVE, sem cair para o JWT_SECRET: os dois segredos ficam independentes.
// Atenção: trocar essa variável torna ilegíveis os certificados já gravados.

let chaveCache: Buffer | null = null;
function chave() {
  if (chaveCache) return chaveCache;
  const base = process.env.FISCAL_CHAVE;
  if (!base) throw new Error('Defina FISCAL_CHAVE para guardar dados fiscais');
  chaveCache = scryptSync(base, 'verissimo-fiscal', 32);
  return chaveCache;
}

export function cifrar(dado: string | Buffer): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  const conteudo = Buffer.concat([cifra.update(typeof dado === 'string' ? Buffer.from(dado, 'utf8') : dado), cifra.final()]);
  return `v1:${Buffer.concat([iv, cifra.getAuthTag(), conteudo]).toString('base64')}`;
}

export function decifrar(valor: string): Buffer {
  const bruto = Buffer.from(valor.replace(/^v1:/, ''), 'base64');
  const decifra = createDecipheriv('aes-256-gcm', chave(), bruto.subarray(0, 12));
  decifra.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([decifra.update(bruto.subarray(28)), decifra.final()]);
}
