import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.security import new_id


class MessageDirection(str, enum.Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageStatus(str, enum.Enum):
    RECEIVED = "received"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class Message(Base):
    """A single WhatsApp message, inbound or outbound, within a Conversation."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    conversation_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )

    direction: Mapped[MessageDirection] = mapped_column(
        Enum(MessageDirection, name="message_direction"), nullable=False
    )
    wa_message_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    message_type: Mapped[str] = mapped_column(String(32), nullable=False, default="text")
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus, name="message_status"), nullable=False, default=MessageStatus.RECEIVED
    )
    raw_payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
