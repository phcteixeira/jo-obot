from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.message import MessageDirection, MessageStatus


class SendMessageRequest(BaseModel):
    to: str = Field(min_length=1, max_length=32, description="Recipient's WhatsApp phone number, E.164 format")
    text: str = Field(min_length=1, max_length=4096)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    direction: MessageDirection
    wa_message_id: str | None
    message_type: str
    content: str
    status: MessageStatus
    created_at: datetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    contact_wa_id: str
    contact_name: str | None
    created_at: datetime
    last_message_at: datetime | None


class ConversationWithMessagesOut(ConversationOut):
    messages: list[MessageOut] = []
