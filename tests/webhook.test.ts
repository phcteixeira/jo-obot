import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as LIST_CONVERSATIONS } from "@/app/api/agents/[id]/conversations/route";
import { PUT } from "@/app/api/agents/[id]/credentials/route";
import { POST as CREATE_AGENT } from "@/app/api/agents/route";
import { GET as GET_CONVERSATION } from "@/app/api/conversations/[id]/route";
import { GET as VERIFY, POST as RECEIVE } from "@/app/api/webhook/[agentId]/route";

const APP_SECRET = "app-secret-value";
const VERIFY_TOKEN = "verify-me";

function sign(payload: string): string {
  const digest = crypto.createHmac("sha256", APP_SECRET).update(payload).digest("hex");
  return `sha256=${digest}`;
}

async function createAgentWithCredential(): Promise<string> {
  const agentRes = await CREATE_AGENT(
    new NextRequest("http://test/api/agents", { method: "POST", body: JSON.stringify({ name: "Agente Teste" }) })
  );
  const agentId = (await agentRes.json()).id as string;

  await PUT(
    new NextRequest(`http://test/api/agents/${agentId}/credentials`, {
      method: "PUT",
      body: JSON.stringify({
        phone_number_id: "123",
        access_token: "token",
        app_secret: APP_SECRET,
        verify_token: VERIFY_TOKEN,
      }),
    }),
    { params: Promise.resolve({ id: agentId }) }
  );

  return agentId;
}

function inboundPayload() {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "+1", phone_number_id: "123" },
              contacts: [{ profile: { name: "Maria" }, wa_id: "5511999999999" }],
              messages: [
                {
                  from: "5511999999999",
                  id: "wamid.abc",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Oi, tudo bem?" },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

describe("webhook", () => {
  it("verifies successfully with the right token", async () => {
    const agentId = await createAgentWithCredential();
    const res = await VERIFY(
      new NextRequest(
        `http://test/api/webhook/${agentId}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`
      ),
      { params: Promise.resolve({ agentId }) }
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc123");
  });

  it("rejects verification with the wrong token", async () => {
    const agentId = await createAgentWithCredential();
    const res = await VERIFY(
      new NextRequest(
        `http://test/api/webhook/${agentId}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`
      ),
      { params: Promise.resolve({ agentId }) }
    );
    expect(res.status).toBe(403);
  });

  it("404s verification for a missing agent", async () => {
    const res = await VERIFY(
      new NextRequest(
        "http://test/api/webhook/does-not-exist?hub.mode=subscribe&hub.verify_token=x&hub.challenge=abc123"
      ),
      { params: Promise.resolve({ agentId: "does-not-exist" }) }
    );
    expect(res.status).toBe(404);
  });

  it("receives a message with a valid signature and stores it", async () => {
    const agentId = await createAgentWithCredential();
    const body = JSON.stringify(inboundPayload());

    const res = await RECEIVE(
      new NextRequest(`http://test/api/webhook/${agentId}`, {
        method: "POST",
        body,
        headers: { "X-Hub-Signature-256": sign(body) },
      }),
      { params: Promise.resolve({ agentId }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).messages_received).toBe(1);

    const convRes = await LIST_CONVERSATIONS(new NextRequest(`http://test/api/agents/${agentId}/conversations`), {
      params: Promise.resolve({ id: agentId }),
    });
    const conversations = await convRes.json();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].contact_wa_id).toBe("5511999999999");
    expect(conversations[0].contact_name).toBe("Maria");

    const detailRes = await GET_CONVERSATION(new NextRequest(`http://test/api/conversations/${conversations[0].id}`), {
      params: Promise.resolve({ id: conversations[0].id }),
    });
    const detail = await detailRes.json();
    expect(detail.messages).toHaveLength(1);
    expect(detail.messages[0].content).toBe("Oi, tudo bem?");
    expect(detail.messages[0].direction).toBe("inbound");
    expect(detail.messages[0].wa_message_id).toBe("wamid.abc");
  });

  it("rejects a message with an invalid signature", async () => {
    const agentId = await createAgentWithCredential();
    const body = JSON.stringify(inboundPayload());

    const res = await RECEIVE(
      new NextRequest(`http://test/api/webhook/${agentId}`, {
        method: "POST",
        body,
        headers: { "X-Hub-Signature-256": "sha256=deadbeef" },
      }),
      { params: Promise.resolve({ agentId }) }
    );
    expect(res.status).toBe(403);

    const convRes = await LIST_CONVERSATIONS(new NextRequest(`http://test/api/agents/${agentId}/conversations`), {
      params: Promise.resolve({ id: agentId }),
    });
    expect(await convRes.json()).toEqual([]);
  });
});
