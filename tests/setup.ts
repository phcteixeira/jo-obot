// Runs once per test file, before its imports are evaluated, so env vars
// set here are visible to `@/lib/prisma` and Next's route handler modules.
process.env.DATABASE_URL ??= "postgresql://joobot:joobot@localhost:5432/joobot_test";
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.ENCRYPTION_KEY ??= "dGVzdC1lbmNyeXB0aW9uLWtleS1mb3ItdGVzdHMtb25seS4=";

import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

beforeEach(async () => {
  // Truncate in FK-safe order between tests instead of recreating the schema.
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.whatsAppCredential.deleteMany();
  await prisma.agent.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
