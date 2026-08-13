from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentOut, AgentUpdate
from app.security import encrypt_secret

router = APIRouter(prefix="/agents", tags=["agents"])


def _to_out(agent: Agent, has_credential: bool | None = None) -> AgentOut:
    return AgentOut(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        system_prompt=agent.system_prompt,
        ai_provider=agent.ai_provider,
        ai_model=agent.ai_model,
        is_active=agent.is_active,
        has_ai_api_key=bool(agent.ai_api_key_encrypted),
        has_whatsapp_credential=agent.credential is not None if has_credential is None else has_credential,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
    )


async def _get_agent_or_404(agent_id: str, db: AsyncSession) -> Agent:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id).options(selectinload(Agent.credential))
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("", response_model=list[AgentOut])
async def list_agents(db: AsyncSession = Depends(get_db)) -> list[AgentOut]:
    result = await db.execute(select(Agent).options(selectinload(Agent.credential)).order_by(Agent.created_at))
    return [_to_out(a) for a in result.scalars().all()]


@router.post("", response_model=AgentOut, status_code=201)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)) -> AgentOut:
    agent = Agent(
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        ai_provider=payload.ai_provider,
        ai_model=payload.ai_model,
        ai_api_key_encrypted=encrypt_secret(payload.ai_api_key),
        is_active=payload.is_active,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    # A brand new agent can never already have a WhatsApp credential attached.
    return _to_out(agent, has_credential=False)


@router.get("/{agent_id}", response_model=AgentOut)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)) -> AgentOut:
    agent = await _get_agent_or_404(agent_id, db)
    return _to_out(agent)


@router.patch("/{agent_id}", response_model=AgentOut)
async def update_agent(agent_id: str, payload: AgentUpdate, db: AsyncSession = Depends(get_db)) -> AgentOut:
    agent = await _get_agent_or_404(agent_id, db)

    data = payload.model_dump(exclude_unset=True)
    if "ai_api_key" in data:
        agent.ai_api_key_encrypted = encrypt_secret(data.pop("ai_api_key"))
    for field, value in data.items():
        setattr(agent, field, value)

    await db.commit()
    # Only refresh the server-generated column; `credential` is already loaded
    # via selectinload above and refreshing a relationship attribute here would
    # trigger an unsafe lazy-load outside of the session's async context.
    await db.refresh(agent, attribute_names=["updated_at"])
    return _to_out(agent)


@router.delete("/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)) -> None:
    agent = await _get_agent_or_404(agent_id, db)
    await db.delete(agent)
    await db.commit()
