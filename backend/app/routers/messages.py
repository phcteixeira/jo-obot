from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.credential import WhatsAppCredential
from app.models.message import Message, MessageDirection, MessageStatus
from app.schemas.message import ConversationOut, ConversationWithMessagesOut, MessageOut, SendMessageRequest
from app.services.whatsapp import WhatsAppAPIError, send_text_message

router = APIRouter(tags=["messages"])


async def _get_agent_with_credential_or_404(agent_id: str, db: AsyncSession) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.credential))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agent.credential is None:
        raise HTTPException(status_code=400, detail="Agent has no WhatsApp credential configured")
    return agent


@router.post("/agents/{agent_id}/messages/send", response_model=MessageOut, status_code=201)
async def send_message(
    agent_id: str, payload: SendMessageRequest, db: AsyncSession = Depends(get_db)
) -> MessageOut:
    agent = await _get_agent_with_credential_or_404(agent_id, db)
    credential: WhatsAppCredential = agent.credential

    try:
        response = await send_text_message(credential, payload.to, payload.text)
    except WhatsAppAPIError as exc:
        raise HTTPException(status_code=502, detail={"whatsapp_error": exc.payload}) from exc

    wa_message_id = None
    if response.get("messages"):
        wa_message_id = response["messages"][0].get("id")

    result = await db.execute(
        select(Conversation).where(Conversation.agent_id == agent_id, Conversation.contact_wa_id == payload.to)
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        conversation = Conversation(agent_id=agent_id, contact_wa_id=payload.to)
        db.add(conversation)
        await db.flush()

    message = Message(
        conversation_id=conversation.id,
        direction=MessageDirection.OUTBOUND,
        wa_message_id=wa_message_id,
        message_type="text",
        content=payload.text,
        status=MessageStatus.SENT,
    )
    db.add(message)
    conversation.last_message_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(message)
    return MessageOut.model_validate(message)


@router.get("/agents/{agent_id}/conversations", response_model=list[ConversationOut])
async def list_conversations(agent_id: str, db: AsyncSession = Depends(get_db)) -> list[ConversationOut]:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    result = await db.execute(
        select(Conversation)
        .where(Conversation.agent_id == agent_id)
        .order_by(Conversation.last_message_at.desc().nullslast())
    )
    return [ConversationOut.model_validate(c) for c in result.scalars().all()]


@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessagesOut)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)) -> ConversationWithMessagesOut:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalar_one_or_none()
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return ConversationWithMessagesOut.model_validate(conversation)
