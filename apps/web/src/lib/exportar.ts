// Exportação de relatórios para Excel e PDF, feita no navegador.
// As bibliotecas só são baixadas quando a pessoa clica em exportar.
import { moeda, numero } from './formato';

export type TipoColuna = 'texto' | 'moeda' | 'numero' | 'percentual';
export type Valor = string | number | null;

export interface ColunaRelatorio {
  titulo: string;
  tipo?: TipoColuna;
}

export interface DadosExportacao {
  titulo: string;
  /** Ex.: "Período: 01/10/2026 a 23/10/2026". */
  subtitulo: string;
  colunas: ColunaRelatorio[];
  linhas: Valor[][];
  /** Linha de totais no fim (opcional). */
  totais?: Valor[];
  /** Linhas que devem sair em negrito (ex.: subtotais do DRE), pelo índice. */
  destaques?: number[];
  nomeArquivo: string;
}

const formatarTexto = (v: Valor, tipo: TipoColuna = 'texto') => {
  if (v === null || v === '') return '';
  if (typeof v === 'string') return v;
  if (tipo === 'moeda') return moeda(v);
  if (tipo === 'percentual') return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  if (tipo === 'numero') return numero(v);
  return String(v);
};

const formatoExcel: Record<TipoColuna, string | undefined> = {
  texto: undefined,
  moeda: '"R$" #,##0.00;[Red]-"R$" #,##0.00',
  numero: '#,##0.###',
  percentual: '0.00"%"',
};

export async function exportarExcel(d: DadosExportacao) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const celula = (v: Valor, tipo: TipoColuna = 'texto', negrito = false) =>
    typeof v === 'number'
      ? { value: v, type: Number, format: formatoExcel[tipo], fontWeight: negrito ? ('bold' as const) : undefined }
      : { value: v ?? '', type: String, fontWeight: negrito ? ('bold' as const) : undefined };

  const dados = [
    [{ value: d.titulo, type: String, fontWeight: 'bold' as const, fontSize: 14 }],
    [{ value: d.subtitulo, type: String }],
    [],
    d.colunas.map((c) => ({ value: c.titulo, type: String, fontWeight: 'bold' as const, backgroundColor: '#E2E8F0' })),
    ...d.linhas.map((linha, i) => linha.map((v, j) => celula(v, d.colunas[j]?.tipo, d.destaques?.includes(i)))),
    ...(d.totais ? [d.totais.map((v, j) => celula(v, d.colunas[j]?.tipo, true))] : []),
  ];
  await writeXlsxFile(dados, {
    sheet: d.titulo.slice(0, 31),
    columns: d.colunas.map((c, j) => ({ width: j === 0 ? 34 : c.tipo === 'texto' ? 22 : 16 })),
  }).toFile(`${d.nomeArquivo}.xlsx`);
}

export async function exportarPdf(d: DadosExportacao) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: d.colunas.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold').setFontSize(15).text(d.titulo, 40, 44);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100).text(d.subtitulo, 40, 60);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, largura - 40, 60, { align: 'right' });

  const numerica = (j: number) => (d.colunas[j]?.tipo ?? 'texto') !== 'texto';
  autoTable(doc, {
    startY: 74,
    head: [d.colunas.map((c) => c.titulo)],
    body: d.linhas.map((linha) => linha.map((v, j) => formatarTexto(v, d.colunas[j]?.tipo))),
    foot: d.totais ? [d.totais.map((v, j) => formatarTexto(v, d.colunas[j]?.tipo))] : undefined,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229] },
    footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
    columnStyles: Object.fromEntries(d.colunas.map((_, j) => [j, { halign: numerica(j) ? 'right' : 'left' }])),
    didParseCell: (c) => {
      if (c.section === 'body' && d.destaques?.includes(c.row.index)) c.cell.styles.fontStyle = 'bold';
      if (c.section !== 'body' && numerica(c.column.index)) c.cell.styles.halign = 'right';
    },
    didDrawPage: () => {
      const pagina = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8).setTextColor(150).text(`Estância Maciel · página ${pagina}`, largura - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
    },
  });
  doc.save(`${d.nomeArquivo}.pdf`);
}
