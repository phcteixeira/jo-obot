from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CredentialUpsert(BaseModel):
    phone_number_id: str = Field(min_length=1, max_length=64)
    waba_id: str | None = None
    display_phone_number: str | None = None
    access_token: str = Field(min_length=1)
    app_secret: str | None = None
    verify_token: str = Field(min_length=1, max_length=120)
    api_version: str = "v21.0"


class CredentialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    agent_id: str
    phone_number_id: str
    waba_id: str | None
    display_phone_number: str | None
    access_token_masked: str | None = None
    has_app_secret: bool = False
    verify_token: str
    api_version: str
    created_at: datetime
    updated_at: datetime
