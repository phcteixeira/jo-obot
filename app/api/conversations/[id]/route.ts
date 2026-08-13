import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeConversationWithMessages } from "@/lib/serializers";
import { notFound } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return notFound("Conversation not found");

  return NextResponse.json(serializeConversationWithMessages(conversation));
}
