/**
 * Normaliza telefone brasileiro para E.164 (+5511999998888).
 * Aceita "(11) 99999-8888", "11999998888", "+55 11 99999-8888". Devolve null se não for válido.
 */
export function telefoneE164(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = '55' + digitos;
  if (!/^55\d{10,11}$/.test(digitos)) return null;
  return '+' + digitos;
}

/** "+5511999998888" → "(11) 99999-8888" */
export function telefoneFormatado(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(2);
  const ddd = d.slice(0, 2);
  const numero = d.slice(2);
  return `(${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
}
