# Infraestrutura: DEV, HML e PRD

Este guia monta os ambientes da Estância Maciel: **Neon** (banco), **Render** (API e painel) e **Firebase Hosting** (catálogo), com o deploy feito pelo **GitHub Actions**. As decisões por trás de cada escolha estão em `../docs/02-arquitetura-decisoes.md` (ADR-006, 012 e 013).

> Nenhum deploy real foi feito ainda. Os passos 1 a 5 exigem as suas contas e devem ser executados por você ou com credenciais que você autorizar.

## Branches
| Branch | Uso | Deploy |
|---|---|---|
| `feature/*` | Desenvolvimento | Só CI (testes) |
| `develop` | Homologação | CI verde → Render HML (automático) |
| `main` | Produção | CI verde → **aprovação manual** → Render PRD |
| `hotfix/*` | Correção urgente, nasce de `main` | Volta por PR para `main` e `develop` |

## 1. Neon: dois projetos isolados
1. Crie o projeto **estancia-hml**. A região deve ficar próxima do Render: `us-east-2` (Ohio) combina com `region: ohio` no `render.yaml`.
2. Crie o projeto **estancia-prd** na mesma região. São projetos separados: credenciais, limites e backups independentes.
3. Em cada projeto, copie duas connection strings:
   - **Pooled**: o host tem `-pooler`. Vai em `DATABASE_URL`.
   - **Direct**: o host não tem `-pooler`. Vai em `DIRECT_URL`, usada só pelas migrations.
   - Troque `sslmode=require` por `sslmode=verify-full` nas duas.
4. **PRD:** defina a retenção de histórico (PITR) conforme o plano. Anote como restaurar (seção "Backup e restauração").
5. Recomendado: crie um usuário próprio da aplicação em vez de usar `neondb_owner`, e guarde o owner só para migrations.

## 2. Render: Blueprint (só HML por enquanto)
1. Render → **New → Blueprint** → repositório `estancia-api` → Apply. É criado o serviço `estancia-api-hml` (plano free, branch `develop`). O serviço de PRD (pago) só entra no go-live.
2. O Render pede **3 valores** do grupo **estancia-hml**:

| Variável | O que colar |
|---|---|
| `DATABASE_URL` | endereço do Neon HML **com** pooling (host com `-pooler`), com `sslmode=verify-full` |
| `DIRECT_URL` | o mesmo endereço **sem** pooling |
| `DB_HOSTS_PERMITIDOS` | os dois hosts (a parte entre `@` e `/`), separados por vírgula |

   O Render gera o `JWT_SECRET`. `APP_ENV`, `SEED_DEMO`, `MODULOS_OPCIONAIS`, `REGISTRO_PUBLICO` e `WEB_URL` já vêm definidos.
3. Deploy: `autoDeployTrigger: checksPass`. Cada push em `develop` publica em HML **depois** que o CI do GitHub passa.
4. **Primeiro acesso:** abra a URL do serviço. Sem nenhum usuário, o painel mostra a tela **Boas-vindas à Estância Maciel**, onde se cria o administrador. A tela só funciona uma vez. Faça isso logo após o primeiro deploy.

**Trava de ambiente:** a API e as migrations **não rodam** se o host do banco não estiver em `DB_HOSTS_PERMITIDOS`, se o `JWT_SECRET` tiver menos de 32 caracteres ou se `SEED_DEMO=true` em PRD. Assim o HML nunca grava no banco de PRD por engano.

## 3. GitHub
- Proteja as branches `main` e `develop` em **Settings → Branches**: exigir PR, exigir o check `CI / verificar` e bloquear push direto.
- **No go-live (PRD):** crie o environment **production** com **Required reviewers** e restrito à branch `main`. Cadastre o secret `RENDER_DEPLOY_HOOK_PRD` e a variable `PRD_URL`. Enquanto `PRD_URL` não existir, o job de deploy de PRD é ignorado.

## 4. Firebase Hosting (catálogo)
Configurado na Fase 4, junto com o `estancia-catalogo`:
- **Sites:** dois sites no mesmo projeto Firebase, `estancia-hml` e `estancia`, ou dois projetos.
- **Hosting:** SPA com o rewrite `** → /index.html`. Variável pública de build: `API_URL` (a URL do Render do ambiente).
- **CORS:** a origem do site precisa estar no `WEB_URL` da API do mesmo ambiente.

## 5. DEV local
```bash
# Node 24 (veja .node-version)
npm ci
cp apps/api/.env.example apps/api/.env   # preencha com o Neon DEV
npm run db:migrate -w apps/api            # ou: npx prisma migrate deploy (em apps/api)
npm run dev:api                           # http://localhost:3333/api  · Swagger em /api/docs
npm run dev:web                           # http://localhost:3000
npm test -w apps/api                      # unitários + concorrência (usa DATABASE_URL_TESTE)
```

## Pipeline (`.github/workflows/ci.yml`)
1. `npm ci` + auditoria das dependências de produção (`npm audit --omit=dev --audit-level=high`).
2. Migrations num Postgres 18 descartável.
3. Lint, checagem de tipos, Vitest (unitários e concorrência de estoque, numeração e status) e build da API e do painel.
4. E2E herdados (fase1, importação, relatórios, fase2) contra a API compilada.
5. **develop:** o Render publica HML sozinho quando o CI passa.
6. **main:** aguarda aprovação no environment `production`, chama o deploy hook PRD e espera o health check.

## Rollback
- **Render:** Dashboard → serviço → **Events** → deploy anterior → **Rollback**. Isso volta o código. As migrations são só aditivas (ADR-017), então o código anterior continua compatível com o banco.
- **Pelo Git:** reverta o commit em `main` com `git revert`, abra um PR e aprove o deploy.

## Backup e restauração (Neon)
- O Neon guarda histórico (PITR) conforme a retenção do plano.
- Para restaurar, crie um **branch a partir de um ponto no tempo**, valide os dados e então troque `DATABASE_URL` e `DIRECT_URL` do serviço para esse branch, ou use o *restore* do branch principal.
- Teste a restauração em HML antes do go-live e anote o tempo gasto.
- Antes de cada migration em PRD, crie um branch manual de segurança (`pre-migracao-AAAAMMDD`).

## Troubleshooting
| Sintoma | Causa provável |
|---|---|
| `Banco "..." não é permitido em HML` | `DATABASE_URL` aponta para o banco errado, ou falta o host em `DB_HOSTS_PERMITIDOS` |
| `JWT_SECRET precisa ter pelo menos 32 caracteres` | Segredo manual curto: use o gerado pelo Render |
| Migration trava ou falha com o pooler | `DIRECT_URL` ausente: as migrations precisam da conexão direta |
| HML demora cerca de 1 minuto para responder | Plano free do Render "acordando" |
| CORS bloqueado no catálogo | Origem do Firebase ausente em `WEB_URL` |
