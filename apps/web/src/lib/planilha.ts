// Leitura de planilhas (Excel .xlsx ou CSV) no navegador, antes de mandar para a API.
// A primeira linha preenchida é o cabeçalho; cada linha vira { "Nome da coluna": valor }.

export type LinhaPlanilha = Record<string, string | number | boolean | null>;

export async function lerPlanilha(arquivo: File): Promise<{ cabecalhos: string[]; linhas: LinhaPlanilha[] }> {
  const nome = arquivo.name.toLowerCase();
  let tabela: unknown[][];
  if (nome.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    tabela = await readSheet(arquivo);
  } else if (nome.endsWith('.csv') || nome.endsWith('.txt')) {
    tabela = await lerCsv(arquivo);
  } else {
    throw new Error('Formato não suportado. Use .xlsx (Excel) ou .csv. Planilhas .xls antigas: salve como .xlsx antes.');
  }

  const vazia = (linha: unknown[]) => linha.every((c) => c === null || c === undefined || String(c).trim() === '');
  const preenchidas = tabela.filter((l) => !vazia(l));
  if (preenchidas.length < 2) throw new Error('A planilha precisa de um cabeçalho e pelo menos uma linha de dados.');

  const cabecalhos = preenchidas[0].map((c, i) => (c === null || c === undefined || String(c).trim() === '' ? `Coluna ${i + 1}` : String(c).trim()));
  const linhas = preenchidas.slice(1).map((linha) =>
    Object.fromEntries(
      cabecalhos.map((c, i) => {
        const v = linha[i];
        // Datas do Excel viram texto; números e textos seguem como estão.
        return [c, v instanceof Date ? v.toLocaleDateString('pt-BR') : ((v ?? null) as LinhaPlanilha[string])];
      }),
    ),
  );
  return { cabecalhos, linhas };
}

/** CSV com ";" ou "," e acentuação em UTF-8 ou no padrão do Excel brasileiro (Windows-1252). */
async function lerCsv(arquivo: File): Promise<unknown[][]> {
  const bytes = await arquivo.arrayBuffer();
  let texto = new TextDecoder('utf-8').decode(bytes);
  if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(bytes);
  const { default: Papa } = await import('papaparse');
  const resultado = Papa.parse<string[]>(texto.replace(/^﻿/, ''), { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t', '|'] });
  return resultado.data;
}

/** Planilha-modelo para a pessoa preencher, com as colunas aceitas e linhas de exemplo. */
export async function baixarModelo(nomeArquivo: string, cabecalhos: string[], exemplos: (string | number)[][]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  await writeXlsxFile(
    [
      cabecalhos.map((c) => ({ value: c, type: String, fontWeight: 'bold' as const, backgroundColor: '#E2E8F0' })),
      ...exemplos.map((linha) => linha.map((v) => (typeof v === 'number' ? { value: v, type: Number } : { value: v, type: String }))),
    ],
    { columns: cabecalhos.map(() => ({ width: 20 })), sheet: 'Modelo' },
  ).toFile(`${nomeArquivo}.xlsx`);
}
