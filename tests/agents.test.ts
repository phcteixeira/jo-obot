import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DELETE, GET as GET_ONE, PATCH } from "@/app/api/agents/[id]/route";
import { GET as LIST, POST } from "@/app/api/agents/route";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createAgent(body: Record<string, unknown> = { name: "Suporte Loja" }) {
  const response = await POST(jsonRequest("http://test/api/agents", "POST", body));
  return { response, json: await response.json() };
}

describe("agents", () => {
  it("creates and fetches an agent", async () => {
    const { response, json } = await createAgent({
      name: "Suporte Loja",
      system_prompt: "Voce e um atendente simpatico.",
      ai_provider: "anthropic",
      ai_model: "claude-sonnet-5",
    });
    expect(response.status).toBe(201);
    expect(json.name).toBe("Suporte Loja");
    expect(json.has_whatsapp_credential).toBe(false);

    const getRes = await GET_ONE(jsonRequest(`http://test/api/agents/${json.id}`, "GET"), {
      params: Promise.resolve({ id: json.id }),
    });
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).id).toBe(json.id);
  });

  it("lists agents (empty by default)", async () => {
    const res = await LIST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("updates an agent", async () => {
    const { json: agent } = await createAgent({ name: "Bot 1" });
    const res = await PATCH(
      jsonRequest(`http://test/api/agents/${agent.id}`, "PATCH", { name: "Bot Atualizado", is_active: false }),
      { params: Promise.resolve({ id: agent.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Bot Atualizado");
    expect(body.is_active).toBe(false);
  });

  it("deletes an agent", async () => {
    const { json: agent } = await createAgent({ name: "Temp" });
    const del = await DELETE(jsonRequest(`http://test/api/agents/${agent.id}`, "DELETE"), {
      params: Promise.resolve({ id: agent.id }),
    });
    expect(del.status).toBe(204);

    const get = await GET_ONE(jsonRequest(`http://test/api/agents/${agent.id}`, "GET"), {
      params: Promise.resolve({ id: agent.id }),
    });
    expect(get.status).toBe(404);
  });

  it("404s for a missing agent", async () => {
    const res = await GET_ONE(jsonRequest("http://test/api/agents/does-not-exist", "GET"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});
