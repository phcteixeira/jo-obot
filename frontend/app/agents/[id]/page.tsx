"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, API_URL } from "@/lib/api";
import type { AIProvider, Agent, Conversation, ConversationWithMessages, Credential } from "@/lib/types";

export default function AgentDetailPage({ params }: { params: { id: string } }) {
  const agentId = params.id;
  const router = useRouter();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [credential, setCredential] = useState<Credential | null | "not-found">(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.getAgent(agentId).then(setAgent).catch(() => setLoadError("Agente não encontrado."));
    api
      .getCredential(agentId)
      .then(setCredential)
      .catch((err) => setCredential(err instanceof ApiError && err.status === 404 ? "not-found" : null));
    api.listConversations(agentId).then(setConversations).catch(() => {});
  }, [agentId]);

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!agent) return <p className="text-sm text-gray-500">Carregando...</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{agent.name}</h1>
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Voltar
        </button>
      </div>

      <AgentForm agent={agent} onSaved={setAgent} />
      <CredentialForm agentId={agentId} credential={credential} onSaved={(c) => setCredential(c)} />
      <SendMessageCard agentId={agentId} hasCredential={agent.has_whatsapp_credential} />
      <ConversationsCard conversations={conversations} />
    </div>
  );
}

function AgentForm({ agent, onSaved }: { agent: Agent; onSaved: (a: Agent) => void }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [aiProvider, setAiProvider] = useState<AIProvider>(agent.ai_provider);
  const [aiModel, setAiModel] = useState(agent.ai_model ?? "");
  const [aiApiKey, setAiApiKey] = useState("");
  const [isActive, setIsActive] = useState(agent.is_active);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateAgent(agent.id, {
        name,
        description: description || null,
        system_prompt: systemPrompt,
        ai_provider: aiProvider,
        ai_model: aiModel || null,
        ...(aiApiKey ? { ai_api_key: aiApiKey } : {}),
        is_active: isActive,
      });
      onSaved(updated);
      setAiApiKey("");
      setMessage("Alterações salvas.");
    } catch (err) {
      setMessage(err instanceof ApiError ? `Erro: ${err.message}` : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card space-y-4">
      <h2 className="font-semibold">Configuração do agente</h2>

      <div>
        <label className="label">Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label className="label">Descrição</label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className="label">Persona / instruções (system prompt)</label>
        <textarea
          className="input"
          rows={4}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Provedor de IA</label>
          <select className="input" value={aiProvider} onChange={(e) => setAiProvider(e.target.value as AIProvider)}>
            <option value="none">Nenhum</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="label">Modelo</label>
          <input className="input" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">
          Chave de API do provedor {agent.has_ai_api_key && <span className="text-gray-400">(já configurada)</span>}
        </label>
        <input
          type="password"
          className="input"
          value={aiApiKey}
          onChange={(e) => setAiApiKey(e.target.value)}
          placeholder={agent.has_ai_api_key ? "Deixe em branco para manter a atual" : "sk-..."}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Agente ativo
      </label>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function CredentialForm({
  agentId,
  credential,
  onSaved,
}: {
  agentId: string;
  credential: Credential | null | "not-found";
  onSaved: (c: Credential) => void;
}) {
  const existing = credential && credential !== "not-found" ? credential : null;

  const [phoneNumberId, setPhoneNumberId] = useState(existing?.phone_number_id ?? "");
  const [wabaId, setWabaId] = useState(existing?.waba_id ?? "");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(existing?.display_phone_number ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState(existing?.verify_token ?? "");
  const [apiVersion, setApiVersion] = useState(existing?.api_version ?? "v21.0");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const webhookUrl = `${API_URL}/webhook/${agentId}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const saved = await api.upsertCredential(agentId, {
        phone_number_id: phoneNumberId,
        waba_id: wabaId || null,
        display_phone_number: displayPhoneNumber || null,
        access_token: accessToken || existing?.access_token_masked || "",
        app_secret: appSecret || undefined,
        verify_token: verifyToken,
        api_version: apiVersion,
      });
      onSaved(saved);
      setAccessToken("");
      setAppSecret("");
      setMessage("Credenciais salvas.");
    } catch (err) {
      setMessage(err instanceof ApiError ? `Erro: ${err.message}` : "Erro ao salvar credenciais.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="card space-y-4">
      <h2 className="font-semibold">Conexão com a Meta (WhatsApp Cloud API)</h2>

      <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600">
        Configure no painel de Webhooks do seu App da Meta:
        <br />
        <span className="font-mono">URL de callback:</span> <code className="break-all">{webhookUrl}</code>
        <br />
        <span className="font-mono">Verify token:</span> o mesmo valor definido abaixo.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Phone Number ID</label>
          <input className="input" required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
        </div>
        <div>
          <label className="label">WhatsApp Business Account ID</label>
          <input className="input" value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Número exibido (display phone number)</label>
        <input
          className="input"
          value={displayPhoneNumber}
          onChange={(e) => setDisplayPhoneNumber(e.target.value)}
          placeholder="+55 11 90000-0000"
        />
      </div>

      <div>
        <label className="label">
          Access Token {existing && <span className="text-gray-400">(atual: {existing.access_token_masked})</span>}
        </label>
        <input
          type="password"
          className="input"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={existing ? "Deixe em branco para manter o atual" : "EAAG..."}
          required={!existing}
        />
      </div>

      <div>
        <label className="label">
          App Secret {existing?.has_app_secret && <span className="text-gray-400">(já configurado)</span>}
        </label>
        <input
          type="password"
          className="input"
          value={appSecret}
          onChange={(e) => setAppSecret(e.target.value)}
          placeholder="Usado para validar a assinatura do webhook"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Verify Token</label>
          <input className="input" required value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} />
        </div>
        <div>
          <label className="label">Versão da API</label>
          <input className="input" value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} />
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Salvar credenciais"}
        </button>
      </div>
    </form>
  );
}

function SendMessageCard({ agentId, hasCredential }: { agentId: string; hasCredential: boolean }) {
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      await api.sendMessage(agentId, to, text);
      setMessage("Mensagem enviada.");
      setText("");
    } catch (err) {
      setMessage(err instanceof ApiError ? `Erro ao enviar: ${err.message}` : "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSend} className="card space-y-4">
      <h2 className="font-semibold">Testar envio de mensagem</h2>
      {!hasCredential && (
        <p className="text-sm text-amber-600">Configure as credenciais do WhatsApp acima antes de enviar.</p>
      )}
      <div className="grid grid-cols-3 gap-4">
        <input
          className="input col-span-1"
          placeholder="Número (ex: 5511999999999)"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          required
        />
        <input
          className="input col-span-2"
          placeholder="Mensagem"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={sending || !hasCredential}>
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </form>
  );
}

function ConversationsCard({ conversations }: { conversations: Conversation[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationWithMessages | null>(null);

  async function toggle(id: string) {
    if (open === id) {
      setOpen(null);
      setDetail(null);
      return;
    }
    setOpen(id);
    const conv = await api.getConversation(id);
    setDetail(conv);
  }

  return (
    <div className="card">
      <h2 className="mb-3 font-semibold">Conversas</h2>
      {conversations.length === 0 && <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>}
      <ul className="divide-y divide-gray-100">
        {conversations.map((conv) => (
          <li key={conv.id} className="py-3">
            <button className="flex w-full items-center justify-between text-left" onClick={() => toggle(conv.id)}>
              <span>
                <span className="font-medium">{conv.contact_name ?? conv.contact_wa_id}</span>{" "}
                <span className="text-xs text-gray-400">{conv.contact_wa_id}</span>
              </span>
              <span className="text-xs text-gray-400">
                {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString("pt-BR") : ""}
              </span>
            </button>
            {open === conv.id && detail && (
              <ul className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
                {detail.messages.map((msg) => (
                  <li
                    key={msg.id}
                    className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                      msg.direction === "inbound" ? "bg-white" : "ml-auto bg-brand-100"
                    }`}
                  >
                    <p>{msg.content}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {new Date(msg.created_at).toLocaleString("pt-BR")} · {msg.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
