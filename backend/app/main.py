from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import agents, credentials, messages, webhook

settings = get_settings()

app = FastAPI(
    title="jo-obot API",
    description="Backend for managing AI agents that answer WhatsApp via the Meta Cloud API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(credentials.router)
app.include_router(webhook.router)
app.include_router(messages.router)


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "ok"}
