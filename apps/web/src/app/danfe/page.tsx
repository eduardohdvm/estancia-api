'use client';

// DANFE para impressão, montado a partir do XML autorizado (o que foi aceito pela SEFAZ).
// NFC-e: cupom de 80 mm com QR Code. NF-e: folha A4 com código de barras da chave.
import { Printer } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { chaveFormatada } from '@/lib/fiscal';
import type { NotaFiscal } from '@/lib/tipos';

export default function Pagina() {
  return (
    <Suspense>
      <Danfe />
    </Suspense>
  );
}

const FORMAS: Record<string, string> = { '01': 'Dinheiro', '03': 'Cartão de crédito', '04': 'Cartão de débito', '05': 'Crédito loja', '15': 'Boleto', '17': 'Pix', '99': 'Outros' };
const reais = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtd = (v: string | null | undefined) => Number(v ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
const dataHora = (v: string | null | undefined) => (v ? new Date(v).toLocaleString('pt-BR') : '');
const doc = (v: string | null | undefined) => {
  const d = (v ?? '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return v ?? '';
};

/** Leitor simples do XML: primeiro elemento com o nome dentro de um nó. */
function ler(xml: string) {
  const d = new DOMParser().parseFromString(xml, 'application/xml');
  const no = (raiz: Element | Document, nome: string) => raiz.getElementsByTagName(nome)[0] as Element | undefined;
  const txt = (raiz: Element | Document | undefined, nome: string) => (raiz ? (raiz.getElementsByTagName(nome)[0]?.textContent ?? null) : null);
  const emit = no(d, 'emit')!;
  const dest = no(d, 'dest');
  const total = no(d, 'ICMSTot')!;
  return {
    ide: { numero: txt(d, 'nNF'), serie: txt(d, 'serie'), emissao: txt(d, 'dhEmi'), natOp: txt(d, 'natOp'), tpAmb: txt(d, 'tpAmb') },
    emit: {
      nome: txt(emit, 'xNome'), fantasia: txt(emit, 'xFant'), cnpj: txt(emit, 'CNPJ'), ie: txt(emit, 'IE'),
      endereco: [txt(emit, 'xLgr'), txt(emit, 'nro'), txt(emit, 'xBairro')].filter(Boolean).join(', '), cidade: `${txt(emit, 'xMun')} - ${txt(emit, 'UF')}`, cep: txt(emit, 'CEP'), fone: txt(emit, 'fone'),
    },
    dest: dest
      ? {
          nome: txt(dest, 'xNome'), documento: txt(dest, 'CNPJ') ?? txt(dest, 'CPF'), ie: txt(dest, 'IE'),
          endereco: [txt(dest, 'xLgr'), txt(dest, 'nro'), txt(dest, 'xBairro')].filter(Boolean).join(', '), cidade: txt(dest, 'xMun'), uf: txt(dest, 'UF'), cep: txt(dest, 'CEP'),
        }
      : null,
    itens: Array.from(d.getElementsByTagName('det')).map((det) => ({
      codigo: txt(det, 'cProd'), descricao: txt(det, 'xProd'), ncm: txt(det, 'NCM'), cfop: txt(det, 'CFOP'), csosn: txt(det, 'CSOSN'),
      unidade: txt(det, 'uCom'), quantidade: txt(det, 'qCom'), unitario: txt(det, 'vUnCom'), total: txt(det, 'vProd'), desconto: txt(det, 'vDesc'),
    })),
    total: { produtos: txt(total, 'vProd'), desconto: txt(total, 'vDesc'), frete: txt(total, 'vFrete'), nota: txt(total, 'vNF') },
    pagamentos: Array.from(d.getElementsByTagName('detPag')).map((p) => ({ forma: FORMAS[txt(p, 'tPag') ?? ''] ?? 'Outros', valor: txt(p, 'vPag') })),
    troco: txt(d, 'vTroco'),
    duplicatas: Array.from(d.getElementsByTagName('dup')).map((p) => ({ numero: txt(p, 'nDup'), vencimento: txt(p, 'dVenc'), valor: txt(p, 'vDup') })),
    modFrete: txt(d, 'modFrete'),
    infCpl: txt(d, 'infCpl'),
    protocolo: { numero: txt(d, 'nProt'), data: txt(d, 'dhRecbto') },
    urlChave: txt(d, 'urlChave'),
  };
}

function Danfe() {
  const id = useSearchParams().get('id') ?? '';
  const [nota, setNota] = useState<NotaFiscal | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api<NotaFiscal>(`/fiscal/notas/${id}`).then(setNota).catch((e: Error) => setErro(e.message));
  }, [id]);

  const dados = useMemo(() => (nota?.xml ? ler(nota.xml) : null), [nota]);

  if (erro) return <p className="p-8 text-rose-600">{erro}</p>;
  if (!nota || !dados) return <p className="p-8 text-slate-500">Carregando…</p>;

  const semValor = nota.ambiente !== 'PRODUCAO';
  const marca =
    nota.status === 'CANCELADA'
      ? 'NOTA CANCELADA'
      : nota.ambiente === 'SIMULACAO'
        ? 'SIMULAÇÃO - NÃO ENVIADA À SEFAZ - SEM VALOR FISCAL'
        : semValor
          ? 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL'
          : '';

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-end px-4 print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Printer className="size-4" /> Imprimir
        </button>
      </div>
      {nota.modelo === 'NFCE' ? <Cupom nota={nota} d={dados} marca={marca} /> : <FolhaA4 nota={nota} d={dados} marca={marca} />}
    </div>
  );
}

