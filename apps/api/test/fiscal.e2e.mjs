// Teste de ponta a ponta da emissão fiscal no modo de simulação (gera e assina, sem enviar à SEFAZ).
// Precisa da API rodando.
import { DOMParser } from '@xmldom/xmldom';
import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

const B = process.env.API_URL ?? 'http://localhost:3333/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j };
};
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); };

function pfxTeste(cnpj) {
  const par = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const chave = forge.pki.privateKeyFromPem(par.privateKey.export({ type: 'pkcs1', format: 'pem' }).toString());
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.publicKeyFromPem(par.publicKey.export({ type: 'spki', format: 'pem' }).toString());
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const nome = [{ name: 'commonName', value: `LOJA FISCAL TESTE LTDA:${cnpj}` }];
  cert.setSubject(nome);
  cert.setIssuer(nome);
  cert.sign(chave, forge.md.sha256.create());
  return Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(chave, [cert], 'senha123', { algorithm: '3des' })).getBytes(), 'binary').toString('base64');
}

function assinaturaValida(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const sig = doc.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature')[0];
  const v = new SignedXml({ getCertFromKeyInfo: (k) => SignedXml.getCertFromKeyInfo(k) });
  v.loadSignature(sig);
  try { return v.checkSignature(xml); } catch { return false; }
}
const tag = (xml, nome) => xml.match(new RegExp(`<${nome}>([^<]*)</${nome}>`))?.[1];

const email = `fiscal${Date.now()}@x.com`;
const T = (await call('POST', '/auth/registrar', { empresa: 'Loja Fiscal Teste', nome: 'Admin', email, senha: '123456' })).j.token;
for (const [perfil, prefixo] of [['CAIXA', 'c'], ['VENDEDOR', 'v']]) await call('POST', '/usuarios', { nome: perfil, email: prefixo + email, senha: '123456', perfil }, T);
const TC = (await call('POST', '/auth/login', { email: 'c' + email, senha: '123456' })).j.token;
const TV = (await call('POST', '/auth/login', { email: 'v' + email, senha: '123456' })).j.token;
const CNPJ = '11222333000181';

console.log('--- CONFIGURAÇÃO');
let r = await call('GET', '/fiscal/configuracao', null, T); ok(r.s === 200 && (r.j === null || r.j === ''), 'sem configuração ainda');
const config = {
  razaoSocial: 'Loja Fiscal Teste Ltda', nomeFantasia: 'Loja Teste', cnpj: '11.222.333/0001-81', inscricaoEstadual: '110.042.490.114', crt: 1,
  logradouro: 'Rua Teste', numero: '100', bairro: 'Centro', codigoMunicipio: '3550308', municipio: 'São Paulo', uf: 'SP', cep: '01001-000',
  ambiente: 'SIMULACAO', serieNfe: 1, proximoNumeroNfe: 1, serieNfce: 1, proximoNumeroNfce: 50, cfopPadrao: '5102', csosnPadrao: '102', emitirNfceNoPdv: true,
};
r = await call('PUT', '/fiscal/configuracao', { ...config, crt: 3 }, T); ok(r.s === 400, 'regime normal (CRT 3) ainda não suportado -> 400');
r = await call('PUT', '/fiscal/configuracao', { ...config, cnpj: '11.222.333/0001-82' }, T); ok(r.s === 400 && /CNPJ da empresa inválido/.test(r.j.message), 'CNPJ da empresa com dígito errado -> 400');
r = await call('PUT', '/fiscal/configuracao', { ...config, ambiente: 'HOMOLOGACAO' }, T); ok(r.s === 400 && /certificado/.test(r.j.message), 'homologação sem certificado -> 400');
r = await call('PUT', '/fiscal/configuracao', config, T); ok(r.s === 200 && r.j.cnpj === CNPJ && r.j.ambiente === 'SIMULACAO', 'configuração salva (CNPJ só com dígitos)');
r = await call('PUT', '/fiscal/configuracao', config, TC); ok(r.s === 403, 'operador de caixa não altera a configuração');

