// Montagem do XML da NF-e (modelo 55) e NFC-e (modelo 65), layout 4.00, para emitentes
// do Simples Nacional (ICMS por CSOSN). A ordem dos campos segue o Manual de Orientação
// do Contribuinte: a SEFAZ valida contra o schema e recusa campos fora de ordem.
import { createHash } from 'node:crypto';
import { CODIGO_UF } from './chave';

export const NAMESPACE = 'http://www.portalfiscal.inf.br/nfe';
export const TEXTO_HOMOLOGACAO = 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
export const ITEM_HOMOLOGACAO = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';

export interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  codigoMunicipio: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string | null;
}

export interface ItemNota {
  codigo: string;
  ean?: string | null;
  descricao: string;
  ncm: string;
  cest?: string | null;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number; // já com o rateio do desconto do pedido
  frete: number; // rateio do frete do pedido
  origem: number;
  csosn: string;
}

/** Formas de pagamento (tPag): 01 dinheiro, 03 crédito, 04 débito, 05 crédito loja, 15 boleto, 17 Pix, 99 outros. */
export interface Pagamento {
  tPag: string;
  valor: number;
  aPrazo?: boolean;
  descricao?: string; // obrigatório quando tPag = 99
}

export interface DadosNota {
  modelo: '55' | '65';
  serie: number;
  numero: number;
  chave: string;
  codigoNumerico: string;
  emissao: Date;
  tpAmb: 1 | 2; // 1 = produção, 2 = homologação
  naturezaOperacao: string;
  emitente: { cnpj: string; razaoSocial: string; nomeFantasia?: string | null; ie: string; im?: string | null; cnae?: string | null; crt: number; endereco: Endereco };
  destinatario?: { documento: string; nome: string; ie?: string | null; indIEDest: 1 | 2 | 9; email?: string | null; endereco?: Endereco };
  itens: ItemNota[];
  pagamentos: Pagamento[];
  troco: number;
  duplicatas?: { numero: string; vencimento: Date; valor: number }[];
  informacoesComplementares?: string;
  responsavelTecnico?: { cnpj: string; contato: string; email: string; fone: string };
  nfce?: { cscId: string; csc: string; urlQrCode: string; urlConsulta: string };
}

// ─────────── Utilitários ───────────

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Texto limpo: sem quebras de linha nem espaços duplicados (a SEFAZ recusa espaços nas pontas). */
const limpar = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);
const tag = (nome: string, conteudo: string | number | null | undefined) =>
  conteudo === undefined || conteudo === null || conteudo === '' ? '' : `<${nome}>${typeof conteudo === 'number' ? conteudo : escapar(String(conteudo))}</${nome}>`;
const grupo = (nome: string, ...filhos: string[]) => `<${nome}>${filhos.join('')}</${nome}>`;
const dinheiro = (v: number) => v.toFixed(2);
const digitos = (v: string) => v.replace(/\D/g, '');
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Data e hora com fuso de Brasília: 2026-10-24T10:30:00-03:00. */
export function dataHoraSefaz(d: Date) {
  const local = new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 19);
  return `${local}-03:00`;
}
const dataSefaz = (d: Date) => d.toISOString().slice(0, 10);

function endereco(nome: 'enderEmit' | 'enderDest', e: Endereco) {
  return grupo(
    nome,
    tag('xLgr', limpar(e.logradouro, 60)),
    tag('nro', limpar(e.numero || 'S/N', 60)),
    tag('xCpl', e.complemento ? limpar(e.complemento, 60) : null),
    tag('xBairro', limpar(e.bairro, 60)),
    tag('cMun', digitos(e.codigoMunicipio)),
    tag('xMun', limpar(e.municipio, 60)),
    tag('UF', e.uf),
    tag('CEP', digitos(e.cep)),
    tag('cPais', '1058'),
    tag('xPais', 'BRASIL'),
    tag('fone', e.telefone ? digitos(e.telefone).slice(0, 14) : null),
  );
}

