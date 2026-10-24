import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import type { Certificado } from './certificado';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

/**
 * Assinatura digital no padrão da NF-e: XMLDSig envelopada, C14N, RSA-SHA1, referência
 * ao Id do elemento assinado (infNFe ou infEvento) e certificado no KeyInfo.
 */
export function assinar(xml: string, elemento: 'infNFe' | 'infEvento', cert: Certificado) {
  const assinatura = new SignedXml({
    privateKey: cert.chavePem,
    publicCert: cert.certPem,
    canonicalizationAlgorithm: C14N,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  });
  assinatura.addReference({
    xpath: `//*[local-name(.)='${elemento}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', C14N],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  // Na NFC-e a assinatura vem depois do infNFeSupl (QR Code); nos demais, logo após o elemento assinado.
  const depoisDe = elemento === 'infNFe' && xml.includes('<infNFeSupl>') ? 'infNFeSupl' : elemento;
  assinatura.computeSignature(xml, { location: { reference: `//*[local-name(.)='${depoisDe}']`, action: 'after' } });
  return assinatura.getSignedXml();
}

/** Confere uma assinatura (usado nos testes e para validar XMLs recebidos). */
export function assinaturaValida(xml: string) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const nodo = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
  if (!nodo) return false;
  const verificador = new SignedXml({ getCertFromKeyInfo: (keyInfo) => SignedXml.getCertFromKeyInfo(keyInfo) });
  verificador.loadSignature(nodo as unknown as Node);
  try {
    return verificador.checkSignature(xml);
  } catch {
    return false;
  }
}

/** Valor de resumo (DigestValue) da assinatura, que a SEFAZ devolve no protocolo. */
export const digestValue = (xmlAssinado: string) => xmlAssinado.match(/<DigestValue>([^<]+)<\/DigestValue>/)?.[1] ?? '';
