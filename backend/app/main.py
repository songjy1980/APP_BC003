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
        if not result.scalar():
            default_rules = [
                Rule(name="日本客户时效敏感", description="日本客户对时效敏感，罚款通常较高，优先考虑空运",
                     scope="global", rule_type="multiply", rule_value=1.0, priority=10, enabled=1),
                Rule(name="Gearbox需大型吊车", description="Gearbox维修通常需要大型吊车，吊车成本占比参考历史数据均值",
                     scope="global", rule_type="multiply", rule_value=1.0, priority=9, enabled=1),
                Rule(name="海运vs空运成本差", description="海运比空运平均便宜60-80%，但运输时间增加20-35天",
                     scope="global", rule_type="multiply", rule_value=0.3, priority=8, enabled=1),
                Rule(name="数据无日期等权处理", description="数据中无日期字段，所有历史记录等权处理",
                     scope="global", rule_type="multiply", rule_value=1.0, priority=7, enabled=1),
                Rule(name="JP-Wind-Phase2罚款上限", description="合同条款严格，罚款上限为合同总额的15%",
                     scope="customer", customer_code="JP-Wind-Phase2", rule_type="cap", rule_value=0.15, priority=6, enabled=1),
                Rule(name="台风季节东南亚buffer", description="台风季节(6-10月)：东南亚地区海运时间需额外增加7-14天",
                     scope="customer", rule_type="add", rule_value=10.0, priority=5, enabled=1),
            ]
            for r in default_rules:
                db.add(r)

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
