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
