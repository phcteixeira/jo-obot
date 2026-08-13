from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.security import new_id


class Conversation(Base):
    """A conversation thread between one Agent and one WhatsApp contact."""

    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("agent_id", "contact_wa_id", name="uq_agent_contact"),)

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )

    contact_wa_id: Mapped[str] = mapped_column(String(32), nullable=False)  # contact's WhatsApp phone number
    contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    agent: Mapped["Agent"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )
