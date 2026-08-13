from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.security import new_id


class WhatsAppCredential(Base):
    """Meta WhatsApp Cloud API credentials & webhook config for one Agent."""

    __tablename__ = "whatsapp_credentials"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    agent_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("agents.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # WhatsApp Cloud API identifiers, from the Meta App / WhatsApp Business Account.
    phone_number_id: Mapped[str] = mapped_column(String(64), nullable=False)
    waba_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    display_phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Secrets, stored encrypted at rest (see app.security).
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    app_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Arbitrary string the developer sets in the Meta App dashboard; must match
    # what we return on GET /webhook/{agent_id} to verify the endpoint.
    verify_token: Mapped[str] = mapped_column(String(120), nullable=False)

    api_version: Mapped[str] = mapped_column(String(16), nullable=False, default="v21.0")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    agent: Mapped["Agent"] = relationship(back_populates="credential")
