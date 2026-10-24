import { BadRequestException } from '@nestjs/common';
import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';

/** Certificado A1 já aberto: chave e certificado em PEM, prontos para assinar e conectar na SEFAZ. */
export interface Certificado {
  chavePem: string;
  certPem: string;
  titular: string;
  cnpj: string | null;
  validade: Date;
}

/**
 * Abre um certificado A1 (.pfx/.p12). Usa o node-forge porque muitos certificados
 * brasileiros usam criptografia antiga (RC2) que o OpenSSL 3 do Node recusa.
 */
export function lerPfx(pfx: Buffer, senha: string): Certificado {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch {
    throw new BadRequestException('Não foi possível abrir o certificado: confira o arquivo (.pfx) e a senha');
  }

  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const chave = chaves.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!chave) throw new BadRequestException('O certificado não contém a chave privada');

  // O arquivo pode trazer a cadeia inteira: o certificado da empresa é o da mesma chave.
  const certificados = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []).map((b) => b.cert).filter(Boolean) as forge.pki.Certificate[];
  const cert = certificados.find((c) => (c.publicKey as forge.pki.rsa.PublicKey).n?.equals(chave.n)) ?? certificados[0];
  if (!cert) throw new BadRequestException('O arquivo não contém um certificado');

  const titular = String(cert.subject.getField('CN')?.value ?? '');
  return {
    chavePem: forge.pki.privateKeyToPem(chave),
    certPem: forge.pki.certificateToPem(cert),
    titular,
    // No e-CNPJ o nome comum termina com ":CNPJ".
    cnpj: titular.match(/:(\d{14})$/)?.[1] ?? null,
    validade: cert.validity.notAfter,
  };
}

/** Certificado autoassinado para o modo de simulação e para os testes (não vale na SEFAZ). */
export function gerarCertificadoTeste(razaoSocial: string, cnpj: string, senha = 'teste') {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const chave = forge.pki.privateKeyFromPem(privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(publicKey.export({ type: 'spki', format: 'pem' }).toString());
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const nome = [{ name: 'commonName', value: `${razaoSocial}:${cnpj}` }, { name: 'countryName', value: 'BR' }];
  cert.setSubject(nome);
  cert.setIssuer(nome);
  cert.sign(chave, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(chave, [cert], senha, { algorithm: '3des' });
  return { pfx: Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), senha };
}
