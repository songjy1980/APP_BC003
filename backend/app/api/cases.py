from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import asyncio

from app.db.database import get_db
from app.models.models import Case, CaseCostItem, Plan, PlanCostItem, Rule, CostGroupMapping
from app.schemas.schemas import CaseCreateSchema, CostReviewSchema
from app.services.data_service import DataService
from app.services.ai_service import AIInferenceService

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])
data_service = DataService()
ai_service = AIInferenceService()

BUSINESS_COST_CATEGORIES = [
    "零部件成本", "吊车成本", "运输费用", "人力成本",
    "工具费用", "其他费用", "总成本合计"
]


@router.post("")
async def create_case(case_data: CaseCreateSchema, db: AsyncSession = Depends(get_db)):
    case = Case(
        case_name=case_data.case_name,
        turbine_model=case_data.turbine_model,
        country=case_data.country,
        project_name=case_data.project_name,
        contract_type=case_data.contract_type,
        fault_description=case_data.fault_description,
        repair_duration_hours=case_data.repair_duration_hours,
        penalty_amount_eur=case_data.penalty_amount_eur,
        platform=case_data.platform,
        component=case_data.component,
        engineer_notes=case_data.engineer_notes,
        status="draft",
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return {"case_id": case.id}


@router.get("")
async def get_cases(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Case)
    if status:
        query = query.where(Case.status == status)
    query = query.order_by(Case.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{case_id}")
async def get_case(case_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")
    return case


@router.post("/{case_id}/infer")
async def infer_costs(case_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")

    historical_stats = await data_service.get_historical_stats(
        db, platform=case.platform, component=case.component
    )

    mappings_result = await db.execute(select(CostGroupMapping))
    mappings = mappings_result.scalars().all()

    rules_result = await db.execute(
        select(Rule).where(Rule.enabled == 1).order_by(Rule.priority)
    )
    rules = rules_result.scalars().all()
    rules_dicts = [
        {"scope": r.scope, "name": r.name, "description": r.description}
        for r in rules
    ]

    case_dict = {
        "turbine_model": case.turbine_model,
        "platform": case.platform,
        "component": case.component,
        "country": case.country,
        "fault_description": case.fault_description,
        "repair_duration_hours": case.repair_duration_hours,
        "penalty_amount_eur": case.penalty_amount_eur,
    }

    async def generate_sse():
        matched_count = historical_stats.get("total_matched_records", 0)
        yield f"data: {json.dumps({'type': 'progress', 'message': '正在分析历史数据...'})}\n\n"
        yield f"data: {json.dumps({'type': 'progress', 'message': f'匹配到 {matched_count} 条相似记录'})}\n\n"
        yield f"data: {json.dumps({'type': 'progress', 'message': '正在调用AI模型推断成本...'})}\n\n"

        try:
            ai_result = await ai_service.infer_case_costs(case_dict, historical_stats, mappings, rules_dicts)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'AI推理失败: {str(e)}'})}\n\n"
            return

        await db.execute(
            select(CaseCostItem).where(CaseCostItem.case_id == case_id)
        )
        existing_items = (await db.execute(
            select(CaseCostItem).where(CaseCostItem.case_id == case_id)
        )).scalars().all()
        for item in existing_items:
            await db.delete(item)

        items = ai_result.get("items", [])
        for item_data in items:
            cost_item = CaseCostItem(
                case_id=case_id,
                business_cost_category=item_data.get("business_cost_category", ""),
                ai_inferred_value=item_data.get("estimated_value"),
                ai_confidence=item_data.get("confidence"),
                ai_reasoning=item_data.get("reasoning"),
                source_record_count=item_data.get("source_record_count"),
            )
            db.add(cost_item)

        case.status = "ai_filled"
        await db.commit()
        await db.refresh(case)

        yield f"data: {json.dumps({'type': 'progress', 'message': 'AI推断完成，成本数据已保存'})}\n\n"
        result_data = {
            "case_id": case_id,
            "items": items,
            "total_estimated_cost": ai_result.get("total_estimated_cost", 0),
        }
        yield f"data: {json.dumps({'type': 'result', 'data': result_data})}\n\n"

    return StreamingResponse(generate_sse(), media_type="text/event-stream")


@router.put("/{case_id}/costs")
async def review_costs(case_id: int, reviews: list[CostReviewSchema], db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")

    for review in reviews:
        items_result = await db.execute(
            select(CaseCostItem).where(
                CaseCostItem.case_id == case_id,
                CaseCostItem.business_cost_category == review.category
            )
        )
        item = items_result.scalar()
        if item:
            item.reviewed_value = review.reviewed_value
            item.is_overridden = 1
            item.override_reason = review.override_reason
    case.status = "reviewed"
    await db.commit()
    return {"status": "ok"}


@router.post("/{case_id}/plans")
async def generate_plans(case_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")

    cost_items_result = await db.execute(
        select(CaseCostItem).where(CaseCostItem.case_id == case_id)
    )
    cost_items = cost_items_result.scalars().all()
    cost_items_dicts = [
        {
            "business_cost_category": ci.business_cost_category,
            "estimated_value": ci.reviewed_value or ci.ai_inferred_value,
            "confidence": ci.ai_confidence,
        }
        for ci in cost_items
    ]

    rules_result = await db.execute(
        select(Rule).where(Rule.enabled == 1).order_by(Rule.priority)
    )
    rules = rules_result.scalars().all()
    rules_dicts = [
        {"scope": r.scope, "name": r.name, "description": r.description}
        for r in rules
    ]

    case_dict = {
        "turbine_model": case.turbine_model,
        "country": case.country,
        "component": case.component,
        "fault_description": case.fault_description,
        "repair_duration_hours": case.repair_duration_hours,
        "penalty_amount_eur": case.penalty_amount_eur,
    }

    async def generate_sse():
        yield f"data: {json.dumps({'type': 'progress', 'message': '正在生成三方案对比...'})}\n\n"

        try:
            ai_result = await ai_service.infer_plans(
                case_dict, cost_items_dicts, rules_dicts, case.engineer_notes or ""
            )
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'方案生成失败: {str(e)}'})}\n\n"
            return

        existing_plans = (await db.execute(
            select(Plan).where(Plan.case_id == case_id)
        )).scalars().all()
        for plan in existing_plans:
            await db.delete(plan)

        plans_data = ai_result.get("plans", [])
        for plan_data in plans_data:
            plan = Plan(
                case_id=case_id,
                plan_type=plan_data.get("plan_type", ""),
                plan_label=plan_data.get("plan_label", ""),
                total_cost_eur=plan_data.get("total_cost_eur"),
                total_duration_days=plan_data.get("total_duration_days"),
                comparison_rank=plan_data.get("comparison_rank"),
                ai_reasoning=plan_data.get("reasoning"),
            )
            db.add(plan)
            await db.flush()

            for item_data in plan_data.get("items", []):
                plan_item = PlanCostItem(
                    plan_id=plan.id,
                    business_cost_category=item_data.get("business_cost_category", ""),
                    estimated_value=item_data.get("estimated_value"),
                    ai_reasoning=item_data.get("reasoning"),
                )
                db.add(plan_item)

        case.status = "plans_generated"
        await db.commit()

        yield f"data: {json.dumps({'type': 'progress', 'message': '三方案生成完成'})}\n\n"
        yield f"data: {json.dumps({'type': 'result', 'data': {'case_id': case_id, 'plans': plans_data}})}\n\n"

    return StreamingResponse(generate_sse(), media_type="text/event-stream")


