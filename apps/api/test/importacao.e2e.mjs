// Teste de ponta a ponta da importação de planilhas e do "esqueci minha senha".
// Precisa da API rodando. A parte do e-mail só roda quando a API está nesta máquina
// sem SMTP configurado (os e-mails ficam em apps/api/.emails).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const B = process.env.API_URL ?? 'http://localhost:3333/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j };
};
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); };

const email = `imp${Date.now()}@x.com`;
const T = (await call('POST', '/auth/registrar', { empresa: 'Teste Importação', nome: 'Admin Teste', email, senha: '123456' })).j.token;
await call('POST', '/usuarios', { nome: 'Vendedor', email: 'v' + email, senha: '123456', perfil: 'VENDEDOR' }, T);
const TV = (await call('POST', '/auth/login', { email: 'v' + email, senha: '123456' })).j.token;
const existente = (await call('POST', '/produtos', { codigo: 'P01', nome: 'Antigo', precoVenda: 5, codigoBarras: '7890001' }, T)).j;
const servico = (await call('POST', '/produtos', { codigo: 'S01', nome: 'Serviço', servico: true }, T)).j;
const produtoPorCodigo = async (codigo) => (await call('GET', `/produtos?busca=${codigo}`, null, T)).j.itens.find((p) => p.codigo === codigo);

console.log('--- PRODUTOS');
const planilhaProdutos = [
  { 'Código': 'P01', 'Descrição': 'Arroz 5kg', 'Preço de Venda': '29,90', 'Custo': 'R$ 19,90', 'Categoria': 'Mercearia', 'Estoque mínimo': '10', 'Unidade': 'un', 'EAN': '' },
  { 'Código': 'P02', 'Descrição': 'Feijão 1kg', 'Preço de Venda': '1.234,56', 'Custo': 6.8, 'Categoria': 'mercearia', 'Estoque mínimo': '', 'Unidade': 'kg', 'EAN': '7890002' },
  { 'Código': 'P03', 'Descrição': 'Óleo', 'Preço de Venda': 'abc', 'Custo': '', 'Categoria': '', 'Estoque mínimo': '', 'Unidade': '', 'EAN': '' },
  { 'Código': 'P04', 'Descrição': '', 'Preço de Venda': '5', 'Custo': '', 'Categoria': '', 'Estoque mínimo': '', 'Unidade': '', 'EAN': '' },
  { 'Código': 'P02', 'Descrição': 'Feijão repetido', 'Preço de Venda': '9', 'Custo': '', 'Categoria': '', 'Estoque mínimo': '', 'Unidade': '', 'EAN': '' },
];
let r = await call('POST', '/importacao/produtos', { linhas: planilhaProdutos, simular: true }, T);
ok(r.s === 200 && r.j.simulado && r.j.criar === 1 && r.j.atualizar === 1 && r.j.comErro === 3, 'simulação: 1 novo, 1 atualização, 3 com erro: ' + JSON.stringify({ c: r.j.criar, a: r.j.atualizar, e: r.j.comErro }));
ok(r.j.erros.map((e) => e.linha).join(',') === '4,5,6', 'erros nas linhas 4, 5 e 6 da planilha');
ok(r.j.erros[0].erros[0].includes('não é um número') && r.j.erros[1].erros[0] === 'Nome vazio' && r.j.erros[2].erros[0].includes('repetido'), 'mensagens: número inválido, nome vazio, código repetido');
ok(!(await produtoPorCodigo('P02')), 'simulação não grava nada');
r = await call('POST', '/importacao/produtos', { linhas: planilhaProdutos, simular: false }, T);
ok(r.s === 200 && !r.j.simulado && r.j.criar === 1 && r.j.atualizar === 1, 'importação grava só as linhas válidas');
const p1 = await produtoPorCodigo('P01');
const p2 = await produtoPorCodigo('P02');
ok(p1.nome === 'Arroz 5kg' && Number(p1.precoVenda) === 29.9 && Number(p1.precoCusto) === 19.9 && Number(p1.estoqueMinimo) === 10, 'P01 atualizado ("Descrição" vira nome, "29,90" e "R$ 19,90" lidos)');
ok(p1.codigoBarras === '7890001', 'EAN vazio na planilha não apagou o código de barras existente');
ok(Number(p2.precoVenda) === 1234.56 && p2.unidade === 'KG' && p2.categoria?.nome === 'Mercearia', 'P02: "1.234,56" lido, unidade KG, categoria reaproveitada (mercearia = Mercearia)');
ok((await call('GET', '/categorias', null, T)).j.length === 1, 'só uma categoria criada');
r = await call('POST', '/importacao/produtos', { linhas: [{ Nome: 'Sem código' }], simular: true }, T); ok(r.s === 400, 'planilha sem coluna Código -> 400');
r = await call('POST', '/importacao/produtos', { linhas: planilhaProdutos, simular: true }, TV); ok(r.s === 403, 'vendedor não importa produtos');
const grande = Array.from({ length: 3000 }, (_, i) => ({ codigo: `G${i}`, nome: `Produto ${i}`, preco: i }));
r = await call('POST', '/importacao/produtos', { linhas: grande, simular: true }, T); ok(r.s === 200 && r.j.criar === 3000 && r.j.amostra.length === 100, 'planilha com 3.000 linhas (simulação)');
r = await call('POST', '/importacao/produtos', { linhas: Array.from({ length: 5001 }, () => ({ codigo: 'x', nome: 'y' })), simular: true }, T); ok(r.s === 400, 'mais de 5.000 linhas -> 400');

