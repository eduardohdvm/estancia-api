# Verissimo ERP

Sistema de gestão empresarial (ERP) em modelo SaaS: várias empresas usam o mesmo sistema, cada uma vendo apenas os próprios dados.

## O que já tem

### Fase 1

| Módulo | Funções |
|---|---|
| **Acesso** | Cadastro de empresa, login, perfis (Administrador, Gerente, Vendedor, Financeiro, Estoquista, Operador de caixa) |
| **Cadastros** | Clientes e fornecedores (PF/PJ), produtos e serviços, categorias |
| **Estoque** | Vários depósitos, entradas, saídas, ajuste de inventário, histórico, alerta de estoque mínimo |
| **Vendas** | Orçamento → aprovação → faturamento, descontos, frete, parcelamento, cancelamento |
| **Financeiro** | Contas a pagar e a receber, parcelamento, baixa e estorno, caixa e bancos, saldo previsto |
| **Painel** | Vendas do mês, valores a receber e a pagar, gráfico de 6 meses, estoque baixo |

Ao **faturar** um pedido, o sistema baixa o estoque e gera as parcelas no contas a receber automaticamente. Ao **cancelar** um pedido faturado, devolve o estoque e cancela as parcelas em aberto.

### Fase 2

| Módulo | Funções |
|---|---|
| **PDV (frente de caixa)** | Abertura e fechamento de caixa por operador, leitor de código de barras (`3*789...` para quantidade), várias formas de pagamento na mesma venda, troco, crediário, sangria e suprimento, cancelamento de venda, conferência de diferença no fechamento, histórico de caixas |
| **Compras** | Pedido de compra (rascunho → enviado → recebido), sugestão de compra pelo estoque mínimo, recebimento com entrada no estoque, custo médio com rateio de frete e desconto, parcelas no contas a pagar, cancelamento com estorno do estoque |
| **CRM** | Funil de vendas em quadro (arrastar entre etapas), negócios com cliente ou contato avulso, previsão ponderada e taxa de conversão, motivo de perda, histórico de ligações/WhatsApp/reuniões, tarefas e follow-ups com prazo, "criar pedido" a partir de um negócio ganho |

Cada venda do PDV já sai faturada: baixa o estoque e lança os valores no financeiro (à vista como recebido, crediário como conta a receber em aberto). Sangria e suprimento mexem apenas no dinheiro da gaveta, não no saldo das contas.

O módulo fiscal (NF-e, NFC-e, NFS-e) fica para uma fase posterior.

## Tecnologias

- **API** (`apps/api`): Node.js, NestJS, Prisma, PostgreSQL, JWT
- **Web** (`apps/web`): Next.js, React, Tailwind CSS
- TypeScript nas duas pontas, organizado como monorepo (npm workspaces)

## Como rodar no seu computador

Precisa de **Node.js 22 ou mais novo**.

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar a API
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Subir um PostgreSQL local (deixe este terminal aberto)
npm run db:dev
```

O `db:dev` mostra uma URL **TCP** (`postgres://postgres:postgres@localhost:51214/...`). Copie para `DATABASE_URL` em `apps/api/.env`. O `.env.example` já traz o `SHADOW_DATABASE_URL` (porta 51215), que o Prisma usa para comparar o banco ao criar migrações. Se você já tem um PostgreSQL instalado, use a URL dele.

```bash
# 4. Criar as tabelas e os dados de demonstração
npm run db:migrate
npm run db:seed

# 5. Rodar a API e o site (um em cada terminal)
npm run dev:api
npm run dev:web
```

Acesse http://localhost:3000 e entre com **admin@demo.com / demo123**, ou cadastre uma empresa nova.

### Testes

Com a API rodando, este comando testa os fluxos principais de ponta a ponta (vendas, estoque, financeiro, PDV, compras, CRM, perfis e separação entre empresas). Cada execução cria uma empresa nova, então não estraga seus dados:

```bash
npm run test:e2e -w apps/api
```

## Estrutura

```
apps/
  api/
    prisma/schema.prisma   # modelo do banco de dados
    prisma/seed.ts         # dados de demonstração
    src/
      auth/                # login e cadastro de empresa
      usuarios/            # usuários e perfis
      pessoas/             # clientes e fornecedores
      produtos/            # produtos, serviços e categorias
      estoque/             # depósitos e movimentações
      vendas/              # pedidos de venda
      financeiro/          # contas a pagar/receber, caixa e bancos
      pdv/                 # frente de caixa
      compras/             # pedidos de compra e recebimento
      crm/                 # funil de vendas e atividades
      dashboard/           # painel inicial
      common/              # login (guard), perfis, paginação, erros
  web/
    src/app/               # telas (uma pasta por rota)
    src/components/        # componentes reutilizáveis
    src/lib/               # acesso à API, sessão, formatação
```

### Como a separação entre empresas funciona

Toda tabela de negócio tem a coluna `empresaId`. O token de login carrega o `empresaId` do usuário, e todos os serviços da API filtram por ele. Assim uma empresa nunca enxerga nem altera dados de outra.

### Adicionando um módulo novo na API

1. Crie os modelos em `apps/api/prisma/schema.prisma` (sempre com `empresaId`) e rode `npm run db:migrate` (ele também atualiza o cliente do Prisma).
2. Crie a pasta em `apps/api/src/<modulo>` com `dto`, `service`, `controller` e `module`, seguindo um módulo existente (ex.: `pessoas`).
3. Registre o módulo em `apps/api/src/app.module.ts`.

## Próximas fases

- ~~**Fase 2:** PDV (frente de caixa), compras, CRM~~ ✔
- **Fase 3:** ordens de serviço, produção, RH, relatórios, integrações
- **Fase 4:** fiscal (NF-e, NFC-e, NFS-e)
