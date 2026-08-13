# jo-obot

App para gerenciar agentes de IA que respondem no WhatsApp através da **API oficial da Meta (WhatsApp Cloud API)**.

Cada **agente** representa um número do WhatsApp Business: tem seu próprio nome, persona/system prompt, provedor de IA (Anthropic, OpenAI ou nenhum) e suas próprias credenciais da Meta. O app recebe os webhooks da Meta, guarda o histórico de conversas e permite enviar mensagens de volta pela Cloud API.

## Arquitetura

**Um único projeto Next.js (App Router)** — frontend e backend no mesmo deploy, sem runtime separado. Pensado para rodar 100% na Vercel:

- **UI**: páginas em `app/` (dashboard de agentes).
- **API**: Route Handlers em `app/api/**/route.ts` fazem o papel do backend (CRUD de agentes, webhook da Meta, envio de mensagens).
- **Banco de dados**: PostgreSQL via [Prisma](https://www.prisma.io/). Recomendado [Neon](https://neon.tech) (serverless, com pooler compatível com funções serverless da Vercel).
- **Segredos** (access token e app secret da Meta, chaves de IA) são armazenados **criptografados em repouso** (AES-256-GCM) e nunca retornados em texto puro pela API — apenas mascarados.
- Cada agente tem sua própria URL de webhook: `POST/GET /api/webhook/{agent_id}`, o que permite conectar números/Apps diferentes da Meta a agentes diferentes.

```
app/
  page.tsx                 dashboard: lista de agentes
  agents/new/page.tsx       criar agente
  agents/[id]/page.tsx      editar agente, credenciais, testar envio, conversas
  api/
    agents/route.ts                        GET (listar) / POST (criar)
    agents/[id]/route.ts                   GET / PATCH / DELETE
    agents/[id]/credentials/route.ts       GET / PUT / DELETE
    agents/[id]/messages/send/route.ts     POST (enviar mensagem)
    agents/[id]/conversations/route.ts     GET (listar conversas)
    conversations/[id]/route.ts            GET (conversa + mensagens)
    webhook/[agentId]/route.ts             GET (verificação) / POST (recebimento)
lib/       prisma client, criptografia, cliente da WhatsApp Cloud API, validação (zod)
prisma/    schema.prisma + migrations
```

## Setup local

```bash
npm install               # também roda `prisma generate` (postinstall)
cp .env.example .env.local
# gere uma ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Suba um Postgres local:

```bash
docker compose up -d db
```

Rode as migrations e inicie o app:

```bash
npm run db:migrate   # aplica as migrations no Postgres local
npm run dev
```

App em `http://localhost:3000`.

### Testes

```bash
npm test
```

Os testes chamam os Route Handlers diretamente (sem subir um servidor) contra um Postgres local de teste. Crie o banco antes de rodar:

```bash
createdb -U joobot joobot_test   # ou: psql -c "CREATE DATABASE joobot_test OWNER joobot;"
DATABASE_URL=postgresql://joobot:joobot@localhost:5432/joobot_test DIRECT_URL=$DATABASE_URL npx prisma migrate deploy
npm test
```

## Deploy na Vercel

1. Crie um banco no [Neon](https://neon.tech) (ou use a integração Neon do próprio [Vercel Marketplace](https://vercel.com/marketplace)).
2. No projeto da Vercel, configure as variáveis de ambiente:
   - `DATABASE_URL` — connection string **pooled** do Neon, com `?pgbouncer=true&connect_timeout=15` no final.
   - `DIRECT_URL` — connection string **unpooled** do Neon (usada só para migrations).
   - `ENCRYPTION_KEY` — chave gerada como acima.
3. Rode as migrations contra o banco de produção (uma vez, localmente ou via CI, usando `DIRECT_URL`):
   ```bash
   DATABASE_URL=$DIRECT_URL DIRECT_URL=$DIRECT_URL npx prisma migrate deploy
   ```
4. Importe o repositório na Vercel — é um projeto Next.js padrão, zero configuração adicional (`next build` já é o build command default; `prisma generate` roda automaticamente no `postinstall`).

Depois do deploy, a URL de webhook de cada agente vai ser `https://SEU_DOMINIO.vercel.app/api/webhook/{agent_id}` — o dashboard mostra essa URL pronta na página de cada agente.

### Configurando o webhook no painel da Meta

1. Crie um agente e cadastre suas credenciais (`phone_number_id`, `access_token`, `verify_token`, e opcionalmente `app_secret` para validar a assinatura das requisições).
2. No [Meta for Developers](https://developers.facebook.com/), no seu App → WhatsApp → Configuration, configure:
   - **Callback URL:** a URL de webhook mostrada no dashboard do agente.
   - **Verify token:** o mesmo valor cadastrado no agente.
3. Assine o campo `messages`.

## Roadmap (próximos passos sugeridos)

- Gerar respostas automáticas via IA (Anthropic/OpenAI) a partir das mensagens recebidas — hoje elas só são armazenadas.
- Autenticação/login no dashboard (hoje a API não tem controle de acesso).
- Suporte a mensagens de mídia (imagem, áudio, documentos) além de texto.
- Fila/worker para processar webhooks e gerar respostas de forma assíncrona.
