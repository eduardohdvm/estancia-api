// Teste de ponta a ponta da Fase 1. Precisa da API rodando (npm run dev:api).
// Cada execução cria uma empresa nova, então pode rodar quantas vezes quiser.
const B = process.env.API_URL ?? 'http://localhost:3333/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j };
};
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); };
let r = await call('GET', '/produtos'); ok(r.s === 401, 'sem token -> 401');
// Empresa nova a cada execução, para o teste não depender de dados antigos.
const emailAdmin = `fase1${Date.now()}@x.com`;
await call('POST', '/auth/registrar', { empresa: 'Teste Fase 1', nome: 'Admin', email: emailAdmin, senha: 'demo123' });
r = await call('POST', '/auth/login', { email: emailAdmin, senha: 'errada' }); ok(r.s === 401, 'senha errada -> 401');
r = await call('POST', '/auth/login', { email: emailAdmin, senha: 'demo123' }); ok(r.s === 201, 'login admin'); const T = r.j.token;
{
  const dep = (await call('GET', '/estoque/depositos', null, T)).j[0];
  for (const [codigo, nome, minimo, qtd] of [['001', 'Café torrado 500g', 10, 40], ['002', 'Açúcar refinado 1kg', 20, 15]]) {
    const p = (await call('POST', '/produtos', { codigo, nome, precoCusto: 10, precoVenda: codigo === '001' ? 21.9 : 5.99, estoqueMinimo: minimo }, T)).j;
    await call('POST', '/estoque/movimentos', { produtoId: p.id, depositoId: dep.id, tipo: 'ENTRADA', quantidade: qtd }, T);
  }
  await call('POST', '/produtos', { codigo: 'S01', nome: 'Entrega em domicílio', servico: true, precoVenda: 10 }, T);
  for (const nome of ['Maria', 'João', 'Mercado']) await call('POST', '/pessoas', { nome }, T);
  await call('POST', '/usuarios', { nome: 'Vendedor', email: 'vend' + emailAdmin, senha: 'demo123', perfil: 'VENDEDOR' }, T);
}
r = await call('GET', '/produtos?busca=caf', null, T); ok(r.j.total === 1, 'busca produto'); const cafe = r.j.itens[0]; ok(cafe.saldo === 40, 'saldo cafe 40');
r = await call('GET', '/produtos?estoqueBaixo=true', null, T); ok(r.j.total === 1 && r.j.itens[0].codigo === '002', 'estoque baixo = acucar');
r = await call('GET', '/pessoas?papel=cliente', null, T); const cli = r.j.itens[0]; ok(r.j.total === 3, 'clientes = 3');
const entrega = (await call('GET', '/produtos?busca=Entrega', null, T)).j.itens[0];
r = await call('POST', '/pedidos', { clienteId: cli.id, itens: [{ produtoId: cafe.id, quantidade: 3 }, { produtoId: entrega.id, quantidade: 1 }], desconto: 5.7, parcelas: 3 }, T);
ok(r.s === 201 && Number(r.j.total) === 70 && r.j.numero === 1, 'pedido criado total 70: ' + r.j.total); const ped = r.j;
r = await call('POST', `/pedidos/${ped.id}/faturar`, {}, T); ok(r.s === 201 && r.j.status === 'FATURADO', 'faturado');
ok(r.j.lancamentos.length === 3 && r.j.lancamentos.reduce((s, l) => s + Number(l.valor), 0) === 70, 'parcelas somam 70: ' + r.j.lancamentos.map(l => l.valor + '@' + l.vencimento.slice(0,10)));
r = await call('GET', `/produtos/${cafe.id}`, null, T); ok(r.j.saldo === 37, 'saldo cafe 37 apos venda');
r = await call('POST', '/pedidos', { clienteId: cli.id, itens: [{ produtoId: cafe.id, quantidade: 999 }] }, T); const ped2 = r.j;
r = await call('POST', `/pedidos/${ped2.id}/faturar`, {}, T); ok(r.s === 400, 'estoque insuficiente -> 400: ' + r.j.message);
r = await call('GET', `/produtos/${cafe.id}`, null, T); ok(r.j.saldo === 37, 'transacao revertida, saldo 37');
r = await call('GET', '/financeiro/lancamentos?tipo=RECEBER&status=ABERTO', null, T); ok(r.j.total === 3, 'receber abertos 3'); const parc = r.j.itens[0];
r = await call('POST', `/financeiro/lancamentos/${parc.id}/baixar`, {}, T); ok(r.s === 201 && r.j.status === 'PAGO', 'baixa parcela');
r = await call('POST', `/pedidos/${ped.id}/cancelar`, null, T); ok(r.s === 400, 'cancelar com parcela paga -> 400');
r = await call('POST', `/financeiro/lancamentos/${parc.id}/estornar`, null, T); ok(r.j.status === 'ABERTO', 'estorno');
r = await call('POST', `/pedidos/${ped.id}/cancelar`, null, T); ok(r.j.status === 'CANCELADO', 'pedido cancelado');
r = await call('GET', `/produtos/${cafe.id}`, null, T); ok(r.j.saldo === 40, 'estoque devolvido 40');
r = await call('POST', '/financeiro/lancamentos', { tipo: 'PAGAR', descricao: 'Internet', valor: 100, vencimento: '2026-11-05', parcelas: 3 }, T); ok(r.j.criados === 3, 'lancamento parcelado');
r = await call('GET', '/financeiro/resumo', null, T); ok(r.s === 200, 'resumo financeiro: saldo ' + r.j.saldoAtual + ' pagar ' + r.j.pagar.aberto);
r = await call('POST', '/estoque/movimentos', { produtoId: cafe.id, depositoId: cafe.estoques[0].deposito.id, tipo: 'AJUSTE', quantidade: 35 }, T); ok(r.s === 201 && Number(r.j.saldoNovo) === 35, 'ajuste inventario');
r = await call('GET', '/dashboard', null, T); ok(r.s === 200 && r.j.vendasPorMes.length === 6, 'dashboard');
r = await call('POST', '/pessoas', { nome: 'X', email: 'invalido' }, T); ok(r.s === 400, 'validacao: ' + JSON.stringify(r.j.message));
r = await call('POST', '/pessoas', { nome: 'Teste', campoHacker: 1 }, T); ok(r.s === 400, 'campo extra rejeitado');
// perfis
r = await call('POST', '/auth/login', { email: 'vend' + emailAdmin, senha: 'demo123' }); const TV = r.j.token;
r = await call('GET', '/financeiro/resumo', null, TV); ok(r.s === 403, 'vendedor sem acesso financeiro -> 403');
r = await call('GET', '/pedidos', null, TV); ok(r.s === 200, 'vendedor ve pedidos');
// isolamento entre empresas
r = await call('POST', '/auth/registrar', { empresa: 'Outra Empresa', nome: 'Fulano', email: `outro${Date.now()}@x.com`, senha: '123456' }); ok(r.s === 201, 'registrar nova empresa'); const T2 = r.j.token;
r = await call('GET', `/produtos/${cafe.id}`, null, T2); ok(r.s === 404, 'outra empresa nao ve produto -> 404');
r = await call('GET', '/produtos', null, T2); ok(r.j.total === 0, 'outra empresa lista vazia');
r = await call('POST', '/pedidos', { clienteId: cli.id, itens: [{ produtoId: cafe.id, quantidade: 1 }] }, T2); ok(r.s === 400, 'nao usa cliente de outra empresa');
r = await call('GET', '/financeiro/contas', null, T2); ok(r.j.length === 1 && r.j[0].nome === 'Caixa', 'cadastros iniciais criados');
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;
