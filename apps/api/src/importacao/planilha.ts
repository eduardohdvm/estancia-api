// Leitura tolerante de linhas vindas de planilhas (Excel/CSV) feitas por pessoas:
// nomes de coluna com ou sem acento, números no formato brasileiro, "sim/não" etc.

export type LinhaBruta = Record<string, unknown>;

/** "Preço de Venda" → "precodevenda". */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/**
 * Descobre qual coluna da planilha corresponde a cada campo, pelos apelidos aceitos.
 * Os apelidos vêm em ordem de preferência, e cada coluna só é usada por um campo.
 */
export function mapearColunas<C extends string>(cabecalhos: string[], apelidos: Record<C, string[]>) {
  const porNome = new Map(cabecalhos.map((c) => [normalizar(c), c]));
  const usadas = new Set<string>();
  const mapa = {} as Record<C, string | undefined>;
  for (const campo of Object.keys(apelidos) as C[]) {
    const coluna = apelidos[campo].map((a) => porNome.get(a)).find((c) => c !== undefined && !usadas.has(c));
    if (coluna) usadas.add(coluna);
    mapa[campo] = coluna;
  }
  return mapa;
}

export function texto(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

/**
 * Número em formato brasileiro ou americano: "1.234,56", "12,5", "12.5", "R$ 10".
 * Devolve `undefined` se vazio e `NaN` se não for número.
 */
export function numero(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/R\$|\s/g, '');
  if (s === '') return undefined;
  // Com vírgula, ou no padrão de milhar "1.234.567": ponto é separador de milhar.
  if (s.includes(',') || /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const VERDADEIRO = new Set(['sim', 's', 'x', '1', 'true', 'verdadeiro', 'yes', 'y']);
const FALSO = new Set(['nao', 'n', '0', 'false', 'falso', 'no']);

/** "Sim", "X", "1" → true; "Não", "0" → false; vazio → undefined. */
export function booleano(v: unknown): boolean | undefined | null {
  if (typeof v === 'boolean') return v;
  const s = texto(v);
  if (s === undefined) return undefined;
  const n = normalizar(s);
  if (VERDADEIRO.has(n)) return true;
  if (FALSO.has(n)) return false;
  return null; // valor não reconhecido
}

export const soDigitos = (v: string) => v.replace(/\D/g, '');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailValido = (v: string) => EMAIL.test(v);
