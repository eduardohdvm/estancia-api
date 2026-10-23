// Teste de ponta a ponta dos relatórios. Precisa da API rodando.
// Os valores esperados foram calculados à mão a partir dos dados criados aqui.
const B = process.env.API_URL ?? 'http://localhost:3333/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j };
};
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); };
const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const email = `rel${Date.now()}@x.com`;
const T = (await call('POST', '/auth/registrar', { empresa: 'Teste Relatórios', nome: 'Admin', email, senha: '123456' })).j.token;
await call('POST', '/usuarios', { nome: 'Vendedora', email: 'v' + email, senha: '123456', perfil: 'VENDEDOR' }, T);
const TV = (await call('POST', '/auth/login', { email: 'v' + email, senha: '123456' })).j.token;
const dep = (await call('GET', '/estoque/depositos', null, T)).j[0];
const cli = (await call('POST', '/pessoas', { nome: 'Cliente' }, T)).j;
const forn = (await call('POST', '/pessoas', { nome: 'Fornecedor', cliente: false, fornecedor: true }, T)).j;
const prod = {};
for (const [codigo, custo, venda] of [['A', 10, 20], ['B', 5, 10], ['C', 2, 4], ['D', 1, 3]]) {
  prod[codigo] = (await call('POST', '/produtos', { codigo, nome: 'Produto ' + codigo, precoCusto: custo, precoVenda: venda }, T)).j;
  await call('POST', '/estoque/movimentos', { produtoId: prod[codigo].id, depositoId: dep.id, tipo: 'ENTRADA', quantidade: 100 }, T);
}
const pedido = async (token, itens, extra = {}) => {
  const p = (await call('POST', '/pedidos', { clienteId: cli.id, itens: itens.map(([c, q]) => ({ produtoId: prod[c].id, quantidade: q })), ...extra }, token)).j;
  await call('POST', `/pedidos/${p.id}/faturar`, {}, T);
  return p;
};
// P1 (admin): A 10x20 + B 10x10 = 300, desconto 30, frete 15 → total 285; rateio 0,9 → A 180, B 90
await pedido(T, [['A', 10], ['B', 10]], { desconto: 30, frete: 15 });
// P2 (vendedora): A 5x20 + C 10x4 = 140
await pedido(TV, [['A', 5], ['C', 10]]);
// PDV (admin): B 2x10 = 20
await call('POST', '/pdv/caixa/abrir', { valorAbertura: 0 }, T);
await call('POST', '/pdv/vendas', { itens: [{ produtoId: prod.B.id, quantidade: 2 }], pagamentos: [{ forma: 'DINHEIRO', valor: 20 }] }, T);
await call('POST', '/pdv/caixa/fechar', { valorFechamento: 20 }, T);
// Pedido faturado e cancelado: não pode aparecer
const cancelado = await pedido(T, [['A', 1]]);
await call('POST', `/pedidos/${cancelado.id}/cancelar`, null, T);
// Financeiro: despesa entra, pagamento a fornecedor e compra não; outra receita entra
const cat = (await call('GET', '/financeiro/categorias', null, T)).j;
const catId = (nome) => cat.find((c) => c.nome === nome).id;
await call('POST', '/financeiro/lancamentos', { tipo: 'PAGAR', descricao: 'Aluguel', valor: 100, vencimento: hoje, categoriaId: catId('Aluguel') }, T);
await call('POST', '/financeiro/lancamentos', { tipo: 'PAGAR', descricao: 'Mercadoria avulsa', valor: 999, vencimento: hoje, categoriaId: catId('Fornecedores') }, T);
await call('POST', '/financeiro/lancamentos', { tipo: 'RECEBER', descricao: 'Aluguel de espaço', valor: 50, vencimento: hoje, categoriaId: catId('Outras receitas') }, T);
const compra = (await call('POST', '/compras', { fornecedorId: forn.id, itens: [{ produtoId: prod.D.id, quantidade: 10, custoUnitario: 1 }] }, T)).j;
await call('POST', `/compras/${compra.id}/receber`, { primeiroVencimento: hoje }, T);

