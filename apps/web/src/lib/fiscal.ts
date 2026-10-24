// Listas usadas nos formulários fiscais.

export const CSOSN = [
  ['102', '102 - Tributada pelo Simples sem permissão de crédito (mais comum)'],
  ['101', '101 - Tributada pelo Simples com permissão de crédito'],
  ['103', '103 - Isenção do ICMS no Simples para faixa de receita'],
  ['300', '300 - Imune'],
  ['400', '400 - Não tributada pelo Simples'],
  ['500', '500 - ICMS cobrado anteriormente por substituição tributária'],
  ['900', '900 - Outros'],
] as const;

export const ORIGENS = [
  [0, '0 - Nacional'],
  [1, '1 - Estrangeira (importação direta)'],
  [2, '2 - Estrangeira (adquirida no mercado interno)'],
  [3, '3 - Nacional com mais de 40% de conteúdo importado'],
  [4, '4 - Nacional (processos produtivos básicos)'],
  [5, '5 - Nacional com até 40% de conteúdo importado'],
  [6, '6 - Estrangeira sem similar nacional (importação direta)'],
  [7, '7 - Estrangeira sem similar nacional (mercado interno)'],
  [8, '8 - Nacional com mais de 70% de conteúdo importado'],
] as const;

export const rotuloModelo = (m: string) => (m === 'NFCE' ? 'NFC-e' : 'NF-e');

/** Chave de acesso em grupos de 4 dígitos, como impressa no DANFE. */
export const chaveFormatada = (chave: string) => chave.replace(/(\d{4})(?=\d)/g, '$1 ');
