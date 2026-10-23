// Teste de ponta a ponta da Fase 2 (compras, PDV e CRM). Precisa da API rodando.
const B = process.env.API_URL ?? 'http://localhost:3333/api';
const call = async (m, p, body, token) => {
  const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { s: r.status, j };
};
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + msg); };
const saldo = async (id, T) => (await call('GET', `/produtos/${id}`, null, T)).j.saldo;

// Empresa nova para começar do zero
const email = `fase2${Date.now()}@x.com`;
let r = await call('POST', '/auth/registrar', { empresa: 'Teste Fase 2', nome: 'Admin', email, senha: '123456' });
const T = r.j.token;
const forn = (await call('POST', '/pessoas', { nome: 'Fornecedor X', cliente: false, fornecedor: true }, T)).j;
const cli = (await call('POST', '/pessoas', { nome: 'Cliente Y', documento: '123' }, T)).j;
const p1 = (await call('POST', '/produtos', { codigo: 'A1', codigoBarras: '789000', nome: 'Produto A', precoCusto: 10, precoVenda: 20, estoqueMinimo: 10 }, T)).j;
const p2 = (await call('POST', '/produtos', { codigo: 'B1', nome: 'Produto B', precoCusto: 5, precoVenda: 9, estoqueMinimo: 4 }, T)).j;

console.log('--- COMPRAS');
r = await call('GET', '/compras/sugestao', null, T); ok(r.j.length === 2 && r.j.find(s => s.codigo === 'A1').sugerido === 20, 'sugestão: A1 sugerido 20');
r = await call('POST', '/compras', { fornecedorId: forn.id, itens: [{ produtoId: p1.id, quantidade: 20, custoUnitario: 12 }, { produtoId: p2.id, quantidade: 10 }], frete: 29, parcelas: 2 }, T);
ok(r.s === 201 && Number(r.j.total) === 319 && r.j.status === 'RASCUNHO', 'compra criada total 319: ' + r.j.total); const c1 = r.j;
r = await call('GET', '/compras/sugestao', null, T); ok(r.j.length === 0, 'sugestão desconta o que já foi pedido');
r = await call('POST', `/compras/${c1.id}/enviar`, null, T); ok(r.j.status === 'ENVIADO', 'compra enviada');
r = await call('POST', `/compras/${c1.id}/receber`, {}, T); ok(r.s === 201 && r.j.status === 'RECEBIDO', 'compra recebida');
ok(r.j.lancamentos?.length === 2 && r.j.lancamentos.reduce((s, l) => s + Number(l.valor), 0) === 319, 'gerou 2 parcelas a pagar = 319');
ok(await saldo(p1.id, T) === 20 && await saldo(p2.id, T) === 10, 'estoque entrou (20 e 10)');
r = await call('GET', `/produtos/${p1.id}`, null, T); ok(Number(r.j.precoCusto) === 13.2, 'custo com frete rateado = 13.20 -> ' + r.j.precoCusto);
r = await call('POST', `/compras/${c1.id}/receber`, {}, T); ok(r.s === 400, 'não recebe duas vezes');
r = await call('POST', '/compras', { fornecedorId: forn.id, itens: [{ produtoId: p1.id, quantidade: 20, custoUnitario: 14.8 }] }, T); const c2 = r.j;
await call('POST', `/compras/${c2.id}/receber`, {}, T);
r = await call('GET', `/produtos/${p1.id}`, null, T); ok(Number(r.j.precoCusto) === 14 && r.j.saldo === 40, 'custo médio (20x13.20 + 20x14.80)/40 = 14 -> ' + r.j.precoCusto);
r = await call('POST', `/compras/${c2.id}/cancelar`, null, T); ok(r.j.status === 'CANCELADO' && await saldo(p1.id, T) === 20, 'cancelar compra recebida tira do estoque');

