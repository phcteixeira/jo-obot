import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.security import new_id


class AIProvider(str, enum.Enum):
    NONE = "none"
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


class Agent(Base):
    """An AI agent that answers WhatsApp messages for one WhatsApp Business number."""

    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="You are a helpful assistant answering WhatsApp messages.",
    )

    ai_provider: Mapped[AIProvider] = mapped_column(
        Enum(AIProvider, name="ai_provider"), nullable=False, default=AIProvider.NONE
    )
    ai_model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Optional per-agent override of the provider API key. When empty, the
    # server-wide provider key (if any) is used instead.
    ai_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    credential: Mapped["WhatsAppCredential | None"] = relationship(
        back_populates="agent", uselist=False, cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
