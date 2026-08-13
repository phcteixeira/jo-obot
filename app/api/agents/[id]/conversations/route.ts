import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeConversation } from "@/lib/serializers";
import { notFound } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id: agentId } = await params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return notFound("Agent not found");

  const conversations = await prisma.conversation.findMany({
    where: { agentId },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
  });

  return NextResponse.json(conversations.map(serializeConversation));
}
