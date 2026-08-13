# jo-obot

App para gerenciar agentes de IA que respondem no WhatsApp através da **API oficial da Meta (WhatsApp Cloud API)**.

Cada **agente** representa um número do WhatsApp Business: tem seu próprio nome, persona/system prompt, provedor de IA (Anthropic, OpenAI ou nenhum) e suas próprias credenciais da Meta. O backend recebe os webhooks da Meta, guarda o histórico de conversas e permite enviar mensagens de volta pela Cloud API.

## Arquitetura

Monorepo com dois projetos independentes:

```
backend/    FastAPI (Python) — API REST + integração com a WhatsApp Cloud API
frontend/   Next.js (TypeScript) — dashboard para gerenciar agentes
```

- **Banco de dados:** PostgreSQL (recomendado um serviço gerenciado como Neon ou Supabase em produção).
- **Segredos** (access token e app secret da Meta, chaves de IA) são armazenados **criptografados em repouso** (Fernet) e nunca retornados em texto puro pela API — apenas mascarados.
- Cada agente tem sua própria URL de webhook: `POST/GET /webhook/{agent_id}`, o que permite conectar números/Apps diferentes da Meta a agentes diferentes.

## Backend (FastAPI)

### Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# edite .env: DATABASE_URL e gere uma ENCRYPTION_KEY:
.venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Suba um Postgres local (ou aponte `DATABASE_URL` para um Postgres gerenciado):

```bash
docker compose up -d db
```

Rode as migrations e inicie a API:

```bash
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload --port 8000
```

A API sobe em `http://localhost:8000` (docs interativas em `/docs`).

### Testes

```bash
.venv/bin/pytest
```

### Principais endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET/POST` | `/agents` | Listar / criar agentes |
| `GET/PATCH/DELETE` | `/agents/{id}` | Detalhar / atualizar / remover um agente |
| `GET/PUT/DELETE` | `/agents/{id}/credentials` | Ver / cadastrar / remover credenciais da Meta do agente |
| `GET` | `/webhook/{agent_id}` | Verificação do webhook (handshake da Meta) |
| `POST` | `/webhook/{agent_id}` | Recebimento de mensagens/status do WhatsApp |
| `POST` | `/agents/{id}/messages/send` | Enviar mensagem de texto via WhatsApp |
| `GET` | `/agents/{id}/conversations` | Listar conversas do agente |
| `GET` | `/conversations/{id}` | Detalhe de uma conversa com mensagens |

### Configurando o webhook no painel da Meta

1. Crie um agente e cadastre suas credenciais (`phone_number_id`, `access_token`, `verify_token`, e opcionalmente `app_secret` para validar a assinatura das requisições).
2. No [Meta for Developers](https://developers.facebook.com/), no seu App → WhatsApp → Configuration, configure:
   - **Callback URL:** `https://SEU_DOMINIO/webhook/{agent_id}` (em desenvolvimento local, use `ngrok` ou similar para expor `localhost:8000`).
   - **Verify token:** o mesmo valor cadastrado no agente.
3. Assine o campo `messages`.

## Frontend (Next.js)

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# edite NEXT_PUBLIC_API_URL se o backend não estiver em localhost:8000
npm run dev
```

Dashboard em `http://localhost:3000`: criar/editar agentes, cadastrar credenciais da Meta, ver a URL de webhook a configurar, testar envio de mensagens e visualizar conversas.

## Roadmap (próximos passos sugeridos)

- Gerar respostas automáticas via IA (Anthropic/OpenAI) a partir das mensagens recebidas — hoje elas só são armazenadas.
- Autenticação/login no dashboard (hoje a API não tem controle de acesso).
- Suporte a mensagens de mídia (imagem, áudio, documentos) além de texto.
- Fila/worker assíncrono para processar webhooks e gerar respostas sem bloquear a requisição da Meta.