@router.get("/{case_id}/plans")
async def get_plans(case_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Plan).where(Plan.case_id == case_id).order_by(Plan.comparison_rank)
    )
    return result.scalars().all()


@router.delete("/{case_id}")
async def delete_case(case_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")
    await db.delete(case)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{case_id}/export")
async def export_case_csv(case_id: int, db: AsyncSession = Depends(get_db)):
    from fastapi.responses import Response
    import csv
    from io import StringIO

    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar()
    if not case:
        raise HTTPException(404, "案例不存在")

    cost_items_result = await db.execute(
        select(CaseCostItem).where(CaseCostItem.case_id == case_id)
    )
    cost_items = cost_items_result.scalars().all()

    plans_result = await db.execute(
        select(Plan).where(Plan.case_id == case_id).order_by(Plan.comparison_rank)
    )
    plans = plans_result.scalars().all()

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow(["WindOps BC Analyzer - 案例导出"])
    writer.writerow([])
    writer.writerow(["案例名称", case.case_name])
    writer.writerow(["风机型号", case.turbine_model])
    writer.writerow(["国家", case.country])
    writer.writerow(["项目名称", case.project_name])
    writer.writerow(["合同类型", case.contract_type])
    writer.writerow(["故障描述", case.fault_description])
    writer.writerow(["规定维修时长(h)", case.repair_duration_hours])
    writer.writerow(["每日罚款额(EUR)", case.penalty_amount_eur])
    writer.writerow([])

    writer.writerow(["成本项", "AI推断值(EUR)", "置信度", "审核值(EUR)", "已修改", "依据"])
    for ci in cost_items:
        writer.writerow([
            ci.business_cost_category,
            ci.ai_inferred_value,
            ci.ai_confidence,
            ci.reviewed_value,
            "是" if ci.is_overridden else "否",
            ci.ai_reasoning or "",
        ])
    writer.writerow([])

    writer.writerow(["方案类型", "方案标签", "总成本(EUR)", "总天数", "排名", "分析摘要"])
    for plan in plans:
        writer.writerow([
            plan.plan_type,
            plan.plan_label,
            plan.total_cost_eur,
            plan.total_duration_days,
            plan.comparison_rank,
            plan.ai_reasoning or "",
        ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        content="\ufeff" + csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=case_{case_id}_{case.case_name}.csv"
        },
    )
