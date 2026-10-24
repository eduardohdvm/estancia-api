// Testes das peças da NF-e que não dependem da SEFAZ: chave, XML, assinatura e QR Code.
// Rode com: npx tsx test/fiscal.unit.ts
import { DOMParser } from '@xmldom/xmldom';
import { createHash } from 'node:crypto';
import { assinar, assinaturaValida, digestValue } from '../src/fiscal/assinatura';
import { gerarCertificadoTeste, lerPfx } from '../src/fiscal/certificado';
import { codigoNumerico, digitoVerificador, montarChave } from '../src/fiscal/chave';
import { cifrar, decifrar } from '../src/fiscal/cripto';
import { cnpjValido, cpfValido } from '../src/fiscal/documento';
import { dataHoraSefaz, montarCancelamento, montarNfe, type DadosNota } from '../src/fiscal/xml-nfe';

process.env.JWT_SECRET ??= 'segredo-de-teste';
let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) falhas++;
  console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg);
};
const texto = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];

console.log('--- CHAVE DE ACESSO');
// Exemplo do Manual de Orientação do Contribuinte: chave 5206 0433 0099 1100 2506 5501 2000 0007 8002 6730 1615 (DV 5).
ok(digitoVerificador('5206043300991100250655012000000780026730161') === 5, 'dígito verificador confere com o exemplo do manual');
const cn = codigoNumerico(123);
ok(/^\d{8}$/.test(cn) && cn !== '00000123', 'código numérico com 8 dígitos e diferente do número da nota');
const emissao = new Date('2026-10-24T13:30:00Z'); // 10:30 em Brasília
const chave = montarChave({ uf: 'SP', emissao, cnpj: '11222333000181', modelo: '65', serie: 1, numero: 123, codigoNumerico: '12121212' });
ok(chave.length === 44 && chave.startsWith('352610112223330001816500100000012311212121'), 'chave montada: UF 35, 2610, CNPJ, modelo 65, série 001, número 123, emissão 1, cNF');
ok(Number(chave.slice(-1)) === digitoVerificador(chave.slice(0, 43)), 'chave termina no dígito verificador');
ok(dataHoraSefaz(emissao) === '2026-10-24T10:30:00-03:00', 'data e hora no fuso de Brasília');

console.log('--- CPF E CNPJ');
ok(cpfValido('123.456.789-09') && cnpjValido('11.222.333/0001-81') && cnpjValido('11.444.777/0001-61'), 'documentos válidos aceitos');
ok(!cpfValido('222.222.222-22') && !cpfValido('123.456.789-00') && !cnpjValido('44.555.666/0001-99') && !cnpjValido('11.111.111/0001-11'), 'dígitos errados e sequências repetidas recusados');

console.log('--- CRIPTOGRAFIA E CERTIFICADO');
ok(decifrar(cifrar('csc-secreto')).toString() === 'csc-secreto', 'cifra e decifra');
ok(cifrar('x') !== cifrar('x'), 'cada cifragem usa um vetor diferente');
const { pfx, senha } = gerarCertificadoTeste('EMPRESA TESTE LTDA', '11222333000181');
const cert = lerPfx(pfx, senha);
ok(cert.cnpj === '11222333000181' && cert.titular.startsWith('EMPRESA TESTE') && cert.validade > new Date(), 'certificado lido: titular, CNPJ e validade');
let senhaErrada = false;
try { lerPfx(pfx, 'errada'); } catch { senhaErrada = true; }
ok(senhaErrada, 'senha errada do certificado é recusada');

