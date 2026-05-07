from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = "sqlite+aiosqlite:///./windops_bc.db"
    ollama_base_url: str = "http://localhost:11434"
    model_name: str = "qwen2.5:7b"
    temperature: float = 0.3
    top_p: float = 0.9
    max_tokens: int = 4096
    ollama_timeout: int = 120
    max_retries: int = 2


settings = Settings()
