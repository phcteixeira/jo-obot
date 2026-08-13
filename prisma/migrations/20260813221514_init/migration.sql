-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('none', 'anthropic', 'openai');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('received', 'sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL DEFAULT 'You are a helpful assistant answering WhatsApp messages.',
    "ai_provider" "AIProvider" NOT NULL DEFAULT 'none',
    "ai_model" TEXT,
    "ai_api_key_encrypted" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_credentials" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "waba_id" TEXT,
    "display_phone_number" TEXT,
    "access_token_encrypted" TEXT NOT NULL,
    "app_secret_encrypted" TEXT,
    "verify_token" TEXT NOT NULL,
    "api_version" TEXT NOT NULL DEFAULT 'v21.0',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "contact_wa_id" TEXT NOT NULL,
    "contact_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "wa_message_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'received',
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_credentials_agent_id_key" ON "whatsapp_credentials"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_agent_id_contact_wa_id_key" ON "conversations"("agent_id", "contact_wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_wa_message_id_key" ON "messages"("wa_message_id");

-- AddForeignKey
ALTER TABLE "whatsapp_credentials" ADD CONSTRAINT "whatsapp_credentials_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