console.log('--- PDV');
r = await call('GET', '/pdv/caixa', null, T); ok(r.s === 200 && (r.j === null || r.j === ''), 'sem caixa aberto');
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'DINHEIRO', valor: 20 }] }, T); ok(r.s === 400, 'venda sem caixa -> 400');
r = await call('POST', '/pdv/caixa/abrir', { valorAbertura: 100 }, T); ok(r.s === 201 && r.j.status === 'ABERTO' && r.j.numero === 1, 'caixa aberto');
r = await call('POST', '/pdv/caixa/abrir', { valorAbertura: 100 }, T); ok(r.s === 400, 'não abre dois caixas');
r = await call('GET', '/pdv/produto/789000', null, T); ok(r.j.id === p1.id, 'busca por código de barras');
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 2 }, { produtoId: p2.id, quantidade: 1 }], pagamentos: [{ forma: 'DINHEIRO', valor: 50 }] }, T);
ok(r.s === 201 && r.j.total === 49 && r.j.troco === 1, 'venda dinheiro 49, troco 1: ' + JSON.stringify(r.j)); const v1 = r.j;
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'PIX', valor: 10 }, { forma: 'CARTAO_DEBITO', valor: 10 }] }, T); ok(r.s === 201 && r.j.troco === 0, 'venda pix+débito');
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'PIX', valor: 25 }] }, T); ok(r.s === 400, 'troco no pix -> 400: ' + r.j.message);
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'DINHEIRO', valor: 5 }] }, T); ok(r.s === 400, 'pagamento insuficiente -> 400: ' + r.j.message);
r = await call('POST', '/pdv/vendas', { itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'CREDIARIO', valor: 20 }] }, T); ok(r.s === 400, 'crediário sem cliente -> 400');
r = await call('POST', '/pdv/vendas', { clienteId: cli.id, itens: [{ produtoId: p1.id, quantidade: 1 }], pagamentos: [{ forma: 'CREDIARIO', valor: 20 }] }, T); ok(r.s === 201, 'crediário com cliente');
ok(await saldo(p1.id, T) === 16, 'estoque A: 20-2-1-1 = 16');
r = await call('POST', '/pdv/caixa/movimentos', { tipo: 'SANGRIA', valor: 500 }, T); ok(r.s === 400, 'sangria maior que gaveta -> 400');
r = await call('POST', '/pdv/caixa/movimentos', { tipo: 'SANGRIA', valor: 80, motivo: 'cofre' }, T); ok(r.s === 201, 'sangria 80');
r = await call('POST', '/pdv/caixa/movimentos', { tipo: 'SUPRIMENTO', valor: 10 }, T); ok(r.s === 201, 'suprimento 10');
r = await call('POST', `/pdv/vendas/${v1.id}/cancelar`, null, T); ok(r.s === 201, 'cancelar venda 1');
ok(await saldo(p1.id, T) === 18, 'estoque devolvido = 18');
r = await call('GET', '/pdv/caixa', null, T); const res = r.j.resumo;
console.log('     resumo:', JSON.stringify(res));
ok(res.quantidadeVendas === 2 && res.totalVendas === 40, 'resumo: 2 vendas válidas, total 40');
ok(res.dinheiroEsperado === 30, 'dinheiro esperado = 100 + 0 + 10 - 80 = 30');
r = await call('GET', '/financeiro/lancamentos?tipo=RECEBER', null, T); ok(r.j.itens.filter(l => l.status === 'PAGO').length === 2 && r.j.itens.filter(l => l.status === 'ABERTO').length === 1, 'financeiro: pix+débito pagos, crediário aberto');
r = await call('GET', '/financeiro/contas', null, T); ok(r.j[0].saldoAtual === 20, 'saldo conta Caixa = 20 (pix+débito) -> ' + r.j[0].saldoAtual);
r = await call('POST', '/pdv/caixa/fechar', { valorFechamento: 28 }, T); ok(r.j.status === 'FECHADO' && r.j.resumo.diferenca === -2, 'fechamento com falta de 2');
r = await call('POST', `/pdv/vendas/${v1.id}/cancelar`, null, T); ok(r.s === 400, 'não mexe em venda de caixa fechado');
r = await call('GET', '/pedidos?status=FATURADO', null, T); const pdvPed = r.j.itens[0];
r = await call('POST', `/pedidos/${pdvPed.id}/cancelar`, null, T); ok(r.s === 400, 'venda PDV não cancela pela tela de vendas');

