from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent
from app.models.credential import WhatsAppCredential
from app.schemas.credential import CredentialOut, CredentialUpsert
from app.security import decrypt_secret, encrypt_secret, mask_secret

router = APIRouter(prefix="/agents/{agent_id}/credentials", tags=["credentials"])


def _to_out(credential: WhatsAppCredential) -> CredentialOut:
    return CredentialOut(
        id=credential.id,
        agent_id=credential.agent_id,
        phone_number_id=credential.phone_number_id,
        waba_id=credential.waba_id,
        display_phone_number=credential.display_phone_number,
        access_token_masked=mask_secret(decrypt_secret(credential.access_token_encrypted)),
        has_app_secret=bool(credential.app_secret_encrypted),
        verify_token=credential.verify_token,
        api_version=credential.api_version,
        created_at=credential.created_at,
        updated_at=credential.updated_at,
    )


async def _get_agent_or_404(agent_id: str, db: AsyncSession) -> Agent:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("", response_model=CredentialOut)
async def get_credential(agent_id: str, db: AsyncSession = Depends(get_db)) -> CredentialOut:
    await _get_agent_or_404(agent_id, db)
    result = await db.execute(select(WhatsAppCredential).where(WhatsAppCredential.agent_id == agent_id))
    credential = result.scalar_one_or_none()
    if credential is None:
        raise HTTPException(status_code=404, detail="No WhatsApp credential configured for this agent")
    return _to_out(credential)


@router.put("", response_model=CredentialOut)
async def upsert_credential(
    agent_id: str, payload: CredentialUpsert, db: AsyncSession = Depends(get_db)
) -> CredentialOut:
    await _get_agent_or_404(agent_id, db)

    result = await db.execute(select(WhatsAppCredential).where(WhatsAppCredential.agent_id == agent_id))
    credential = result.scalar_one_or_none()

    if credential is None:
        credential = WhatsAppCredential(agent_id=agent_id)
        db.add(credential)

    credential.phone_number_id = payload.phone_number_id
    credential.waba_id = payload.waba_id
    credential.display_phone_number = payload.display_phone_number
    credential.access_token_encrypted = encrypt_secret(payload.access_token)
    if payload.app_secret:
        credential.app_secret_encrypted = encrypt_secret(payload.app_secret)
    credential.verify_token = payload.verify_token
    credential.api_version = payload.api_version

    await db.commit()
    await db.refresh(credential)
    return _to_out(credential)


@router.delete("", status_code=204)
async def delete_credential(agent_id: str, db: AsyncSession = Depends(get_db)) -> None:
    await _get_agent_or_404(agent_id, db)
    result = await db.execute(select(WhatsAppCredential).where(WhatsAppCredential.agent_id == agent_id))
    credential = result.scalar_one_or_none()
    if credential is None:
        raise HTTPException(status_code=404, detail="No WhatsApp credential configured for this agent")
    await db.delete(credential)
    await db.commit()
