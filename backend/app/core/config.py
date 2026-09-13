"""
Application Configuration Module.
Senior SDE Pattern: Strongly typed configuration management using Pydantic.
"""

from pathlib import Path
from typing import List, Set, Any
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings with environment variable override support."""

    PROJECT_NAME: str = "PSI - AI Document & Multimedia Q&A"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security & Auth
    SECRET_KEY: str = "supersecretkey_change_in_production_psi_ai_2026_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Storage & Uploads
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MAX_FILE_SIZE_MB: int = 100
    ALLOWED_EXTENSIONS: Set[str] = {"pdf", "mp3", "wav", "m4a", "mp4", "webm", "mov", "txt", "md"}
    
    # LLM & AI Services
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # Database (MongoDB / SQLite)
    DATABASE_URL: str = "sqlite:///./psi.db"
    MONGODB_URL: str = ""
    MONGODB_DB_NAME: str = "psi_db"
    
    # Redis & Caching
    REDIS_URL: str = "redis://127.0.0.1:6379/0"
    CACHE_TTL_SECONDS: int = 300
    
    # Rate Limiting (requests per minute)
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # CORS — production origins should be set via CORS_ORIGINS env var
    CORS_ORIGINS: Any = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v or v == "*":
                return ["*"]
            if v.startswith("[") and v.endswith("]"):
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if item]
                except Exception:
                    pass
            return [origin.strip() for origin in v.replace("\n", ",").split(",") if origin.strip()]
        elif isinstance(v, (list, tuple, set)):
            return [str(origin).strip() for origin in v if origin]
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()

# Ensure required runtime directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
