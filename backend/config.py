from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    LLM_PROVIDER: str = "bedrock"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-southeast-1"
    BEDROCK_MODEL_ID: str = "anthropic.claude-sonnet-4-6"
    DATABASE_URL: str = "sqlite:///./sys_knowledge_hub.db"
    UPLOAD_DIR: str = "../uploads"
    CHROMA_DIR: str = "./chroma_db"
    SECRET_KEY: str = "change-me"
    AIST_USER: str = "153585"
    AIST_PASSWORD: str = "pchairat1"
    GOOGLE_API_KEY: str = ""
    GOOGLE_CSE_ID: str = ""
    AD_LOGIN_URL: str = ""
    ADMIN_USERS: str = "banpotp@syssteel.com,piyawats@syssteel.com,thirayur@syssteel.com"
    CHAT_MAX_TOKENS: int = 14000
    REPORT_MAX_TOKENS: int = 30000

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