console.log('--- VENDAS POR PERÍODO');
let r = await call('GET', '/relatorios/vendas-periodo', null, T);
ok(r.s === 200 && r.j.totais.pedidos === 3 && r.j.totais.faturamento === 445, 'total 445 em 3 pedidos (sem o cancelado): ' + JSON.stringify(r.j.totais));
ok(r.j.totais.custo === 230 && r.j.totais.lucro === 200 && r.j.totais.margem === 46.51, 'custo 230 (A 150 + B 60 + C 20), lucro 200, margem 46,51%');
ok(r.j.itens.find((l) => l.periodo === hoje)?.faturamento === 445, 'dia de hoje com 445');
r = await call('GET', '/relatorios/vendas-periodo?agrupar=mes', null, T); ok(r.j.itens.length === 1 && r.j.itens[0].periodo === hoje.slice(0, 7), 'agrupado por mês');
r = await call('GET', '/relatorios/vendas-periodo?origem=PDV', null, T); ok(r.j.totais.faturamento === 20 && r.j.totais.pedidos === 1, 'filtro só PDV = 20');
r = await call('GET', `/relatorios/vendas-periodo?de=${hoje}&ate=2000-01-01`, null, T); ok(r.s === 400, 'data inicial maior que a final -> 400');

console.log('--- POR PRODUTO');
r = await call('GET', '/relatorios/vendas-produto', null, T);
const linha = (c) => r.j.itens.find((l) => l.codigo === c);
ok(linha('A')?.faturamento === 280 && linha('A').quantidade === 15 && linha('A').custo === 150 && linha('A').lucro === 130, 'A: 15 un, 280, custo 150, lucro 130');
ok(linha('B')?.faturamento === 110 && linha('B').quantidade === 12 && linha('C')?.faturamento === 40, 'B: 110 (rateio do desconto), C: 40');
ok(r.j.totais.faturamento === 430 && r.j.itens[0].codigo === 'A' && !linha('D'), 'total 430 (sem frete), ordenado, D fora');
ok(linha('A').participacao === 65.12 && linha('A').margem === 46.43, 'participação e margem de A');

console.log('--- POR VENDEDOR');
r = await call('GET', '/relatorios/vendas-vendedor', null, T);
ok(r.j.itens[0].vendedor === 'Admin' && r.j.itens[0].faturamento === 305 && r.j.itens[0].pedidos === 2, 'Admin: 305 em 2 pedidos');
ok(r.j.itens[1].vendedor === 'Vendedora' && r.j.itens[1].faturamento === 140, 'Vendedora: 140');

console.log('--- CURVA ABC');
r = await call('GET', '/relatorios/curva-abc', null, T);
ok(r.j.itens.map((l) => l.classe).join('') === 'AAB', 'classes A, A, B: ' + r.j.itens.map((l) => `${l.codigo}=${l.classe}(${l.acumulado}%)`).join(' '));
ok(r.j.classes[0].produtos === 2 && r.j.classes[0].percentualFaturamento === 90.7, 'classe A: 2 produtos, 90,7% do faturamento');
ok(r.j.semVenda.length === 1 && r.j.semVenda[0].codigo === 'D', 'produto sem venda: D');

console.log('--- DRE');
r = await call('GET', '/relatorios/dre', null, T);
const v = (chave) => r.j.linhas.find((l) => l.chave === chave)?.total;
ok(v('receitaBruta') === 460 && v('descontos') === -30 && v('fretes') === 15 && v('receitaLiquida') === 445, 'receita bruta 460, desc −30, frete 15, líquida 445');
ok(v('cmv') === -230 && v('lucroBruto') === 215, 'CMV −230, lucro bruto 215');
ok(v('despesa:Aluguel') === -100 && v('despesas') === -100 && !r.j.linhas.some((l) => l.rotulo.includes('Fornecedores')), 'despesas só o aluguel (fornecedor e compra fora)');
ok(v('receita:Outras receitas') === 50 && v('resultado') === 165, 'outras receitas 50, resultado 165');
ok(r.j.indicadores.margemLiquida === 37.08, 'margem líquida 37,08% (165 ÷ 445)');

console.log('--- PERFIS');
r = await call('GET', '/relatorios/dre', null, TV); ok(r.s === 403, 'vendedor não acessa relatórios');
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;