console.log('--- CLIENTES E FORNECEDORES');
const cliente = (await call('POST', '/pessoas', { nome: 'Mercado Já Cliente', documento: '11.222.333/0001-81', email: 'antigo@mercado.com' }, T)).j;
const planilhaPessoas = [
  { 'Razão Social': 'Mercado Já Cliente Ltda', 'CPF/CNPJ': '11222333000181', 'E-mail': '', 'Cidade': 'Campinas', 'UF': 'sp' },
  { 'Razão Social': 'Distribuidora Nova', 'CPF/CNPJ': '44.555.666/0001-99', 'E-mail': 'contato@nova.com', 'Cidade': 'São Paulo', 'UF': 'SP' },
  { 'Razão Social': 'João da Silva', 'CPF/CNPJ': '123.456.789-09', 'E-mail': 'joao@email', 'Cidade': '', 'UF': '' },
  { 'Razão Social': 'Documento Curto', 'CPF/CNPJ': '123', 'E-mail': '', 'Cidade': '', 'UF': '' },
  { 'Razão Social': 'Repetido', 'CPF/CNPJ': '44555666000199', 'E-mail': '', 'Cidade': '', 'UF': 'São Paulo' },
];
r = await call('POST', '/importacao/pessoas', { linhas: planilhaPessoas, simular: true, papel: 'fornecedor' }, TV);
ok(r.s === 200 && r.j.atualizar === 1 && r.j.criar === 1 && r.j.comErro === 3, 'simulação: 1 atualização (mesmo CNPJ com e sem pontuação), 1 novo, 3 erros');
ok(r.j.erros.map((e) => e.erros.join(' / ')).join(' | ').match(/E-mail.*inválido.*11 ou 14 dígitos.*repetido.*UF/), 'erros: e-mail, documento curto, CNPJ repetido e UF');
r = await call('POST', '/importacao/pessoas', { linhas: planilhaPessoas, simular: false, papel: 'fornecedor' }, TV);
const atualizado = (await call('GET', `/pessoas/${cliente.id}`, null, T)).j;
ok(atualizado.cliente && atualizado.fornecedor && atualizado.nome === 'Mercado Já Cliente Ltda', 'quem já era cliente continua cliente e passa a ser fornecedor');
ok(atualizado.email === 'antigo@mercado.com' && atualizado.cidade === 'Campinas' && atualizado.uf === 'SP', 'e-mail vazio não apagou o antigo; cidade e UF preenchidas');
const nova = (await call('GET', '/pessoas?busca=Distribuidora Nova', null, T)).j.itens[0];
ok(nova?.tipo === 'JURIDICA' && nova.fornecedor && !nova.cliente, 'novo fornecedor PJ (tipo pelo tamanho do CNPJ)');

