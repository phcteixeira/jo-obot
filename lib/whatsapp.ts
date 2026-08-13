/** Client for the Meta WhatsApp Cloud API + parsing of incoming webhook payloads. */
import type { WhatsAppCredential } from "@prisma/client";
import { decryptSecret } from "./security";

const GRAPH_BASE_URL = "https://graph.facebook.com";

export class WhatsAppAPIError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`WhatsApp API error (${status}): ${JSON.stringify(payload)}`);
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Sends a free-form text message via the WhatsApp Cloud API.
 * Returns the parsed JSON response from Meta, which includes the outbound
 * message id under response.messages[0].id.
 */
export async function sendTextMessage(
  credential: WhatsAppCredential,
  to: string,
  text: string
): Promise<{ messages?: { id: string }[] } & Record<string, unknown>> {
  const accessToken = decryptSecret(credential.accessTokenEncrypted);
  const url = `${GRAPH_BASE_URL}/${credential.apiVersion}/${credential.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new WhatsAppAPIError(response.status, data);
  }
  return data;
}

export interface ParsedInboundMessage {
  phoneNumberId: string;
  contactWaId: string;
  contactName: string | null;
  waMessageId: string;
  messageType: string;
  text: string;
  timestamp: string;
  raw: Record<string, unknown>;
}

export interface ParsedStatusUpdate {
  phoneNumberId: string;
  waMessageId: string;
  status: string;
  recipientId: string;
  raw: Record<string, unknown>;
}

export interface ParsedWebhookPayload {
  messages: ParsedInboundMessage[];
  statuses: ParsedStatusUpdate[];
}

function extractText(message: any): string {
  const type = message.type ?? "text";
  if (type === "text") return message.text?.body ?? "";
  if (type === "button") return message.button?.text ?? "";
  if (type === "interactive") {
    const interactive = message.interactive ?? {};
    if (interactive.button_reply) return interactive.button_reply.title ?? "";
    if (interactive.list_reply) return interactive.list_reply.title ?? "";
    return "";
  }
  // For media/location/etc. we don't download the payload in this MVP,
  // just record the type so it still shows up in the conversation.
  return `[${type} message]`;
}

/** Parses a Meta WhatsApp Cloud API webhook POST body into a flat structure. */
export function parseWebhookPayload(payload: any): ParsedWebhookPayload {
  const result: ParsedWebhookPayload = { messages: [], statuses: [] };

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const metadata = value.metadata ?? {};
      const phoneNumberId: string = metadata.phone_number_id ?? "";

      const contactsByWaId = new Map<string, string | null>();
      for (const contact of value.contacts ?? []) {
        contactsByWaId.set(contact.wa_id, contact.profile?.name ?? null);
      }

      for (const message of value.messages ?? []) {
        const waId = message.from ?? "";
        result.messages.push({
          phoneNumberId,
          contactWaId: waId,
          contactName: contactsByWaId.get(waId) ?? null,
          waMessageId: message.id ?? "",
          messageType: message.type ?? "text",
          text: extractText(message),
          timestamp: message.timestamp ?? "",
          raw: message,
        });
      }

      for (const status of value.statuses ?? []) {
        result.statuses.push({
          phoneNumberId,
          waMessageId: status.id ?? "",
          status: status.status ?? "",
          recipientId: status.recipient_id ?? "",
          raw: status,
        });
      }
    }
  }

  return result;
}