console.log('--- CERTIFICADO');
r = await call('POST', '/fiscal/certificado', { arquivo: pfxTeste('99888777000166'), senha: 'senha123' }, T); ok(r.s === 400 && /CNPJ/.test(r.j.message), 'certificado de outro CNPJ -> 400');
r = await call('POST', '/fiscal/certificado', { arquivo: pfxTeste(CNPJ), senha: 'errada' }, T); ok(r.s === 400 && /senha/.test(r.j.message), 'senha errada -> 400');
r = await call('POST', '/fiscal/certificado', { arquivo: pfxTeste(CNPJ), senha: 'senha123' }, T);
ok(r.s === 200 && r.j.certificado?.titular.includes(CNPJ) && r.j.certificado.diasRestantes > 300, 'certificado aceito: titular e validade');
r = await call('GET', '/fiscal/configuracao', null, T);
ok(!JSON.stringify(r.j).includes('v1:') && r.j.certificadoSenhaGravada && !('certificadoSenha' in r.j), 'certificado, senha e CSC nunca voltam na resposta');

console.log('--- NF-e (pedido)');
const dep = (await call('GET', '/estoque/depositos', null, T)).j[0];
const mk = async (codigo, extra) => {
  const p = (await call('POST', '/produtos', { codigo, nome: 'Produto ' + codigo, precoCusto: 5, precoVenda: 10, ...extra }, T)).j;
  if (!extra.servico) await call('POST', '/estoque/movimentos', { produtoId: p.id, depositoId: dep.id, tipo: 'ENTRADA', quantidade: 100 }, T);
  return p;
};
const pA = await mk('A', { ncm: '0901.21.00', codigoBarras: '7891000000017' });
const pB = await mk('B', { ncm: '17019900', csosn: '500', cfop: '5405' });
const pSemNcm = await mk('C', {});
const servico = await mk('S', { servico: true, precoVenda: 15 });
r = await call('POST', '/produtos', { codigo: 'X', nome: 'NCM ruim', ncm: '123' }, T); ok(r.s === 400, 'NCM com menos de 8 dígitos -> 400');

const cliente = (await call('POST', '/pessoas', { nome: 'Cliente Rio Ltda', documento: '11.444.777/0001-61', tipo: 'JURIDICA' }, T)).j;
const pedido = async (itens, extra = {}) => {
  const p = (await call('POST', '/pedidos', { clienteId: cliente.id, itens: itens.map(([prod, q]) => ({ produtoId: prod.id, quantidade: q })), ...extra }, T)).j;
  await call('POST', `/pedidos/${p.id}/faturar`, {}, T);
  return p;
};
const p1 = await pedido([[pA, 3], [pB, 2]], { desconto: 5, frete: 12, parcelas: 2 });
r = await call('POST', `/fiscal/pedidos/${p1.id}/nfe`, null, T); ok(r.s === 400 && /endereço/.test(r.j.message) && /IBGE/.test(r.j.message), 'cliente sem endereço: lista o que falta');
await call('PATCH', `/pessoas/${cliente.id}`, { endereco: 'Av. Atlântica', numero: '500', bairro: 'Copacabana', cidade: 'Rio de Janeiro', codigoMunicipio: '3304557', uf: 'RJ', cep: '22010-000', inscricaoEstadual: '12345678' }, T);
r = await call('POST', `/fiscal/pedidos/${p1.id}/nfe`, null, TC); ok(r.s === 403, 'operador de caixa não emite NF-e');
r = await call('POST', `/fiscal/pedidos/${p1.id}/nfe`, null, TV);
ok(r.s === 200 && r.j.status === 'AUTORIZADA' && r.j.numero === 1 && r.j.modelo === 'NFE' && r.j.ambiente === 'SIMULACAO', 'NF-e nº 1 autorizada (simulação)');
ok(/^\d{44}$/.test(r.j.chave) && r.j.chave.slice(20, 22) === '55' && Number(r.j.valorTotal) === 57, 'chave de 44 dígitos, modelo 55, total 3×10 + 2×10 − 5 + 12 = 57');
const nfe = (await call('GET', `/fiscal/notas/${r.j.id}`, null, T)).j;
ok(nfe.xml.startsWith('<nfeProc') && nfe.xml.includes('<cStat>100</cStat>') && assinaturaValida(nfe.xml), 'XML autorizado (nfeProc) com assinatura válida');
ok(nfe.xml.includes('<idDest>2</idDest>') && nfe.xml.includes('<CFOP>6102</CFOP>') && nfe.xml.includes('<CFOP>6405</CFOP>'), 'venda para o RJ: idDest 2 e CFOPs trocados para 6xxx');
ok(nfe.xml.includes('<indIEDest>1</indIEDest><IE>12345678</IE>') && nfe.xml.includes('<cMun>3304557</cMun>'), 'destinatário contribuinte com IE e código do município');
ok(tag(nfe.xml.slice(nfe.xml.indexOf('<ICMSTot>')), 'vNF') === '57.00' && nfe.xml.includes('<modFrete>0</modFrete>') && (nfe.xml.match(/<dup>/g) ?? []).length === 2, 'totais, frete e 2 duplicatas');
r = await call('POST', `/fiscal/pedidos/${p1.id}/nfe`, null, T); ok(r.s === 400 && /já tem a NF-e nº 1/.test(r.j.message), 'não emite duas vezes para o mesmo pedido');
const p2 = await pedido([[pSemNcm, 1]]);
r = await call('POST', `/fiscal/pedidos/${p2.id}/nfe`, null, T); ok(r.s === 400 && /sem NCM/.test(r.j.message), 'produto sem NCM -> 400');
const p3 = await pedido([[pA, 1]]);
r = await call('POST', `/fiscal/pedidos/${p3.id}/nfe`, null, T); ok(r.j.numero === 2, 'próxima NF-e recebe o número 2 (o pedido recusado não gastou número)');