console.log('--- XML DA NFC-e');
const endereco = { logradouro: 'Rua das Flores', numero: '100', bairro: 'Centro', codigoMunicipio: '3550308', municipio: 'São Paulo', uf: 'SP', cep: '01001-000', telefone: '(11) 3333-4444' };
const dados: DadosNota = {
  modelo: '65', serie: 1, numero: 123, chave, codigoNumerico: '12121212', emissao, tpAmb: 2, naturezaOperacao: 'VENDA',
  emitente: { cnpj: '11.222.333/0001-81', razaoSocial: 'Empresa Teste & Cia Ltda', nomeFantasia: 'Teste', ie: '123.456.789.110', crt: 1, endereco },
  itens: [
    { codigo: '001', ean: '7891000000017', descricao: 'Café <torrado> 500g', ncm: '0901.21.00', cfop: '5102', unidade: 'UN', quantidade: 2, valorUnitario: 21.9, desconto: 1.8, frete: 0, origem: 0, csosn: '102' },
    { codigo: '002', ean: null, descricao: 'Açúcar 1kg', ncm: '17019900', cfop: '5405', unidade: 'UN', quantidade: 3, valorUnitario: 5.99, desconto: 0, frete: 0, origem: 0, csosn: '500' },
  ],
  pagamentos: [{ tPag: '01', valor: 70 }],
  troco: 10.03,
  informacoesComplementares: 'Documento emitido por ME ou EPP optante pelo Simples Nacional.',
  responsavelTecnico: { cnpj: '99888777000166', contato: 'Suporte', email: 'suporte@verissimo.com.br', fone: '11999990000' },
  nfce: { cscId: '000001', csc: 'ABCDEF1234567890', urlQrCode: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode', urlConsulta: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta' },
};
const { xml, valorNota, qrCode } = montarNfe(dados);
const doc = new DOMParser({ onError: (nivel: string) => { if (nivel !== 'warning') throw new Error('XML malformado'); } }).parseFromString(xml, 'text/xml');
ok(doc.documentElement?.localName === 'NFe', 'XML bem formado');
ok(valorNota === 59.97 && texto(xml, 'vNF') === '59.97', 'total: 43,80 + 17,97 − 1,80 de desconto = 59,97');
const totais = xml.slice(xml.indexOf('<ICMSTot>'));
ok(texto(totais, 'vProd') === '61.77' && texto(totais, 'vDesc') === '1.80' && texto(xml, 'vTroco') === '10.03', 'vProd, vDesc e troco nos totais');
ok(texto(xml, 'vUnCom') === '21.90' && texto(xml, 'qCom') === '2.0000', 'valor unitário e quantidade formatados');
ok(xml.includes('<xProd>NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xProd>'), 'homologação: primeiro item com o texto obrigatório');
ok(xml.includes('<cEAN>SEM GTIN</cEAN>') && xml.includes('<NCM>09012100</NCM>'), 'sem GTIN e NCM só com dígitos');
ok(xml.includes('<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>') && xml.includes('<ICMSSN500><orig>0</orig><CSOSN>500</CSOSN></ICMSSN500>'), 'ICMS do Simples por CSOSN (102 e 500)');
ok(xml.includes('Empresa Teste &amp; Cia Ltda') && !xml.includes('<torrado>'), 'caracteres especiais escapados');
ok(xml.includes('<tpImp>4</tpImp>') && xml.includes('<indPres>1</indPres>') && !xml.includes('<dhSaiEnt>'), 'campos próprios da NFC-e');
const ordem = ['<ide>', '<emit>', '<det ', '<total>', '<transp>', '<pag>', '<infAdic>', '<infRespTec>'].map((t) => xml.indexOf(t));
ok(ordem.every((p, i) => p > 0 && (i === 0 || p > ordem[i - 1])), 'grupos na ordem do layout');
const hashEsperado = createHash('sha1').update(`${chave}|2|2|1ABCDEF1234567890`).digest('hex').toUpperCase();
ok(qrCode === `https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode?p=${chave}|2|2|1|${hashEsperado}`, 'QR Code v2 com hash SHA-1 e id do CSC sem zeros');

