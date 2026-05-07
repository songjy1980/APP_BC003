from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.database import get_db
from app.models.models import Rule
from app.schemas.schemas import RuleCreateSchema

router = APIRouter(prefix="/api/v1/rules", tags=["rules"])


@router.get("")
async def get_rules(
    scope: str = None,
    enabled: bool = None,
    applicable_flow: str = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Rule)
    if scope:
        query = query.where(Rule.scope == scope)
    if enabled is not None:
        query = query.where(Rule.enabled == (1 if enabled else 0))
    if applicable_flow:
        query = query.where(Rule.applicable_flow == applicable_flow)
    query = query.order_by(Rule.priority.desc(), Rule.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("")
async def create_rule(rule_data: RuleCreateSchema, db: AsyncSession = Depends(get_db)):
    rule = Rule(
        name=rule_data.name,
        description=rule_data.description,
        scope=rule_data.scope,
        customer_code=rule_data.customer_code,
        cost_category=rule_data.cost_category,
        applicable_flow=rule_data.applicable_flow or "",
        rule_type=rule_data.rule_type,
        rule_value=rule_data.rule_value,
        condition_json=rule_data.condition_json,
        priority=rule_data.priority,
        enabled=rule_data.enabled,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/{rule_id}")
async def update_rule(rule_id: int, rule_data: RuleCreateSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar()
    if not rule:
        raise HTTPException(404, "规则不存在")

    for field, value in rule_data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.updated_at = datetime.now().isoformat()
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar()
    if not rule:
        raise HTTPException(404, "规则不存在")
    await db.delete(rule)
    await db.commit()
    return {"status": "deleted"}
