import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAgent } from "@/lib/serializers";
import { encryptSecret } from "@/lib/security";
import { agentUpdateSchema } from "@/lib/validation";
import { badRequest, notFound } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({ where: { id }, include: { credential: true } });
  if (!agent) return notFound("Agent not found");
  return NextResponse.json(serializeAgent(agent));
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const parsed = agentUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const data = parsed.data;

  const { ai_api_key, system_prompt, ai_provider, ai_model, is_active, ...rest } = data;

  try {
    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...rest,
        ...(system_prompt !== undefined ? { systemPrompt: system_prompt } : {}),
        ...(ai_provider !== undefined ? { aiProvider: ai_provider } : {}),
        ...(ai_model !== undefined ? { aiModel: ai_model } : {}),
        ...(is_active !== undefined ? { isActive: is_active } : {}),
        ...(ai_api_key !== undefined ? { aiApiKeyEncrypted: encryptSecret(ai_api_key) } : {}),
      },
      include: { credential: true },
    });
    return NextResponse.json(serializeAgent(agent));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return notFound("Agent not found");
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    await prisma.agent.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return notFound("Agent not found");
    }
    throw err;
  }
}