// ─────────── NF-e / NFC-e ───────────

export function montarNfe(d: DadosNota) {
  const nfce = d.modelo === '65';
  const homologacao = d.tpAmb === 2;
  const destUf = d.destinatario?.endereco?.uf;
  const idDest = destUf && destUf !== d.emitente.endereco.uf ? 2 : 1;
  const consumidorFinal = nfce || !d.destinatario || d.destinatario.indIEDest === 9 ? 1 : 0;

  const ide = grupo(
    'ide',
    tag('cUF', CODIGO_UF[d.emitente.endereco.uf]),
    tag('cNF', d.codigoNumerico),
    tag('natOp', limpar(d.naturezaOperacao, 60)),
    tag('mod', d.modelo),
    tag('serie', d.serie),
    tag('nNF', d.numero),
    tag('dhEmi', dataHoraSefaz(d.emissao)),
    nfce ? '' : tag('dhSaiEnt', dataHoraSefaz(d.emissao)),
    tag('tpNF', 1), // saída
    tag('idDest', idDest),
    tag('cMunFG', digitos(d.emitente.endereco.codigoMunicipio)),
    tag('tpImp', nfce ? 4 : 1), // 4 = DANFE NFC-e; 1 = DANFE retrato
    tag('tpEmis', 1), // emissão normal
    tag('cDV', d.chave.slice(-1)),
    tag('tpAmb', d.tpAmb),
    tag('finNFe', 1), // normal
    tag('indFinal', consumidorFinal),
    tag('indPres', nfce ? 1 : 9), // 1 = presencial; 9 = operação não presencial, outros
    tag('indIntermed', 0), // sem intermediador (marketplace)
    tag('procEmi', 0), // emissão por aplicativo do contribuinte
    tag('verProc', 'VerissimoERP 1.0'),
  );

  const e = d.emitente;
  const emit = grupo(
    'emit',
    tag('CNPJ', digitos(e.cnpj)),
    tag('xNome', limpar(e.razaoSocial, 60)),
    tag('xFant', e.nomeFantasia ? limpar(e.nomeFantasia, 60) : null),
    endereco('enderEmit', e.endereco),
    tag('IE', digitos(e.ie)),
    // IM e CNAE andam juntos no layout: só informa o CNAE quando há inscrição municipal.
    e.im ? tag('IM', digitos(e.im)) + tag('CNAE', e.cnae ? digitos(e.cnae) : null) : '',
    tag('CRT', e.crt),
  );

  let dest = '';
  if (d.destinatario) {
    const doc = digitos(d.destinatario.documento);
    dest = grupo(
      'dest',
      doc.length === 14 ? tag('CNPJ', doc) : tag('CPF', doc),
      tag('xNome', homologacao ? TEXTO_HOMOLOGACAO : limpar(d.destinatario.nome, 60)),
      d.destinatario.endereco ? endereco('enderDest', d.destinatario.endereco) : '',
      tag('indIEDest', d.destinatario.indIEDest),
      d.destinatario.indIEDest === 1 ? tag('IE', digitos(d.destinatario.ie ?? '')) : '',
      tag('email', d.destinatario.email ? limpar(d.destinatario.email, 60) : null),
    );
  }

  // Itens e totais. vProd = quantidade × valor unitário (arredondado), como a SEFAZ confere.
  let totalProdutos = 0;
  let totalDesconto = 0;
  let totalFrete = 0;
  const det = d.itens
    .map((item, i) => {
      const vProd = centavos(item.quantidade * item.valorUnitario);
      totalProdutos += vProd;
      totalDesconto += item.desconto;
      totalFrete += item.frete;
      const ean = item.ean && /^\d{8}$|^\d{12,14}$/.test(item.ean) ? item.ean : 'SEM GTIN';
      const prod = grupo(
        'prod',
        tag('cProd', limpar(item.codigo, 60)),
        tag('cEAN', ean),
        tag('xProd', homologacao && nfce && i === 0 ? ITEM_HOMOLOGACAO : limpar(item.descricao, 120)),
        tag('NCM', digitos(item.ncm)),
        tag('CEST', item.cest ? digitos(item.cest) : null),
        tag('CFOP', item.cfop),
        tag('uCom', limpar(item.unidade, 6)),
        tag('qCom', item.quantidade.toFixed(4)),
        tag('vUnCom', item.valorUnitario.toFixed(10).replace(/0{1,8}$/, '')),
        tag('vProd', dinheiro(vProd)),
        tag('cEANTrib', ean),
        tag('uTrib', limpar(item.unidade, 6)),
        tag('qTrib', item.quantidade.toFixed(4)),
        tag('vUnTrib', item.valorUnitario.toFixed(10).replace(/0{1,8}$/, '')),
        item.frete > 0 ? tag('vFrete', dinheiro(item.frete)) : '',
        item.desconto > 0 ? tag('vDesc', dinheiro(item.desconto)) : '',
        tag('indTot', 1),
      );
      // Simples Nacional: ICMS pelo CSOSN; PIS e COFINS sem destaque (CST 49).
      const imposto = grupo(
        'imposto',
        grupo('ICMS', icmsSimples(item.origem, item.csosn)),
        grupo('PIS', grupo('PISOutr', tag('CST', '49'), tag('vBC', '0.00'), tag('pPIS', '0.0000'), tag('vPIS', '0.00'))),
        grupo('COFINS', grupo('COFINSOutr', tag('CST', '49'), tag('vBC', '0.00'), tag('pCOFINS', '0.0000'), tag('vCOFINS', '0.00'))),
      );
      return `<det nItem="${i + 1}">${prod}${imposto}</det>`;
    })
    .join('');

  totalProdutos = centavos(totalProdutos);
  totalDesconto = centavos(totalDesconto);
  totalFrete = centavos(totalFrete);
  const valorNota = centavos(totalProdutos - totalDesconto + totalFrete);
  const zero = '0.00';
  const total = grupo(
    'total',
    grupo(
      'ICMSTot',
      tag('vBC', zero), tag('vICMS', zero), tag('vICMSDeson', zero), tag('vFCP', zero),
      tag('vBCST', zero), tag('vST', zero), tag('vFCPST', zero), tag('vFCPSTRet', zero),
      tag('vProd', dinheiro(totalProdutos)), tag('vFrete', dinheiro(totalFrete)), tag('vSeg', zero), tag('vDesc', dinheiro(totalDesconto)),
      tag('vII', zero), tag('vIPI', zero), tag('vIPIDevol', zero), tag('vPIS', zero), tag('vCOFINS', zero), tag('vOutro', zero),
      tag('vNF', dinheiro(valorNota)),
    ),
  );

  // NFC-e sempre sem frete; NF-e: 0 = por conta do emitente quando há frete cobrado, 9 = sem frete.
  const transp = grupo('transp', tag('modFrete', !nfce && totalFrete > 0 ? 0 : 9));

  const cobr =
    !nfce && d.duplicatas?.length
      ? grupo(
          'cobr',
          grupo('fat', tag('nFat', String(d.numero)), tag('vOrig', dinheiro(valorNota)), tag('vDesc', zero), tag('vLiq', dinheiro(valorNota))),
          ...d.duplicatas.map((dup) => grupo('dup', tag('nDup', dup.numero), tag('dVenc', dataSefaz(dup.vencimento)), tag('vDup', dinheiro(dup.valor)))),
        )
      : '';

  const pag = grupo(
    'pag',
    ...d.pagamentos.map((p) =>
      grupo(
        'detPag',
        tag('indPag', p.aPrazo ? 1 : 0),
        tag('tPag', p.tPag),
        p.tPag === '99' ? tag('xPag', limpar(p.descricao ?? 'Outros', 60)) : '',
        tag('vPag', dinheiro(p.valor)),
        // Cartão sem integração com a maquininha (tpIntegra 2) exige o grupo card.
        p.tPag === '03' || p.tPag === '04' ? grupo('card', tag('tpIntegra', 2)) : '',
      ),
    ),
    d.troco > 0 ? tag('vTroco', dinheiro(d.troco)) : '',
  );

  const infAdic = d.informacoesComplementares ? grupo('infAdic', tag('infCpl', limpar(d.informacoesComplementares, 5000))) : '';
  const rt = d.responsavelTecnico;
  const infRespTec = rt ? grupo('infRespTec', tag('CNPJ', digitos(rt.cnpj)), tag('xContato', limpar(rt.contato, 60)), tag('email', rt.email), tag('fone', digitos(rt.fone))) : '';

  const infNFe = `<infNFe versao="4.00" Id="NFe${d.chave}">${ide}${emit}${dest}${det}${total}${transp}${cobr}${pag}${infAdic}${infRespTec}</infNFe>`;

  let infNFeSupl = '';
  let qrCode: string | undefined;
  if (nfce) {
    if (!d.nfce) throw new Error('NFC-e sem dados do CSC');
    qrCode = qrCodeNfce(d.chave, d.tpAmb, d.nfce.cscId, d.nfce.csc, d.nfce.urlQrCode);
    infNFeSupl = grupo('infNFeSupl', tag('qrCode', qrCode), tag('urlChave', d.nfce.urlConsulta));
  }

  return { xml: `<NFe xmlns="${NAMESPACE}">${infNFe}${infNFeSupl}</NFe>`, valorNota, qrCode };
}

