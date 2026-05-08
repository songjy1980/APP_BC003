from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import ScoringWeight

router = APIRouter(prefix="/api/v1/config", tags=["config"])


@router.get("/scoring")
async def get_scoring_weights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScoringWeight).order_by(ScoringWeight.id))
    weights = result.scalars().all()
    return [
        {
            "id": w.id,
            "factor_name": w.factor_name,
            "factor_label": w.factor_label,
            "weight": w.weight,
            "low_risk_buffer_days": w.low_risk_buffer_days,
            "medium_risk_buffer_days": w.medium_risk_buffer_days,
        }
        for w in weights
    ]


@router.put("/scoring")
async def update_scoring_weights(weights: list[dict], db: AsyncSession = Depends(get_db)):
    for w_data in weights:
        result = await db.execute(select(ScoringWeight).where(ScoringWeight.id == w_data.get("id")))
        w = result.scalar()
        if w:
            if "weight" in w_data:
                w.weight = w_data["weight"]
            if "low_risk_buffer_days" in w_data:
                w.low_risk_buffer_days = w_data["low_risk_buffer_days"]
            if "medium_risk_buffer_days" in w_data:
                w.medium_risk_buffer_days = w_data["medium_risk_buffer_days"]
    await db.commit()
    return {"status": "ok"}
