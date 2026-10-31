/**
 * Configuração por ambiente (DEV, HML, PRD).
 * Lida uma vez na subida do servidor: um erro aqui impede a API de iniciar.
 */

export type AppEnv = 'dev' | 'test' | 'hml' | 'prd';

/** Módulos herdados do Verissimo que a Estância Maciel não usa por enquanto (ADR-004). */
export type ModuloOpcional = 'fiscal';

export const appEnv = (): AppEnv => {
  const valor = (process.env.APP_ENV ?? 'dev').toLowerCase();
  if (!['dev', 'test', 'hml', 'prd'].includes(valor)) throw new Error(`APP_ENV inválido: "${valor}" (use dev, test, hml ou prd)`);
  return valor as AppEnv;
};

/** `MODULOS_OPCIONAIS="fiscal"` liga esses módulos. Vazio = todos desligados. */
export const moduloLigado = (modulo: ModuloOpcional) =>
  (process.env.MODULOS_OPCIONAIS ?? '')
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .includes(modulo);

/** Cadastro público de empresas (SaaS do Verissimo). Desligado na Estância Maciel (ADR-007). */
export const registroPublicoLigado = () => process.env.REGISTRO_PUBLICO === 'true';

/**
 * Impede que um ambiente use o banco de outro (ADR-006): em HML e PRD o host de DATABASE_URL
 * precisa estar em DB_HOSTS_PERMITIDOS. Ex.: DB_HOSTS_PERMITIDOS="ep-abc-pooler.sa-east-1.aws.neon.tech".
 */
export function conferirBanco(env: AppEnv = appEnv(), url = process.env.DATABASE_URL) {
  if (!url) throw new Error('Defina DATABASE_URL');
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL não é uma URL válida');
  }
  const permitidos = (process.env.DB_HOSTS_PERMITIDOS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (env === 'hml' || env === 'prd') {
    if (!permitidos.length) throw new Error(`Em ${env.toUpperCase()} defina DB_HOSTS_PERMITIDOS com o host do banco deste ambiente`);
    if (!permitidos.includes(host)) throw new Error(`Banco "${host}" não é permitido em ${env.toUpperCase()}. Confira DATABASE_URL`);
  } else if (permitidos.length && !permitidos.includes(host)) {
    throw new Error(`Banco "${host}" não está em DB_HOSTS_PERMITIDOS`);
  }
  return host;
}

/** Confere a URL da aplicação e a das migrations (que rodam antes da API subir). */
export function conferirBancos(env: AppEnv = appEnv()) {
  const hosts = [conferirBanco(env, process.env.DATABASE_URL)];
  if (process.env.DIRECT_URL) hosts.push(conferirBanco(env, process.env.DIRECT_URL));
  return hosts;
}

/** Variáveis obrigatórias por ambiente; segredos fracos são recusados fora do DEV. */
export function conferirSegredos(env: AppEnv = appEnv()) {
  const faltando = ['JWT_SECRET', 'DATABASE_URL'].filter((v) => !process.env[v]);
  if (moduloLigado('fiscal') && !process.env.FISCAL_CHAVE) faltando.push('FISCAL_CHAVE');
  if (faltando.length) throw new Error(`Defina no ambiente: ${faltando.join(', ')}`);
  if ((env === 'hml' || env === 'prd') && (process.env.JWT_SECRET ?? '').length < 32) {
    throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em HML/PRD');
  }
  if (env === 'prd' && process.env.SEED_DEMO === 'true') {
    throw new Error('SEED_DEMO=true não é permitido em PRD');
  }
}
