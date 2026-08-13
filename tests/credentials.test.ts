import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET, PUT } from "@/app/api/agents/[id]/credentials/route";
import { POST } from "@/app/api/agents/route";

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function createAgent() {
  const res = await POST(jsonRequest("http://test/api/agents", "POST", { name: "Agente Teste" }));
  return (await res.json()).id as string;
}

describe("credentials", () => {
  it("upserts and fetches a credential without leaking the raw token", async () => {
    const agentId = await createAgent();

    const put = await PUT(
      jsonRequest(`http://test/api/agents/${agentId}/credentials`, "PUT", {
        phone_number_id: "123",
        waba_id: "456",
        access_token: "super-secret-token-value",
        app_secret: "app-secret-value",
        verify_token: "verify-me",
      }),
      { params: Promise.resolve({ id: agentId }) }
    );
    expect(put.status).toBe(200);
    const body = await put.json();
    expect(body.phone_number_id).toBe("123");
    expect(body.has_app_secret).toBe(true);
    expect(JSON.stringify(body)).not.toContain("super-secret-token-value");
    expect(body.access_token_masked.startsWith("supe")).toBe(true);

    const get = await GET(jsonRequest(`http://test/api/agents/${agentId}/credentials`, "GET"), {
      params: Promise.resolve({ id: agentId }),
    });
    expect(get.status).toBe(200);
    expect((await get.json()).phone_number_id).toBe("123");
  });

  it("upsert updates the existing row instead of creating a new one", async () => {
    const agentId = await createAgent();
    const payload = { phone_number_id: "123", access_token: "token-one", verify_token: "verify-me" };

    const first = await PUT(jsonRequest(`http://test/api/agents/${agentId}/credentials`, "PUT", payload), {
      params: Promise.resolve({ id: agentId }),
    });
    const second = await PUT(
      jsonRequest(`http://test/api/agents/${agentId}/credentials`, "PUT", { ...payload, phone_number_id: "999" }),
      { params: Promise.resolve({ id: agentId }) }
    );

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(firstBody.id).toBe(secondBody.id);
    expect(secondBody.phone_number_id).toBe("999");
  });

  it("404s when no credential is configured", async () => {
    const agentId = await createAgent();
    const res = await GET(jsonRequest(`http://test/api/agents/${agentId}/credentials`, "GET"), {
      params: Promise.resolve({ id: agentId }),
    });
    expect(res.status).toBe(404);
  });
});