console.log('--- ASSINATURA');
const assinado = assinar(xml, 'infNFe', cert);
ok(assinaturaValida(assinado), 'assinatura válida');
ok(assinado.includes(`<Reference URI="#NFe${chave}">`) && assinado.includes('rsa-sha1') && assinado.includes('<X509Certificate>'), 'referência ao Id, RSA-SHA1 e certificado no KeyInfo');
ok(assinado.indexOf('</infNFeSupl><Signature') > 0 && assinado.endsWith('</Signature></NFe>'), 'NFC-e: assinatura depois do infNFeSupl');
ok(digestValue(assinado).length === 28, 'DigestValue SHA-1 em base64');
ok(!assinaturaValida(assinado.replace('<vNF>59.97</vNF>', '<vNF>1.00</vNF>')), 'XML alterado depois de assinado é detectado');

console.log('--- NF-e E CANCELAMENTO');
const nfe = montarNfe({
  ...dados,
  modelo: '55',
  chave: montarChave({ uf: 'SP', emissao, cnpj: '11222333000181', modelo: '55', serie: 1, numero: 7, codigoNumerico: '34343434' }),
  numero: 7,
  nfce: undefined,
  troco: 0,
  pagamentos: [{ tPag: '05', valor: 64.97, aPrazo: true }],
  destinatario: { documento: '44.555.666/0001-99', nome: 'Cliente RJ Ltda', ie: '12345678', indIEDest: 1, endereco: { ...endereco, uf: 'RJ', codigoMunicipio: '3304557', municipio: 'Rio de Janeiro' } },
  itens: dados.itens.map((i) => ({ ...i, cfop: i.cfop.replace(/^5/, '6'), frete: i.codigo === '001' ? 5 : 0 })),
  duplicatas: [{ numero: '001', vencimento: new Date('2026-11-23T03:00:00Z'), valor: 64.97 }],
});
ok(nfe.xml.includes('<idDest>2</idDest>') && nfe.xml.includes('<CFOP>6102</CFOP>') && nfe.xml.includes('<indFinal>0</indFinal>'), 'NF-e interestadual para contribuinte: idDest 2, CFOP 6xxx, indFinal 0');
ok(nfe.xml.includes(`<xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome>`), 'homologação: nome do destinatário com o texto obrigatório');
ok(nfe.valorNota === 64.97 && nfe.xml.includes('<modFrete>0</modFrete>') && nfe.xml.includes('<vFrete>5.00</vFrete>'), 'frete entra no total e na modalidade');
ok(nfe.xml.includes('<dup><nDup>001</nDup><dVenc>2026-11-23</dVenc><vDup>64.97</vDup></dup>') && !nfe.xml.includes('infNFeSupl'), 'duplicata na cobrança e sem QR Code');
const nfeAssinada = assinar(nfe.xml, 'infNFe', cert);
ok(assinaturaValida(nfeAssinada) && nfeAssinada.includes('</infNFe><Signature') && nfeAssinada.endsWith('</Signature></NFe>'), 'NF-e assinada, com a assinatura logo após o infNFe');
const evento = assinar(montarCancelamento({ chave, cnpj: '11222333000181', tpAmb: 2, protocolo: '135260000000001', justificativa: 'Venda cancelada a pedido do cliente', data: emissao }), 'infEvento', cert);
ok(assinaturaValida(evento) && evento.includes(`Id="ID110111${chave}01"`) && evento.includes('<tpEvento>110111</tpEvento>'), 'evento de cancelamento assinado');

console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;

// ─────────── Cliente SEFAZ contra um servidor HTTPS local que imita a SEFAZ ───────────
import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:https';
import forge from 'node-forge';
import { chamarSefaz, lerRetornoAutorizacao, lerRetornoEvento } from '../src/fiscal/sefaz/cliente';

function certificadoServidor() {
  const par = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const chaves = {
    privateKey: forge.pki.privateKeyFromPem(par.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()),
    publicKey: forge.pki.publicKeyFromPem(par.publicKey.export({ type: 'spki', format: 'pem' }).toString()),
  };
  const c = forge.pki.createCertificate();
  c.publicKey = chaves.publicKey;
  c.serialNumber = '02';
  c.validity.notBefore = new Date(Date.now() - 86_400_000);
  c.validity.notAfter = new Date(Date.now() + 86_400_000);
  c.setSubject([{ name: 'commonName', value: 'localhost' }]);
  c.setIssuer([{ name: 'commonName', value: 'localhost' }]);
  c.setExtensions([{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }]);
  c.sign(chaves.privateKey, forge.md.sha256.create());
  return { key: forge.pki.privateKeyToPem(chaves.privateKey), cert: forge.pki.certificateToPem(c) };
}

