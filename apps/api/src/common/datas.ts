// Colunas de vencimento são do tipo `date` (sem horário). Trabalhamos sempre
// com meia-noite UTC para o dia não "pular" por causa do fuso horário.

/** Data de hoje (fuso local) à meia-noite UTC. */
export function hoje() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function somarDias(data: Date, dias: number) {
  return new Date(data.getTime() + dias * 86_400_000);
}

export function somarMeses(data: Date, meses: number) {
  const nova = new Date(data);
  nova.setUTCMonth(nova.getUTCMonth() + meses);
  return nova;
}

export const centavos = (valor: number) => Math.round(valor * 100) / 100;

// Relatórios agrupam por dia/mês no horário de Brasília (o servidor roda em UTC).
// O Brasil não tem horário de verão desde 2019, então o deslocamento é fixo.
export const FUSO = 'America/Sao_Paulo';
const DESLOCAMENTO = '-03:00';

/** 00:00 de uma data AAAA-MM-DD no horário de Brasília. */
export const inicioDoDia = (iso: string) => new Date(`${iso}T00:00:00${DESLOCAMENTO}`);
/** 23:59:59 de uma data AAAA-MM-DD no horário de Brasília. */
export const fimDoDia = (iso: string) => new Date(`${iso}T23:59:59.999${DESLOCAMENTO}`);
/** Data AAAA-MM-DD de um momento, no horário de Brasília. */
export const diaNoFuso = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: FUSO });