function icmsSimples(origem: number, csosn: string) {
  const orig = tag('orig', origem);
  const cod = tag('CSOSN', csosn);
  switch (csosn) {
    case '101': // tributada com permissão de crédito: exige alíquota de crédito; sem ela, usamos 0
      return grupo('ICMSSN101', orig, cod, tag('pCredSN', '0.0000'), tag('vCredICMSSN', '0.00'));
    case '102': case '103': case '300': case '400':
      return grupo('ICMSSN102', orig, cod);
    case '500': // ICMS cobrado anteriormente por substituição tributária
      return grupo('ICMSSN500', orig, cod);
    case '900':
      return grupo('ICMSSN900', orig, cod);
    default:
      throw new Error(`CSOSN ${csosn} não suportado`);
  }
}

/**
 * QR Code da NFC-e, versão 2 (emissão online):
 * URL?p=chave|2|ambiente|idCSC|hash, onde hash = SHA-1 de "chave|2|ambiente|idCSC" + CSC.
 */
export function qrCodeNfce(chave: string, tpAmb: number, cscId: string, csc: string, urlQrCode: string) {
  const id = String(Number(cscId)); // sem zeros à esquerda
  const parametros = `${chave}|2|${tpAmb}|${id}`;
  const hash = createHash('sha1').update(parametros + csc).digest('hex').toUpperCase();
  return `${urlQrCode}?p=${parametros}|${hash}`;
}

/** Evento de cancelamento (tpEvento 110111). */
export function montarCancelamento(p: { chave: string; cnpj: string; tpAmb: 1 | 2; protocolo: string; justificativa: string; data: Date }) {
  const cOrgao = p.chave.slice(0, 2);
  const id = `ID110111${p.chave}01`;
  return `<evento xmlns="${NAMESPACE}" versao="1.00"><infEvento Id="${id}">${tag('cOrgao', cOrgao)}${tag('tpAmb', p.tpAmb)}${tag('CNPJ', digitos(p.cnpj))}${tag('chNFe', p.chave)}${tag('dhEvento', dataHoraSefaz(p.data))}${tag('tpEvento', '110111')}${tag('nSeqEvento', 1)}${tag('verEvento', '1.00')}<detEvento versao="1.00">${tag('descEvento', 'Cancelamento')}${tag('nProt', p.protocolo)}${tag('xJust', limpar(p.justificativa, 255))}</detEvento></infEvento></evento>`;
}
