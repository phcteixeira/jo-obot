from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables / .env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+asyncpg://joobot:joobot@localhost:5432/joobot"
    encryption_key: str = "change-me-generate-a-fernet-key"
    cors_origins: str = "http://localhost:3000"
    meta_api_version: str = "v21.0"
    meta_graph_base_url: str = "https://graph.facebook.com"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