async function testarCliente() {
  console.log('--- CLIENTE SEFAZ (servidor HTTPS simulado)');
  const servidor = certificadoServidor();
  let recebido = { acao: '', corpo: '', titular: '' };
  const https = createServer({ ...servidor, requestCert: true, rejectUnauthorized: true, ca: cert.certPem }, (req, res) => {
    let corpo = '';
    req.on('data', (p) => (corpo += p));
    req.on('end', () => {
      const peer = (req.socket as import('node:tls').TLSSocket).getPeerCertificate();
      recebido = { acao: String(req.headers['content-type']), corpo, titular: String(peer.subject?.CN ?? '') };
      const chaveNota = corpo.match(/Id="NFe(\d{44})"/)?.[1] ?? '';
      const retorno = corpo.includes('NFeRecepcaoEvento4')
        ? `<retEnvEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><cStat>128</cStat><xMotivo>Lote de Evento Processado</xMotivo><retEvento versao="1.00"><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado a NF-e</xMotivo><nProt>135260000000002</nProt></infEvento></retEvento></retEnvEvento>`
        : `<retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>2</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe versao="4.00"><infProt><tpAmb>2</tpAmb><chNFe>${chaveNota}</chNFe><dhRecbto>2026-10-24T10:30:01-03:00</dhRecbto><nProt>135260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></retEnviNFe>`;
      res.writeHead(200, { 'Content-Type': 'application/soap+xml; charset=utf-8' });
      res.end(`<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${retorno}</nfeResultMsg></soap:Body></soap:Envelope>`);
    });
  });
  await new Promise<void>((r) => https.listen(0, r));
  const url = `https://localhost:${(https.address() as import('node:net').AddressInfo).port}/ws/NFeAutorizacao4.asmx`;

  const lote = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>1</idLote><indSinc>1</indSinc>${assinado}</enviNFe>`;
  const retorno = lerRetornoAutorizacao(await chamarSefaz(url, 'autorizacao', lote, cert, { ca: servidor.cert }));
  ok(recebido.titular.includes('EMPRESA TESTE LTDA'), 'conexão apresentou o certificado da empresa (TLS mútuo)');
  ok(recebido.acao.includes('action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"'), 'cabeçalho SOAP 1.2 com a ação do serviço');
  ok(recebido.corpo.includes('<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe'), 'lote dentro de nfeDadosMsg');
  ok(retorno.cStatLote === 104 && retorno.protocolo?.cStat === 100 && retorno.protocolo.nProt === '135260000000001', 'retorno lido: lote 104, nota 100 e protocolo');
  ok(!!retorno.protocolo?.xml.startsWith('<protNFe'), 'protocolo guardado para montar o nfeProc');

  const ev = lerRetornoEvento(await chamarSefaz(url, 'evento', `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote>${evento}</envEvento>`, cert, { ca: servidor.cert }));
  ok(ev.cStat === 135 && ev.nProt === '135260000000002', 'retorno de cancelamento lido (135)');

  let semCertificado = '';
  try {
    await chamarSefaz(url, 'status', '<consStatServ/>', { ...cert, chavePem: servidor.key, certPem: servidor.cert }, { ca: servidor.cert });
  } catch (e) {
    semCertificado = (e as Error).message;
  }
  ok(semCertificado.length > 0, 'servidor recusa quem não tem o certificado esperado: ' + semCertificado.slice(0, 60));
  https.close();
}

testarCliente()
  .catch((e) => {
    falhas++;
    console.log('FAIL erro inesperado: ' + (e as Error).message);
  })
  .finally(() => {
    console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK (cliente)');
    process.exitCode = falhas ? 1 : 0;
  });
