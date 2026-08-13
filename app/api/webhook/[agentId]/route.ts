import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptSecret, verifyMetaSignature } from "@/lib/security";
import { parseWebhookPayload } from "@/lib/whatsapp";
import { errorResponse, notFound } from "@/lib/http";
import { MessageStatus, Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ agentId: string }> };

/**
 * Handles Meta's webhook verification handshake (GET request).
 *
 * Configure this URL (https://your-domain/api/webhook/{agentId}) plus the
 * agent's verify_token in the Meta App dashboard's Webhooks settings.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const credential = await prisma.whatsAppCredential.findUnique({ where: { agentId } });
  if (!credential) return notFound("No WhatsApp credential configured for this agent");

  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && verifyToken === credential.verifyToken && challenge !== null) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return errorResponse(403, "Webhook verification failed");
}

/** Receives inbound messages and status updates from the WhatsApp Cloud API. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { agentId } = await params;
  const credential = await prisma.whatsAppCredential.findUnique({ where: { agentId } });
  if (!credential) return notFound("No WhatsApp credential configured for this agent");

  const rawBody = Buffer.from(await request.arrayBuffer());

  const appSecret = decryptSecret(credential.appSecretEncrypted);
  if (appSecret) {
    const signature = request.headers.get("X-Hub-Signature-256");
    if (!verifyMetaSignature(appSecret, rawBody, signature)) {
      return errorResponse(403, "Invalid webhook signature");
    }
  } else {
    console.warn(`Agent ${agentId} has no app_secret configured; skipping signature verification`);
  }

  const payload = JSON.parse(rawBody.toString("utf8"));
  const parsed = parseWebhookPayload(payload);

  for (const inbound of parsed.messages) {
    const conversation = await prisma.conversation.upsert({
      where: { agentId_contactWaId: { agentId, contactWaId: inbound.contactWaId } },
      create: {
        agentId,
        contactWaId: inbound.contactWaId,
        contactName: inbound.contactName,
      },
      update: inbound.contactName ? { contactName: inbound.contactName } : {},
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "inbound",
        waMessageId: inbound.waMessageId || null,
        messageType: inbound.messageType,
        content: inbound.text,
        status: "received",
        rawPayload: inbound.raw as Prisma.InputJsonValue,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
  }

  const validStatuses = new Set(Object.values(MessageStatus));
  for (const statusUpdate of parsed.statuses) {
    if (!validStatuses.has(statusUpdate.status as MessageStatus)) continue;
    await prisma.message
      .update({
        where: { waMessageId: statusUpdate.waMessageId },
        data: { status: statusUpdate.status as MessageStatus },
      })
      .catch(() => {
        // Message not found locally (e.g. sent from outside this app) — ignore.
      });
  }

  // Meta expects a fast 200 response regardless of what we did with the payload.
  return NextResponse.json({
    status: "ok",
    messages_received: parsed.messages.length,
    statuses_received: parsed.statuses.length,
  });
}
