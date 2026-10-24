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

### Relatórios

| Relatório | O que mostra |
|---|---|
| **Vendas por período** | Faturamento, pedidos, ticket médio, custo, lucro bruto e margem, por dia, semana ou mês, com gráfico |
| **Vendas por produto** | Quantidade, faturamento, custo, lucro, margem e participação de cada produto; ranking dos 10 maiores |
| **Vendas por vendedor** | Pedidos, faturamento, ticket médio, lucro e participação de cada vendedor |
| **Curva ABC** | Produtos classificados em A (80% do faturamento), B (15%) e C (5%), e a lista de produtos sem venda |
| **DRE gerencial** | Receita, descontos, CMV, lucro bruto, despesas por categoria e resultado, mês a mês |

Todos filtram por período (com atalhos como "mês passado" e "últimos 6 meses") e por origem (pedidos ou PDV), e exportam para **Excel** e **PDF**. O custo de cada item é gravado no momento do faturamento, então a margem não muda quando o preço de custo do produto é atualizado depois.

### Importação de planilhas e recuperação de senha

- **Importar planilhas** (Configurações → Importar planilhas, ou o botão "Importar" em Produtos e Clientes): produtos, clientes/fornecedores e estoque, a partir de Excel (.xlsx) ou CSV. Há uma planilha-modelo para baixar. O sistema confere tudo antes (mostra o que será criado, atualizado e quais linhas têm erro) e só grava depois da confirmação. Aceita variações nos nomes das colunas, números com vírgula e CSV salvo pelo Excel brasileiro (com `;` e acentos).
- **Esqueci minha senha**: link na tela de login. Envia por e-mail um link que vale por 1 hora e só pode ser usado uma vez. A resposta é sempre a mesma (não revela quem tem conta) e há limite de tentativas.

#### Envio de e-mails (SMTP)

Para os e-mails saírem de verdade, configure estas variáveis (no Render: serviço → **Environment**):

| Variável | Exemplo |
|---|---|
| `SMTP_HOST` | `smtp-relay.brevo.com` ou `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | usuário do provedor |
| `SMTP_PASS` | senha/chave SMTP do provedor (no Gmail, uma "senha de app") |
| `EMAIL_FROM` | `Verissimo ERP <nao-responda@seudominio.com.br>` |

Sem SMTP, o sistema não envia: grava o e-mail em `apps/api/.emails/` e escreve o link no log do servidor (no Render, aba **Logs**). O administrador também pode trocar a senha de qualquer usuário em **Usuários**.

### Fiscal: NF-e e NFC-e (emissão própria, direto na SEFAZ)

O sistema monta, assina e envia as notas sem serviço intermediário pago:

- **NF-e (modelo 55)** a partir de um pedido faturado e **NFC-e (modelo 65)** automática em cada venda do PDV (com "CPF na nota"), layout 4.00, para empresas do **Simples Nacional** e **MEI** (ICMS por CSOSN).
- Assinatura digital com o **certificado A1** da empresa (enviado em Configuração fiscal e guardado criptografado), QR Code da NFC-e com o CSC, chave de acesso, numeração por série, cancelamento (evento 110111).
- **DANFE** para imprimir: cupom de 80 mm (NFC-e) e folha A4 com código de barras (NF-e), montados a partir do XML autorizado. Download do XML.
- Venda interestadual troca o CFOP para 6xxx; venda com nota autorizada só é cancelada depois de cancelar a nota; CPF/CNPJ conferidos antes do envio.
- Três ambientes: **Simulação** (gera e assina, não envia: para testar e demonstrar), **Homologação** (SEFAZ de teste) e **Produção**.

**Ainda falta para emitir de verdade:** cadastrar os endereços da SEFAZ do estado em [`apps/api/src/fiscal/sefaz/enderecos.ts`](apps/api/src/fiscal/sefaz/enderecos.ts) e testar em homologação com um certificado A1 real. Fora do escopo por enquanto: regime normal (ICMS/IPI destacados), substituição tributária calculada, IBS/CBS da reforma tributária (não exigidos do Simples em 2026), contingência offline, inutilização, carta de correção e NFS-e.

Variáveis do servidor para o fiscal:

| Variável | Para quê |
|---|---|
| `FISCAL_CHAVE` | Criptografa certificado, senha e CSC no banco (o `render.yaml` gera sozinho). Não troque depois de enviar certificados. |
| `RESP_TEC_CNPJ`, `RESP_TEC_CONTATO`, `RESP_TEC_EMAIL`, `RESP_TEC_FONE` | Responsável técnico (a sua software house), exigido por alguns estados no XML. |
| `SEFAZ_VERIFICAR_TLS` | `false` só se a conexão falhar por causa do certificado do servidor da SEFAZ (ICP-Brasil). |

Testes das partes que não dependem da SEFAZ (chave, XML, assinatura, QR Code, cliente SOAP contra um servidor simulado): `npm run test:fiscal -w apps/api`.

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

A empresa de demonstração vem com seis meses de histórico: 20 produtos, clientes e fornecedores, compras, vendas, caixas do PDV, despesas fixas e negócios no CRM. Há um usuário para cada perfil, todos com a senha `demo123`: `admin@`, `gerente@`, `vendedor@`, `financeiro@`, `estoque@` e `caixa@demo.com`. O histórico é gerado uma única vez (em [`prisma/exemplos.ts`](apps/api/prisma/exemplos.ts)), quando a empresa de demonstração ainda não tem pedidos.

### Testes

Com a API rodando, este comando testa os fluxos principais de ponta a ponta (vendas, estoque, financeiro, PDV, compras, CRM, perfis e separação entre empresas). Cada execução cria uma empresa nova, então não estraga seus dados:

```bash
npm run test:e2e -w apps/api
```

## Hospedagem (Render)

O arquivo [`render.yaml`](render.yaml) descreve tudo: um banco PostgreSQL e **um único serviço** que roda a API e entrega o site no mesmo endereço.

1. Crie uma conta em https://render.com e conecte ao GitHub.
2. No painel: **New → Blueprint**, escolha o repositório `verissimo-erp` e clique em **Apply**.
3. Aguarde o build (alguns minutos). O endereço aparece no serviço `verissimo-erp` (algo como `https://verissimo-erp.onrender.com`).

A cada `git push` na branch `main`, o Render publica a versão nova sozinho. Ao iniciar, o serviço aplica as migrações do banco e, com `SEED_DEMO=true`, cria a empresa de demonstração.

**Plano grátis:** o serviço dorme após 15 minutos sem acesso (o primeiro acesso depois disso leva cerca de 1 minuto) e o banco grátis **expira em 30 dias**. Antes de colocar clientes de verdade, troque o banco e o serviço para planos pagos e mude `SEED_DEMO` para `false`.

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