console.log('--- CRM');
r = await call('POST', '/crm/oportunidades', { titulo: 'Contrato anual', pessoaId: cli.id, valorEstimado: 5000, etapa: 'PROPOSTA' }, T); ok(r.s === 201 && r.j.responsavel, 'oportunidade criada com responsável'); const o1 = r.j;
r = await call('POST', '/crm/oportunidades', { titulo: 'Lead Instagram', contatoNome: 'Ana', valorEstimado: 1000 }, T); const o2 = r.j;
r = await call('GET', '/crm/funil', null, T); ok(r.j.previsaoPonderada === 2600, 'previsão ponderada 5000*0.5+1000*0.1 = 2600 -> ' + r.j.previsaoPonderada);
r = await call('PATCH', `/crm/oportunidades/${o2.id}`, { etapa: 'PERDIDO' }, T); ok(r.s === 400, 'perder sem motivo -> 400');
r = await call('PATCH', `/crm/oportunidades/${o2.id}`, { etapa: 'PERDIDO', motivoPerda: 'Preço' }, T); ok(r.j.etapa === 'PERDIDO' && r.j.fechadaEm, 'perdido com motivo');
r = await call('PATCH', `/crm/oportunidades/${o1.id}`, { etapa: 'GANHO' }, T); ok(r.j.etapa === 'GANHO', 'ganho');
r = await call('GET', '/crm/funil', null, T); ok(r.j.taxaConversao === 0.5, 'taxa conversão 50%');
r = await call('POST', '/crm/atividades', { tipo: 'LIGACAO', descricao: 'Liguei', oportunidadeId: o1.id }, T); ok(r.j.concluida === true && r.j.pessoa?.id === cli.id, 'ligação registrada e herdou cliente');
r = await call('POST', '/crm/atividades', { tipo: 'TAREFA', descricao: 'Enviar proposta', agendadaPara: new Date(Date.now() + 86400000).toISOString() }, T); ok(r.j.concluida === false, 'tarefa pendente'); const t1 = r.j;
r = await call('GET', '/crm/atividades?pendentes=true&minhas=true', null, T); ok(r.j.length === 1, 'minhas pendentes = 1');
r = await call('PATCH', `/crm/atividades/${t1.id}`, { concluida: true }, T); ok(r.j.concluida && r.j.concluidaEm, 'tarefa concluída');
r = await call('GET', `/crm/atividades?oportunidadeId=${o1.id}`, null, T); ok(r.j.some(a => a.descricao.startsWith('Etapa alterada')), 'histórico registra mudança de etapa');
r = await call('POST', '/crm/atividades', { tipo: 'LIGACAO', descricao: 'Solta' }, T); ok(r.s === 400, 'ligação sem cliente/negócio -> 400');

console.log('--- PERFIS');
await call('POST', '/usuarios', { nome: 'Operador', email: 'op' + email, senha: '123456', perfil: 'CAIXA' }, T);
const TC = (await call('POST', '/auth/login', { email: 'op' + email, senha: '123456' })).j.token;
r = await call('GET', '/pdv/caixa', null, TC); ok(r.s === 200, 'CAIXA acessa PDV');
r = await call('GET', '/compras', null, TC); ok(r.s === 403, 'CAIXA não acessa compras');
r = await call('GET', '/crm/funil', null, TC); ok(r.s === 403, 'CAIXA não acessa CRM');
r = await call('GET', '/pedidos', null, TC); ok(r.s === 403, 'CAIXA não acessa vendas');
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exitCode = falhas ? 1 : 0;
