import type { Agent, Conversation, Message, WhatsAppCredential } from "@prisma/client";
import { decryptSecret, maskSecret } from "./security";

export function serializeAgent(agent: Agent & { credential?: unknown }, hasCredential?: boolean) {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    system_prompt: agent.systemPrompt,
    ai_provider: agent.aiProvider,
    ai_model: agent.aiModel,
    is_active: agent.isActive,
    has_ai_api_key: Boolean(agent.aiApiKeyEncrypted),
    has_whatsapp_credential: hasCredential ?? agent.credential != null,
    created_at: agent.createdAt.toISOString(),
    updated_at: agent.updatedAt.toISOString(),
  };
}

export function serializeCredential(credential: WhatsAppCredential) {
  return {
    id: credential.id,
    agent_id: credential.agentId,
    phone_number_id: credential.phoneNumberId,
    waba_id: credential.wabaId,
    display_phone_number: credential.displayPhoneNumber,
    access_token_masked: maskSecret(decryptSecret(credential.accessTokenEncrypted)),
    has_app_secret: Boolean(credential.appSecretEncrypted),
    verify_token: credential.verifyToken,
    api_version: credential.apiVersion,
    created_at: credential.createdAt.toISOString(),
    updated_at: credential.updatedAt.toISOString(),
  };
}

export function serializeMessage(message: Message) {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    direction: message.direction,
    wa_message_id: message.waMessageId,
    message_type: message.messageType,
    content: message.content,
    status: message.status,
    created_at: message.createdAt.toISOString(),
  };
}

export function serializeConversation(conversation: Conversation) {
  return {
    id: conversation.id,
    agent_id: conversation.agentId,
    contact_wa_id: conversation.contactWaId,
    contact_name: conversation.contactName,
    created_at: conversation.createdAt.toISOString(),
    last_message_at: conversation.lastMessageAt?.toISOString() ?? null,
  };
}

export function serializeConversationWithMessages(
  conversation: Conversation & { messages: Message[] }
) {
  return {
    ...serializeConversation(conversation),
    messages: conversation.messages.map(serializeMessage),
  };
}
