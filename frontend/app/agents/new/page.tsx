"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AIProvider } from "@/lib/types";

export default function NewAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "Você é um assistente simpático e objetivo que responde clientes no WhatsApp."
  );
  const [aiProvider, setAiProvider] = useState<AIProvider>("none");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const agent = await api.createAgent({
        name,
        description: description || null,
        system_prompt: systemPrompt,
        ai_provider: aiProvider,
        ai_model: aiModel || null,
        ai_api_key: aiApiKey || null,
      });
      router.push(`/agents/${agent.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar agente.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Novo agente</h1>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Nome
          </label>
          <input
            id="name"
            className="input"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Suporte Loja"
          />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Descrição (opcional)
          </label>
          <input
            id="description"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Atendimento inicial da loja online"
          />
        </div>

        <div>
          <label className="label" htmlFor="system_prompt">
            Persona / instruções (system prompt)
          </label>
          <textarea
            id="system_prompt"
            className="input"
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="ai_provider">
              Provedor de IA
            </label>
            <select
              id="ai_provider"
              className="input"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value as AIProvider)}
            >
              <option value="none">Nenhum (somente registrar mensagens)</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="ai_model">
              Modelo
            </label>
            <input
              id="ai_model"
              className="input"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="Ex: claude-sonnet-5"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ai_api_key">
            Chave de API do provedor (opcional, sobrescreve a chave padrão do servidor)
          </label>
          <input
            id="ai_api_key"
            type="password"
            className="input"
            value={aiApiKey}
            onChange={(e) => setAiApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={() => router.push("/")}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Criando..." : "Criar agente"}
          </button>
        </div>
      </form>
    </div>
  );
}
