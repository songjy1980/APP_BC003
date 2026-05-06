from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import AIConfig
from app.schemas.schemas import AIConfigUpdateSchema
from app.services.ai_service import AIInferenceService

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])
ai_service = AIInferenceService()


@router.get("/config")
async def get_ai_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig))
    config = result.scalar()
    if not config:
        config = AIConfig(id=1)
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


@router.put("/config")
async def update_ai_config(config_data: AIConfigUpdateSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AIConfig))
    config = result.scalar()
    if not config:
        config = AIConfig(id=1)
        db.add(config)

    for field, value in config_data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/models")
async def get_models():
    try:
        models = await ai_service.get_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(503, f"无法连接Ollama: {str(e)}")


@router.post("/test")
async def test_connection():
    result = await ai_service.test_connection()
    return result
