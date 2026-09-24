from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directory resolved strictly relative to this source file, never cwd
BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # API credentials
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    
    # Simulation / Evaluation mode
    MOCK_MODE: bool = True
    
    # Interval and Latency safeguards
    CAPTURE_INTERVAL_SECONDS: int = 60
    MAX_SCREENSHOT_AGE_SECONDS: int = 30
    MAX_REQUESTS_PER_MINUTE: int = 15
    
    # Versioning
    STRATEGY_VERSION: str = "v1.0.0"
    
    # Database and directory paths relative to project root
    DATA_DIR: Path = BASE_DIR / "data"
    DATABASE_PATH: Path = BASE_DIR / "data" / "chartlab.sqlite3"
    FRONTEND_DIR: Path = BASE_DIR / "frontend"
    
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure runtime directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

