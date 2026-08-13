import { z } from "zod";

export const aiProviderSchema = z.enum(["none", "anthropic", "openai"]);

export const agentCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1).optional(),
  ai_provider: aiProviderSchema.optional(),
  ai_model: z.string().nullable().optional(),
  ai_api_key: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const agentUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  system_prompt: z.string().min(1).optional(),
  ai_provider: aiProviderSchema.optional(),
  ai_model: z.string().nullable().optional(),
  ai_api_key: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const credentialUpsertSchema = z.object({
  phone_number_id: z.string().min(1).max(64),
  waba_id: z.string().nullable().optional(),
  display_phone_number: z.string().nullable().optional(),
  access_token: z.string().min(1),
  app_secret: z.string().nullable().optional(),
  verify_token: z.string().min(1).max(120),
  api_version: z.string().min(1).default("v21.0"),
});

export const sendMessageSchema = z.object({
  to: z.string().min(1).max(32),
  text: z.string().min(1).max(4096),
});
