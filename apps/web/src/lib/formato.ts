const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });

export const moeda = (valor: number | string | null | undefined) => moedaFmt.format(Number(valor ?? 0));
export const numero = (valor: number | string | null | undefined) => numeroFmt.format(Number(valor ?? 0));

/** Datas "só dia" (vencimento) chegam como meia-noite UTC: formatamos em UTC para não voltar um dia. */
export const data = (valor: string | null | undefined) =>
  valor ? new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';

export const dataHora = (valor: string | null | undefined) =>
  valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Data de hoje no formato do <input type="date">. */
export function hojeIso(diasAMais = 0) {
  const d = new Date();
  d.setDate(d.getDate() + diasAMais);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Vencido = em aberto e com vencimento antes de hoje. */
export const vencido = (vencimento: string, status: string) => status === 'ABERTO' && vencimento.slice(0, 10) < hojeIso();

export const rotuloPerfil: Record<string, string> = {
  ADMIN: 'Administrador',
  GERENTE: 'Gerente',
  VENDEDOR: 'Vendedor',
  FINANCEIRO: 'Financeiro',
  ESTOQUISTA: 'Estoquista',
};
