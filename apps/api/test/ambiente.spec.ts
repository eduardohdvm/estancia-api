import { afterEach, describe, expect, it } from 'vitest';
import { conferirBanco, conferirBancos, conferirSegredos, moduloLigado, registroPublicoLigado } from '../src/common/ambiente';

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

const HML = 'postgresql://u:s@ep-hml-pooler.sa-east-1.aws.neon.tech/db?sslmode=verify-full';
const PRD = 'postgresql://u:s@ep-prd-pooler.sa-east-1.aws.neon.tech/db?sslmode=verify-full';

describe('conferirBanco (trava entre ambientes)', () => {
  it('aceita o banco do próprio ambiente', () => {
    process.env.DB_HOSTS_PERMITIDOS = 'ep-hml-pooler.sa-east-1.aws.neon.tech';
    expect(conferirBanco('hml', HML)).toBe('ep-hml-pooler.sa-east-1.aws.neon.tech');
  });

  it('recusa HML apontando para o banco de PRD', () => {
    process.env.DB_HOSTS_PERMITIDOS = 'ep-hml-pooler.sa-east-1.aws.neon.tech';
    expect(() => conferirBanco('hml', PRD)).toThrow(/não é permitido em HML/);
  });

  it('exige a lista de hosts em HML e PRD', () => {
    delete process.env.DB_HOSTS_PERMITIDOS;
    expect(() => conferirBanco('prd', PRD)).toThrow(/DB_HOSTS_PERMITIDOS/);
  });

  it('em DEV sem lista aceita qualquer banco', () => {
    delete process.env.DB_HOSTS_PERMITIDOS;
    expect(conferirBanco('dev', 'postgresql://u:s@localhost:5432/db')).toBe('localhost');
  });

  it('confere também a URL das migrations (DIRECT_URL)', () => {
    process.env.DB_HOSTS_PERMITIDOS = 'ep-hml-pooler.sa-east-1.aws.neon.tech';
    process.env.DATABASE_URL = HML;
    process.env.DIRECT_URL = PRD.replace('-pooler', '');
    expect(() => conferirBancos('hml')).toThrow(/não é permitido em HML/);
  });

  it('recusa URL inválida', () => {
    expect(() => conferirBanco('dev', 'não é url')).toThrow(/URL válida/);
  });
});

describe('conferirSegredos', () => {
  it('recusa JWT_SECRET curto em PRD', () => {
    process.env.JWT_SECRET = 'curto';
    process.env.DATABASE_URL = PRD;
    expect(() => conferirSegredos('prd')).toThrow(/32 caracteres/);
  });

  it('recusa SEED_DEMO em PRD', () => {
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.DATABASE_URL = PRD;
    process.env.SEED_DEMO = 'true';
    expect(() => conferirSegredos('prd')).toThrow(/SEED_DEMO/);
  });

  it('exige FISCAL_CHAVE só com o módulo fiscal ligado', () => {
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.DATABASE_URL = PRD;
    delete process.env.FISCAL_CHAVE;
    process.env.MODULOS_OPCIONAIS = '';
    expect(() => conferirSegredos('hml')).not.toThrow();
    process.env.MODULOS_OPCIONAIS = 'fiscal';
    expect(() => conferirSegredos('hml')).toThrow(/FISCAL_CHAVE/);
  });
});

describe('módulos opcionais e registro público', () => {
  it('ficam desligados por padrão', () => {
    delete process.env.MODULOS_OPCIONAIS;
    delete process.env.REGISTRO_PUBLICO;
    expect(moduloLigado('pdv')).toBe(false);
    expect(moduloLigado('fiscal')).toBe(false);
    expect(registroPublicoLigado()).toBe(false);
  });

  it('ligam pela lista', () => {
    process.env.MODULOS_OPCIONAIS = ' PDV , crm';
    expect(moduloLigado('pdv')).toBe(true);
    expect(moduloLigado('crm')).toBe(true);
    expect(moduloLigado('fiscal')).toBe(false);
  });
});