type Dados = ReturnType<typeof ler>;

// ─────────── NFC-e (cupom 80 mm) ───────────

function Cupom({ nota, d, marca }: { nota: NotaFiscal; d: Dados; marca: string }) {
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (nota.qrCode) import('qrcode').then((m) => m.toDataURL(nota.qrCode!, { margin: 1, width: 200 })).then(setQr);
  }, [nota.qrCode]);

  return (
    <div className="mx-auto w-[80mm] bg-white p-3 font-mono text-[11px] leading-tight text-black shadow print:shadow-none">
      <style>{'@page { size: 80mm auto; margin: 0; }'}</style>
      <div className="text-center">
        <p className="font-bold">{d.emit.fantasia ?? d.emit.nome}</p>
        <p>{d.emit.nome}</p>
        <p>CNPJ {doc(d.emit.cnpj)} IE {d.emit.ie}</p>
        <p>{d.emit.endereco}</p>
        <p>{d.emit.cidade}</p>
      </div>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center font-bold">DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
      {marca && <p className="my-1 border border-black p-1 text-center font-bold">{marca}</p>}
      <hr className="my-2 border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="text-left">
            <th>Descrição</th>
            <th className="pl-1.5 text-right">Qtd</th>
            <th className="pl-1.5 text-right">Unit</th>
            <th className="pl-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {d.itens.map((i, n) => (
            <tr key={n} className="align-top">
              <td>
                {i.codigo} {i.descricao}
              </td>
              <td className="whitespace-nowrap pl-1.5 text-right">
                {qtd(i.quantidade)} {i.unidade}
              </td>
              <td className="whitespace-nowrap pl-1.5 text-right">{reais(i.unitario)}</td>
              <td className="whitespace-nowrap pl-1.5 text-right">{reais(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-2 border-dashed border-black" />
      <Linha rotulo="Qtd. total de itens" valor={String(d.itens.length)} />
      <Linha rotulo="Valor total R$" valor={reais(d.total.produtos)} />
      {Number(d.total.desconto) > 0 && <Linha rotulo="Descontos R$" valor={reais(d.total.desconto)} />}
      <Linha rotulo="Valor a pagar R$" valor={reais(d.total.nota)} forte />
      <p className="mt-1">FORMA DE PAGAMENTO</p>
      {d.pagamentos.map((p, n) => (
        <Linha key={n} rotulo={p.forma} valor={reais(p.valor)} />
      ))}
      {Number(d.troco) > 0 && <Linha rotulo="Troco R$" valor={reais(d.troco)} />}
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">Consulte pela chave de acesso em</p>
      <p className="break-all text-center">{d.urlChave}</p>
      <p className="mt-1 text-center font-bold">{chaveFormatada(nota.chave)}</p>
      <hr className="my-2 border-dashed border-black" />
      <p className="text-center">{d.dest?.documento ? `CONSUMIDOR - CPF/CNPJ ${doc(d.dest.documento)}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</p>
      <p className="mt-1 text-center font-bold">
        NFC-e nº {d.ide.numero} Série {d.ide.serie} {dataHora(d.ide.emissao)}
      </p>
      <p className="text-center">Protocolo de autorização: {d.protocolo.numero}</p>
      <p className="text-center">Data de autorização: {dataHora(d.protocolo.data)}</p>
      {qr && <img src={qr} alt="QR Code da NFC-e" className="mx-auto my-2 w-40" />}
      {d.infCpl && <p className="mt-1 text-center text-[10px]">{d.infCpl}</p>}
    </div>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={`flex justify-between ${forte ? 'font-bold' : ''}`}>
      <span>{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}

// ─────────── NF-e (DANFE A4) ───────────

function FolhaA4({ nota, d, marca }: { nota: NotaFiscal; d: Dados; marca: string }) {
  const barras = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (barras.current) import('jsbarcode').then((m) => m.default(barras.current!, nota.chave, { format: 'CODE128C', displayValue: false, height: 42, width: 1.1, margin: 0 }));
  }, [nota.chave]);

  const Caixa = ({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) => (
    <div className={`border border-black px-1 py-0.5 ${className}`}>
      <p className="text-[7px] uppercase">{titulo}</p>
      <div className="text-[10px] font-medium">{children || ' '}</div>
    </div>
  );

  return (
    <div className="relative mx-auto w-[210mm] bg-white p-[8mm] text-black shadow print:shadow-none">
      <style>{'@page { size: A4; margin: 0; }'}</style>
      {marca && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="-rotate-30 text-center text-3xl font-bold text-black/15">{marca}</p>
        </div>
      )}

      <div className="grid grid-cols-[1.4fr_0.6fr_1.4fr] border border-black">
        <div className="border-r border-black p-2">
          <p className="text-sm font-bold">{d.emit.nome}</p>
          <p className="text-[10px]">{d.emit.endereco}</p>
          <p className="text-[10px]">
            {d.emit.cidade} - CEP {d.emit.cep}
          </p>
          {d.emit.fone && <p className="text-[10px]">Fone {d.emit.fone}</p>}
        </div>
        <div className="border-r border-black p-2 text-center">
          <p className="text-lg font-bold">DANFE</p>
          <p className="text-[8px]">Documento Auxiliar da Nota Fiscal Eletrônica</p>
          <p className="mt-1 text-[9px]">0 - Entrada / 1 - Saída</p>
          <p className="mx-auto mt-0.5 w-6 border border-black text-sm font-bold">1</p>
          <p className="mt-1 text-[10px] font-bold">Nº {String(d.ide.numero).padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1.')}</p>
          <p className="text-[10px]">Série {d.ide.serie}</p>
        </div>
        <div className="p-2">
          <svg ref={barras} className="h-11 w-full" />
          <p className="mt-1 text-[7px] uppercase">Chave de acesso</p>
          <p className="font-mono text-[10px] font-bold">{chaveFormatada(nota.chave)}</p>
          <p className="mt-1 text-[8px]">Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da SEFAZ autorizadora</p>
        </div>
      </div>
      <div className="grid grid-cols-[1.4fr_1.4fr]">
        <Caixa titulo="Natureza da operação">{d.ide.natOp}</Caixa>
        <Caixa titulo="Protocolo de autorização de uso">
          {d.protocolo.numero} {dataHora(d.protocolo.data)}
        </Caixa>
      </div>
      <div className="grid grid-cols-3">
        <Caixa titulo="Inscrição estadual">{d.emit.ie}</Caixa>
        <Caixa titulo="Inscrição estadual do subst. trib.">{''}</Caixa>
        <Caixa titulo="CNPJ">{doc(d.emit.cnpj)}</Caixa>
      </div>

      <p className="mt-2 text-[8px] font-bold uppercase">Destinatário / remetente</p>
      <div className="grid grid-cols-[2fr_1fr_0.8fr]">
        <Caixa titulo="Nome / razão social">{d.dest?.nome}</Caixa>
        <Caixa titulo="CNPJ / CPF">{doc(d.dest?.documento)}</Caixa>
        <Caixa titulo="Data de emissão">{dataHora(d.ide.emissao).slice(0, 10)}</Caixa>
      </div>
      <div className="grid grid-cols-[2fr_1fr_0.8fr]">
        <Caixa titulo="Endereço">{d.dest?.endereco}</Caixa>
        <Caixa titulo="Município / UF">{d.dest ? `${d.dest.cidade} - ${d.dest.uf}` : ''}</Caixa>
        <Caixa titulo="Inscrição estadual">{d.dest?.ie}</Caixa>
      </div>

      {d.duplicatas.length > 0 && (
        <>
          <p className="mt-2 text-[8px] font-bold uppercase">Fatura / duplicatas</p>
          <div className="flex flex-wrap border border-black">
            {d.duplicatas.map((dup) => (
              <div key={dup.numero} className="border-r border-black px-2 py-0.5 text-[9px]">
                {dup.numero} · {dup.vencimento?.split('-').reverse().join('/')} · R$ {reais(dup.valor)}
              </div>
            ))}
          </div>
        </>
      )}

      <p className="mt-2 text-[8px] font-bold uppercase">Cálculo do imposto</p>
      <div className="grid grid-cols-6">
        <Caixa titulo="Base de cálculo ICMS">0,00</Caixa>
        <Caixa titulo="Valor do ICMS">0,00</Caixa>
        <Caixa titulo="Valor total dos produtos">{reais(d.total.produtos)}</Caixa>
        <Caixa titulo="Valor do frete">{reais(d.total.frete)}</Caixa>
        <Caixa titulo="Desconto">{reais(d.total.desconto)}</Caixa>
        <Caixa titulo="Valor total da nota">{reais(d.total.nota)}</Caixa>
      </div>

      <p className="mt-2 text-[8px] font-bold uppercase">Transportador / volumes transportados</p>
      <Caixa titulo="Frete por conta">{d.modFrete === '9' ? '9 - Sem ocorrência de transporte' : d.modFrete === '0' ? '0 - Por conta do emitente' : d.modFrete}</Caixa>

      <p className="mt-2 text-[8px] font-bold uppercase">Dados dos produtos / serviços</p>
      <table className="w-full border-collapse text-[8px]">
        <thead>
          <tr>
            {['Código', 'Descrição', 'NCM', 'CSOSN', 'CFOP', 'Un', 'Qtd', 'V. unit', 'Desc.', 'V. total'].map((t) => (
              <th key={t} className="border border-black px-1 text-left font-normal uppercase">
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.itens.map((i, n) => (
            <tr key={n}>
              <td className="border border-black px-1">{i.codigo}</td>
              <td className="border border-black px-1">{i.descricao}</td>
              <td className="border border-black px-1">{i.ncm}</td>
              <td className="border border-black px-1">{i.csosn}</td>
              <td className="border border-black px-1">{i.cfop}</td>
              <td className="border border-black px-1">{i.unidade}</td>
              <td className="border border-black px-1 text-right">{qtd(i.quantidade)}</td>
              <td className="border border-black px-1 text-right">{reais(i.unitario)}</td>
              <td className="border border-black px-1 text-right">{reais(i.desconto)}</td>
              <td className="border border-black px-1 text-right">{reais(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-[8px] font-bold uppercase">Dados adicionais</p>
      <Caixa titulo="Informações complementares" className="min-h-16">
        {d.infCpl}
      </Caixa>
    </div>
  );
}
