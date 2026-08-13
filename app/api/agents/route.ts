import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeAgent } from "@/lib/serializers";
import { encryptSecret } from "@/lib/security";
import { agentCreateSchema } from "@/lib/validation";
import { badRequest } from "@/lib/http";

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: { credential: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(agents.map((a) => serializeAgent(a)));
}

export async function POST(request: NextRequest) {
  const parsed = agentCreateSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const data = parsed.data;

  const agent = await prisma.agent.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      ...(data.system_prompt ? { systemPrompt: data.system_prompt } : {}),
      ...(data.ai_provider ? { aiProvider: data.ai_provider } : {}),
      aiModel: data.ai_model ?? null,
      aiApiKeyEncrypted: encryptSecret(data.ai_api_key),
      ...(data.is_active !== undefined ? { isActive: data.is_active } : {}),
    },
  });

  // A brand new agent can never already have a WhatsApp credential attached.
  return NextResponse.json(serializeAgent(agent, false), { status: 201 });
}
