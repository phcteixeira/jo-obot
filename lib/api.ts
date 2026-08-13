import type {
  Agent,
  AgentInput,
  Conversation,
  ConversationWithMessages,
  Credential,
  CredentialInput,
  Message,
} from "./types";

// Backend and frontend now live in the same Next.js app, so API routes are
// same-origin under /api — no separate base URL needed.
const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new ApiError(response.status, (detail as { detail?: unknown })?.detail ?? detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  listAgents: () => request<Agent[]>("/agents"),
  getAgent: (id: string) => request<Agent>(`/agents/${id}`),
  createAgent: (data: AgentInput) => request<Agent>("/agents", { method: "POST", body: JSON.stringify(data) }),
  updateAgent: (id: string, data: Partial<AgentInput>) =>
    request<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAgent: (id: string) => request<void>(`/agents/${id}`, { method: "DELETE" }),

  getCredential: (agentId: string) => request<Credential>(`/agents/${agentId}/credentials`),
  upsertCredential: (agentId: string, data: CredentialInput) =>
    request<Credential>(`/agents/${agentId}/credentials`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCredential: (agentId: string) => request<void>(`/agents/${agentId}/credentials`, { method: "DELETE" }),

  sendMessage: (agentId: string, to: string, text: string) =>
    request<Message>(`/agents/${agentId}/messages/send`, {
      method: "POST",
      body: JSON.stringify({ to, text }),
    }),
  listConversations: (agentId: string) => request<Conversation[]>(`/agents/${agentId}/conversations`),
  getConversation: (id: string) => request<ConversationWithMessages>(`/conversations/${id}`),
};
