-- Vendas faturadas antes do custo ser gravado no item: usa o custo atual do produto.
UPDATE "PedidoVendaItem" i
SET "custoUnitario" = p."precoCusto"
FROM "Produto" p
WHERE p.id = i."produtoId" AND i."custoUnitario" IS NULL;