console.log('--- ESTOQUE');
const planilhaEstoque = [
  { 'Código': '7890001', 'Quantidade': '12' },
  { 'Código': 'P02', 'Quantidade': '3,5', 'Custo': '7,10' },
  { 'Código': 'NAOEXISTE', 'Quantidade': '1' },
  { 'Código': 'S01', 'Quantidade': '1' },
  { 'Código': 'P01', 'Quantidade': '-2' },
];
r = await call('POST', '/importacao/estoque', { linhas: planilhaEstoque, simular: true, modo: 'AJUSTE' }, T);
ok(r.j.atualizar === 2 && r.j.comErro === 3, 'simulação: 2 válidas, 3 erros (inexistente, serviço, negativo)');
r = await call('POST', '/importacao/estoque', { linhas: planilhaEstoque, simular: false, modo: 'AJUSTE' }, T);
ok((await produtoPorCodigo('P01')).saldo === 12 && (await produtoPorCodigo('P02')).saldo === 3.5, 'inventário: P01 = 12 (achado pelo código de barras), P02 = 3,5');
ok(Number((await produtoPorCodigo('P02')).precoCusto) === 7.1, 'custo da planilha atualizou o produto');
await call('POST', '/importacao/estoque', { linhas: [{ codigo: 'P01', qtd: 8 }], simular: false, modo: 'ENTRADA' }, T);
ok((await produtoPorCodigo('P01')).saldo === 20, 'entrada soma ao saldo: 12 + 8 = 20');
r = await call('GET', `/estoque/movimentos?produtoId=${existente.id}`, null, T);
ok(r.j.itens.some((m) => m.observacao === 'Importação de planilha (inventário)'), 'movimentação registrada no histórico do estoque');
void servico;

console.log('--- ESQUECI MINHA SENHA');
r = await call('POST', '/auth/esqueci-senha', { email: 'ninguem' + email }, null);
const generica = r.j.mensagem;
ok(r.s === 200 && generica.startsWith('Se este e-mail'), 'e-mail inexistente: resposta genérica');
r = await call('POST', '/auth/esqueci-senha', { email: email.toUpperCase() }, null);
ok(r.s === 200 && r.j.mensagem === generica, 'e-mail existente: mesma resposta (não revela quem tem conta)');
r = await call('POST', '/auth/redefinir-senha', { token: 'x'.repeat(43), senha: 'nova123' }, null); ok(r.s === 400, 'token inventado -> 400');

const pasta = join(process.cwd(), '.emails');
if (B.includes('localhost') && existsSync(pasta)) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const arquivo = readdirSync(pasta).filter((f) => f.includes(email)).sort().at(-1);
  const mensagem = arquivo && JSON.parse(readFileSync(join(pasta, arquivo), 'utf8'));
  const token = mensagem?.texto.match(/token=([\w-]+)/)?.[1];
  ok(!!token && mensagem.assunto.includes('senha nova') && mensagem.html.includes('Criar senha nova'), 'e-mail gerado com o link');
  r = await call('POST', '/auth/redefinir-senha', { token, senha: '123' }, null); ok(r.s === 400, 'senha curta -> 400');
  r = await call('POST', '/auth/redefinir-senha', { token, senha: 'senhaNova9' }, null); ok(r.s === 200, 'senha redefinida');
  ok((await call('POST', '/auth/login', { email, senha: 'senhaNova9' })).s === 201, 'entra com a senha nova');
  ok((await call('POST', '/auth/login', { email, senha: '123456' })).s === 401, 'senha antiga não funciona mais');
  r = await call('POST', '/auth/redefinir-senha', { token, senha: 'outra123' }, null); ok(r.s === 400, 'link usado não vale de novo');
} else {
  console.log('(pulando a troca de senha: os e-mails não estão nesta máquina)');
}
// Já houve 1 pedido para este e-mail; o limite é 3 a cada 15 minutos.
await call('POST', '/auth/esqueci-senha', { email }, null);
await call('POST', '/auth/esqueci-senha', { email }, null);
r = await call('POST', '/auth/esqueci-senha', { email }, null); ok(r.s === 429, 'quarto pedido seguido para o mesmo e-mail -> 429');

console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;
