import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.conversation import Conversation
from app.models.credential import WhatsAppCredential
from app.models.message import Message, MessageDirection, MessageStatus
from app.security import decrypt_secret, verify_meta_signature
from app.services.whatsapp import parse_webhook_payload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


async def _get_credential_or_404(agent_id: str, db: AsyncSession) -> WhatsAppCredential:
    result = await db.execute(select(WhatsAppCredential).where(WhatsAppCredential.agent_id == agent_id))
    credential = result.scalar_one_or_none()
    if credential is None:
        raise HTTPException(status_code=404, detail="No WhatsApp credential configured for this agent")
    return credential


@router.get("/{agent_id}")
async def verify_webhook(
    agent_id: str,
    db: AsyncSession = Depends(get_db),
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> PlainTextResponse:
    """Handles Meta's webhook verification handshake (GET request).

    Configure this URL (https://your-domain/webhook/{agent_id}) plus the
    agent's verify_token in the Meta App dashboard's Webhooks settings.
    """
    credential = await _get_credential_or_404(agent_id, db)

    if hub_mode == "subscribe" and hub_verify_token == credential.verify_token and hub_challenge is not None:
        return PlainTextResponse(content=hub_challenge, status_code=200)

    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/{agent_id}")
async def receive_webhook(agent_id: str, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Receives inbound messages and status updates from the WhatsApp Cloud API."""
    credential = await _get_credential_or_404(agent_id, db)

    raw_body = await request.body()

    app_secret = decrypt_secret(credential.app_secret_encrypted)
    if app_secret:
        signature = request.headers.get("X-Hub-Signature-256")
        if not verify_meta_signature(app_secret, raw_body, signature):
            raise HTTPException(status_code=403, detail="Invalid webhook signature")
    else:
        logger.warning("Agent %s has no app_secret configured; skipping signature verification", agent_id)

    payload = await request.json()
    parsed = parse_webhook_payload(payload)

    for inbound in parsed.messages:
        result = await db.execute(
            select(Conversation).where(
                Conversation.agent_id == agent_id, Conversation.contact_wa_id == inbound.contact_wa_id
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            conversation = Conversation(
                agent_id=agent_id,
                contact_wa_id=inbound.contact_wa_id,
                contact_name=inbound.contact_name,
            )
            db.add(conversation)
            await db.flush()
        elif inbound.contact_name and conversation.contact_name != inbound.contact_name:
            conversation.contact_name = inbound.contact_name

        message = Message(
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            wa_message_id=inbound.wa_message_id or None,
            message_type=inbound.message_type,
            content=inbound.text,
            status=MessageStatus.RECEIVED,
            raw_payload=inbound.raw,
        )
        db.add(message)
        conversation.last_message_at = datetime.now(timezone.utc)

    for status_update in parsed.statuses:
        result = await db.execute(
            select(Message).where(Message.wa_message_id == status_update.wa_message_id)
        )
        message = result.scalar_one_or_none()
        if message is not None and status_update.status in MessageStatus._value2member_map_:
            message.status = MessageStatus(status_update.status)

    await db.commit()

    # Meta expects a fast 200 response regardless of what we did with the payload.
    return {"status": "ok", "messages_received": len(parsed.messages), "statuses_received": len(parsed.statuses)}
