"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Agent } from "@/lib/types";

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAgents()
      .then(setAgents)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? `Erro da API: ${err.message}`
            : "Não foi possível conectar à API. Verifique se o backend está rodando."
        )
      );
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este agente e todos os dados associados?")) return;
    await api.deleteAgent(id);
    setAgents((prev) => prev?.filter((a) => a.id !== id) ?? null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes</h1>
          <p className="text-sm text-gray-500">Gerencie os agentes de IA conectados ao WhatsApp.</p>
        </div>
        <Link href="/agents/new" className="btn-primary">
          + Novo agente
        </Link>
      </div>

      {error && <div className="card mb-4 border-red-200 bg-red-50 text-red-700">{error}</div>}

      {!error && agents === null && <p className="text-sm text-gray-500">Carregando...</p>}

      {agents && agents.length === 0 && (
        <div className="card text-center text-sm text-gray-500">
          Nenhum agente cadastrado ainda. Crie o primeiro para conectar um número do WhatsApp.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {agents?.map((agent) => (
          <div key={agent.id} className="card">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <Link href={`/agents/${agent.id}`} className="font-semibold text-brand-700 hover:underline">
                  {agent.name}
                </Link>
                {agent.description && <p className="text-sm text-gray-500">{agent.description}</p>}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  agent.is_active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {agent.is_active ? "Ativo" : "Inativo"}
              </span>
            </div>

            <dl className="mt-3 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <dt>Provedor de IA</dt>
                <dd className="font-medium text-gray-700">{agent.ai_provider}</dd>
              </div>
              <div className="flex justify-between">
                <dt>WhatsApp configurado</dt>
                <dd className={agent.has_whatsapp_credential ? "font-medium text-brand-700" : "text-gray-400"}>
                  {agent.has_whatsapp_credential ? "Sim" : "Não"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <Link href={`/agents/${agent.id}`} className="btn-secondary flex-1">
                Gerenciar
              </Link>
              <button onClick={() => handleDelete(agent.id)} className="btn-danger">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