console.log('--- NFC-e (PDV)');
await call('POST', '/pdv/caixa/abrir', { valorAbertura: 50 }, TC);
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: pA.id, quantidade: 2 }], pagamentos: [{ forma: 'DINHEIRO', valor: 50 }], documentoNota: '12345678909' }, TC);
const vendaPdv = r.j;
ok(r.s === 201 && r.j.nota?.status === 'AUTORIZADA' && r.j.nota.modelo === 'NFCE' && r.j.nota.numero === 50 && !r.j.erroFiscal, 'venda no PDV já sai com a NFC-e nº 50');
ok(r.j.nota.qrCode.includes(`p=${r.j.nota.chave}|2|2|1|`) && r.j.nota.destinatarioDocumento === '12345678909', 'QR Code da NFC-e e CPF na nota');
const nfce = (await call('GET', `/fiscal/notas/${r.j.nota.id}`, null, TC)).j;
ok(nfce.xml.includes('<tPag>01</tPag><vPag>50.00</vPag>') && nfce.xml.includes('<vTroco>30.00</vTroco>') && nfce.xml.includes('<CPF>12345678909</CPF>'), 'pagamento em dinheiro com troco e CPF no XML');
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: servico.id, quantidade: 1 }], pagamentos: [{ forma: 'PIX', valor: 15 }] }, TC);
ok(r.s === 201 && r.j.nota === null && /serviço/.test(r.j.erroFiscal), 'venda com serviço: venda registrada, NFC-e não emitida e motivo na tela');
r = await call('POST', `/pdv/vendas/${vendaPdv.id}/cancelar`, null, TC); ok(r.s === 400 && /Cancele antes a NFC-e nº 50/.test(r.j.message), 'venda com NFC-e autorizada não cancela antes da nota');

console.log('--- CANCELAMENTO');
r = await call('POST', `/fiscal/notas/${vendaPdv.nota.id}/cancelar`, { justificativa: 'curta' }, T); ok(r.s === 400, 'justificativa com menos de 15 caracteres -> 400');
r = await call('POST', `/fiscal/notas/${vendaPdv.nota.id}/cancelar`, { justificativa: 'Cliente desistiu da compra no caixa' }, TV); ok(r.s === 403, 'vendedor não cancela nota');
r = await call('POST', `/fiscal/notas/${vendaPdv.nota.id}/cancelar`, { justificativa: 'Cliente desistiu da compra no caixa' }, T);
ok(r.s === 200 && r.j.status === 'CANCELADA' && r.j.protocoloCancelamento, 'NFC-e cancelada com protocolo');
r = await call('POST', `/pdv/vendas/${vendaPdv.id}/cancelar`, null, TC); ok(r.s === 201, 'com a nota cancelada, a venda pode ser cancelada');
r = await call('POST', `/pedidos/${p1.id}/cancelar`, null, T); ok(r.s === 400 && /NF-e nº 1/.test(r.j.message), 'pedido com NF-e autorizada também é bloqueado');

console.log('--- CONSULTA');
r = await call('GET', '/fiscal/notas?modelo=NFE', null, T); ok(r.j.total === 2 && r.j.itens.every((n) => n.modelo === 'NFE' && !('xml' in n)), 'lista de NF-e sem carregar os XMLs');
r = await call('GET', '/fiscal/notas?status=CANCELADA', null, T); ok(r.j.total === 1 && r.j.itens[0].pedido.origem === 'PDV', 'filtro por status com o pedido de origem');
r = await call('GET', '/fiscal/configuracao', null, T); ok(r.j.proximoNumeroNfe === 3 && r.j.proximoNumeroNfce === 51, 'numeração avançou: próxima NF-e 3, próxima NFC-e 51');

console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;
