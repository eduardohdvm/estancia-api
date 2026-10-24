// Comunicação com os web services da SEFAZ (SOAP 1.2 sobre HTTPS com o certificado A1 da empresa).
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { request } from 'node:https';
import type { Certificado } from '../certificado';

export type Servico = 'autorizacao' | 'evento' | 'status';

const SERVICOS: Record<Servico, { wsdl: string; metodo: string }> = {
  autorizacao: { wsdl: 'NFeAutorizacao4', metodo: 'nfeAutorizacaoLote' },
  evento: { wsdl: 'NFeRecepcaoEvento4', metodo: 'nfeRecepcaoEvento' },
  status: { wsdl: 'NFeStatusServico4', metodo: 'nfeStatusServicoNF' },
};

export class ErroSefaz extends Error {}

/** Envia uma mensagem à SEFAZ e devolve o XML de retorno (conteúdo de nfeResultMsg). */
export function chamarSefaz(url: string, servico: Servico, mensagem: string, cert: Certificado, opcoes: { ca?: string | Buffer; timeoutMs?: number } = {}) {
  const { wsdl, metodo } = SERVICOS[servico];
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    `<soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${wsdl}">${mensagem}</nfeDadosMsg></soap12:Body>` +
    '</soap12:Envelope>';

  return new Promise<string>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'POST',
        key: cert.chavePem,
        cert: cert.certPem,
        ca: opcoes.ca,
        // Os servidores da SEFAZ usam certificados da ICP-Brasil, que não vêm no Node.
        // SEFAZ_VERIFICAR_TLS=false desliga a conferência do certificado do servidor.
        rejectUnauthorized: process.env.SEFAZ_VERIFICAR_TLS !== 'false',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/${wsdl}/${metodo}"`,
          'Content-Length': Buffer.byteLength(envelope),
        },
        timeout: opcoes.timeoutMs ?? 30_000,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (p: Buffer) => partes.push(p));
        res.on('end', () => {
          const corpo = Buffer.concat(partes).toString('utf8');
          const resultado = extrairResultado(corpo);
          if (res.statusCode && res.statusCode >= 400 && !resultado) {
            return reject(new ErroSefaz(`A SEFAZ respondeu com erro HTTP ${res.statusCode}${extrairFalha(corpo)}`));
          }
          if (!resultado) return reject(new ErroSefaz('Resposta da SEFAZ em formato inesperado'));
          resolve(resultado);
        });
      },
    );
    req.on('timeout', () => req.destroy(new ErroSefaz('A SEFAZ não respondeu a tempo. Tente de novo em alguns minutos.')));
    req.on('error', (erro: NodeJS.ErrnoException) => {
      if (erro instanceof ErroSefaz) return reject(erro);
      const tls = /certificate|self[- ]signed|issuer/i.test(erro.message);
      reject(new ErroSefaz(tls ? `Falha na conexão segura com a SEFAZ (${erro.message}). Veja SEFAZ_VERIFICAR_TLS no README.` : `Não foi possível conectar à SEFAZ: ${erro.message}`));
    });
    req.end(envelope);
  });
}

const parser = () => new DOMParser({ onError: () => undefined });

/** Conteúdo de nfeResultMsg (o retorno propriamente dito), já serializado. */
function extrairResultado(soap: string) {
  const doc = parser().parseFromString(soap, 'text/xml');
  const resultado = doc.getElementsByTagNameNS('*', 'nfeResultMsg')[0];
  const filho = resultado && Array.from(resultado.childNodes).find((n) => n.nodeType === 1);
  return filho ? new XMLSerializer().serializeToString(filho) : null;
}

function extrairFalha(soap: string) {
  const texto = soap.match(/<(?:\w+:)?Text[^>]*>([^<]+)</)?.[1];
  return texto ? `: ${texto}` : '';
}

type NoXml = { getElementsByTagNameNS(ns: string, tag: string): ArrayLike<{ textContent: string | null }> };
const valor = (raiz: NoXml, tag: string) => raiz.getElementsByTagNameNS('*', tag)[0]?.textContent ?? undefined;

/** Retorno do envio de lote (síncrono): situação do lote e protocolo da nota. */
export function lerRetornoAutorizacao(xml: string) {
  const doc = parser().parseFromString(xml, 'text/xml');
  const prot = doc.getElementsByTagNameNS('*', 'protNFe')[0];
  const info = prot?.getElementsByTagNameNS('*', 'infProt')[0];
  return {
    cStatLote: Number(valor(doc, 'cStat')),
    motivoLote: valor(doc, 'xMotivo') ?? '',
    protocolo: info
      ? {
          cStat: Number(valor(info, 'cStat')),
          motivo: valor(info, 'xMotivo') ?? '',
          nProt: valor(info, 'nProt'),
          dhRecbto: valor(info, 'dhRecbto'),
          xml: new XMLSerializer().serializeToString(prot!),
        }
      : null,
  };
}

/** Retorno de evento (ex.: cancelamento). 135/136/155 = evento registrado. */
export function lerRetornoEvento(xml: string) {
  const doc = parser().parseFromString(xml, 'text/xml');
  const ret = doc.getElementsByTagNameNS('*', 'retEvento')[0];
  const info = ret?.getElementsByTagNameNS('*', 'infEvento')[0];
  return {
    cStat: Number(info ? valor(info, 'cStat') : valor(doc, 'cStat')),
    motivo: (info ? valor(info, 'xMotivo') : valor(doc, 'xMotivo')) ?? '',
    nProt: info ? valor(info, 'nProt') : undefined,
    xml: ret ? new XMLSerializer().serializeToString(ret) : xml,
  };
}

export function lerRetornoStatus(xml: string) {
  const doc = parser().parseFromString(xml, 'text/xml');
  return { cStat: Number(valor(doc, 'cStat')), motivo: valor(doc, 'xMotivo') ?? '' };
}
