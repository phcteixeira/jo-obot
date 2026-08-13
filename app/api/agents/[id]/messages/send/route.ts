import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMessage } from "@/lib/serializers";
import { sendMessageSchema } from "@/lib/validation";
import { badRequest, errorResponse, notFound } from "@/lib/http";
import { sendTextMessage, WhatsAppAPIError } from "@/lib/whatsapp";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: agentId } = await params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { credential: true } });
  if (!agent) return notFound("Agent not found");
  if (!agent.credential) return errorResponse(400, "Agent has no WhatsApp credential configured");

  const parsed = sendMessageSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const { to, text } = parsed.data;

  let response;
  try {
    response = await sendTextMessage(agent.credential, to, text);
  } catch (err) {
    if (err instanceof WhatsAppAPIError) {
      return errorResponse(502, { whatsapp_error: err.payload });
    }
    throw err;
  }

  const waMessageId = response.messages?.[0]?.id ?? null;

  const conversation = await prisma.conversation.upsert({
    where: { agentId_contactWaId: { agentId, contactWaId: to } },
    create: { agentId, contactWaId: to },
    update: {},
  });

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      waMessageId,
      messageType: "text",
      content: text,
      status: "sent",
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json(serializeMessage(message), { status: 201 });
}
