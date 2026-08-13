from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.agent import AIProvider


class AgentBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str = "You are a helpful assistant answering WhatsApp messages."
    ai_provider: AIProvider = AIProvider.NONE
    ai_model: str | None = None
    is_active: bool = True


class AgentCreate(AgentBase):
    # Optional per-agent override of the provider API key (e.g. Anthropic/OpenAI key).
    ai_api_key: str | None = None


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    system_prompt: str | None = None
    ai_provider: AIProvider | None = None
    ai_model: str | None = None
    ai_api_key: str | None = None
    is_active: bool | None = None


class AgentOut(AgentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    has_ai_api_key: bool = False
    has_whatsapp_credential: bool = False
    created_at: datetime
    updated_at: datetime
