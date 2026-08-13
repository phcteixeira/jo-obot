import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeCredential } from "@/lib/serializers";
import { encryptSecret } from "@/lib/security";
import { credentialUpsertSchema } from "@/lib/validation";
import { badRequest, notFound } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id: agentId } = await params;
  const credential = await prisma.whatsAppCredential.findUnique({ where: { agentId } });
  if (!credential) return notFound("No WhatsApp credential configured for this agent");
  return NextResponse.json(serializeCredential(credential));
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id: agentId } = await params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return notFound("Agent not found");

  const parsed = credentialUpsertSchema.safeParse(await request.json());
  if (!parsed.success) return badRequest(parsed.error);
  const data = parsed.data;

  const credential = await prisma.whatsAppCredential.upsert({
    where: { agentId },
    create: {
      agentId,
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id ?? null,
      displayPhoneNumber: data.display_phone_number ?? null,
      accessTokenEncrypted: encryptSecret(data.access_token)!,
      appSecretEncrypted: encryptSecret(data.app_secret),
      verifyToken: data.verify_token,
      apiVersion: data.api_version,
    },
    update: {
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id ?? null,
      displayPhoneNumber: data.display_phone_number ?? null,
      accessTokenEncrypted: encryptSecret(data.access_token)!,
      // Keep the existing app secret when none is provided in this update.
      ...(data.app_secret ? { appSecretEncrypted: encryptSecret(data.app_secret) } : {}),
      verifyToken: data.verify_token,
      apiVersion: data.api_version,
    },
  });

  return NextResponse.json(serializeCredential(credential));
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { id: agentId } = await params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return notFound("Agent not found");

  const existing = await prisma.whatsAppCredential.findUnique({ where: { agentId } });
  if (!existing) return notFound("No WhatsApp credential configured for this agent");

  await prisma.whatsAppCredential.delete({ where: { agentId } });
  return new NextResponse(null, { status: 204 });
}
