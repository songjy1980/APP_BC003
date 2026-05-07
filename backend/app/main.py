from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import init_db, async_session
from app.api.data import router as data_router
from app.api.cases import router as cases_router
from app.api.rules import router as rules_router
from app.api.ai import router as ai_router
from app.models.models import AIConfig, SiteCountryMap, Rule


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    yield


async def seed_data():
    async with async_session() as db:
        from sqlalchemy import select

        result = await db.execute(select(SiteCountryMap))
        if not result.scalar():
            countries = [
                ("AU", "AU", "澳大利亚"),
                ("ID", "ID", "印尼"),
                ("JP", "JP", "日本"),
                ("KR", "KR", "韩国"),
                ("NZ", "NZ", "新西兰"),
                ("PH", "PH", "菲律宾"),
                ("TH", "TH", "泰国"),
                ("NC", "NC", "新喀里多尼亚"),
                ("CN", "CN", "中国"),
                ("PK", "PK", "巴基斯坦"),
                ("VN", "VN", "越南"),
            ]
            for sc, cc, cn in countries:
                db.add(SiteCountryMap(site_code=sc, country_code=cc, country_name=cn))

        result = await db.execute(select(AIConfig))
        if not result.scalar():
            db.add(AIConfig(id=1))

        result = await db.execute(select(Rule))
        existing_rules = result.scalars().all()
        from app.services.rule_parser import parse_rule_html
        import os
        rule_html_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                                       "模块 6：知识与规则沉淀 — 预置规则全集（更新版）.html")
        if os.path.exists(rule_html_path):
            html_rules = parse_rule_html(rule_html_path)
            if html_rules:
                for old_rule in existing_rules:
                    await db.delete(old_rule)
                for r in html_rules:
                    db.add(Rule(
                        name=r["name"],
                        description=r["description"],
                        scope=r["scope"],
                        customer_code=r.get("customer_code"),
                        applicable_flow=r.get("applicable_flow", ""),
                        rule_type=r["rule_type"],
                        rule_value=r["rule_value"],
                        condition_json=r.get("condition_json"),
                        priority=r["priority"],
                        enabled=r["enabled"],
                    ))
                await db.flush()

        await db.commit()


app = FastAPI(
    title="WindOps BC Analyzer API",
    description="风电运维商业案例智能分析工具 - 后端API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router)
app.include_router(cases_router)
app.include_router(rules_router)
app.include_router(ai_router)


@app.get("/")
async def root():
    return {"message": "WindOps BC Analyzer API", "version": "1.0.0"}
