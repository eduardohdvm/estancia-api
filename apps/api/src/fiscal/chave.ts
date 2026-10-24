import { randomInt } from 'node:crypto';

/** Código IBGE de cada estado, usado na chave de acesso e no XML (cUF). */
export const CODIGO_UF: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
};

/** Dígito verificador da chave de acesso (módulo 11, pesos 2 a 9 da direita para a esquerda). */
export function digitoVerificador(chave43: string) {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Código numérico aleatório de 8 dígitos; a SEFAZ recusa sequências óbvias e o próprio número da nota. */
export function codigoNumerico(numero: number) {
  const proibidos = new Set(['00000000', '11111111', '22222222', '33333333', '44444444', '55555555', '66666666', '77777777', '88888888', '99999999', '12345678', '23456789', '34567890', '45678901', '56789012', '67890123', '78901234', '89012345', '90123456', '01234567', String(numero).padStart(8, '0')]);
  let codigo: string;
  do codigo = String(randomInt(0, 100_000_000)).padStart(8, '0');
  while (proibidos.has(codigo));
  return codigo;
}

/** Ano e mês (AAMM) no horário de Brasília. */
const anoMes = (data: Date) => data.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).replace(/-/g, '').slice(2, 6);

export function montarChave(p: { uf: string; emissao: Date; cnpj: string; modelo: '55' | '65'; serie: number; numero: number; codigoNumerico: string; tipoEmissao?: number }) {
  const base =
    CODIGO_UF[p.uf] +
    anoMes(p.emissao) +
    p.cnpj.padStart(14, '0') +
    p.modelo +
    String(p.serie).padStart(3, '0') +
    String(p.numero).padStart(9, '0') +
    String(p.tipoEmissao ?? 1) +
    p.codigoNumerico;
  return base + digitoVerificador(base);
}
