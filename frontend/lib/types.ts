export type AIProvider = "none" | "anthropic" | "openai";

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  ai_provider: AIProvider;
  ai_model: string | null;
  is_active: boolean;
  has_ai_api_key: boolean;
  has_whatsapp_credential: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentInput {
  name: string;
  description?: string | null;
  system_prompt?: string;
  ai_provider?: AIProvider;
  ai_model?: string | null;
  ai_api_key?: string | null;
  is_active?: boolean;
}

export interface Credential {
  id: string;
  agent_id: string;
  phone_number_id: string;
  waba_id: string | null;
  display_phone_number: string | null;
  access_token_masked: string | null;
  has_app_secret: boolean;
  verify_token: string;
  api_version: string;
  created_at: string;
  updated_at: string;
}

export interface CredentialInput {
  phone_number_id: string;
  waba_id?: string | null;
  display_phone_number?: string | null;
  access_token: string;
  app_secret?: string | null;
  verify_token: string;
  api_version?: string;
}

export type MessageDirection = "inbound" | "outbound";
export type MessageStatus = "received" | "sent" | "delivered" | "read" | "failed";

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  wa_message_id: string | null;
  message_type: string;
  content: string;
  status: MessageStatus;
  created_at: string;
}

export interface Conversation {
  id: string;
  agent_id: string;
  contact_wa_id: string;
  contact_name: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
