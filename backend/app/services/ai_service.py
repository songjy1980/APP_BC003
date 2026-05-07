import json
import time
from typing import AsyncIterator, Optional
import httpx

from app.config import settings


class AIInferenceService:

    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.model_name
        self.temperature = settings.temperature
        self.max_tokens = settings.max_tokens
        self._client: Optional[httpx.AsyncClient] = None

    async def load_config_from_db(self, db_session):
        from sqlalchemy import select
        from app.models.models import AIConfig
        result = await db_session.execute(select(AIConfig))
        config = result.scalar()
        if config:
            self.base_url = config.ollama_base_url or settings.ollama_base_url
            self.model = config.model_name or settings.model_name
            self.temperature = config.temperature if config.temperature is not None else settings.temperature
            self.max_tokens = config.max_tokens if config.max_tokens is not None else settings.max_tokens
            if self._client:
                self._client.base_url = self.base_url

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(settings.ollama_timeout),
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def test_connection(self) -> dict:
        start = time.time()
        try:
            client = await self._get_client()
            response = await client.get("/api/tags")
            response.raise_for_status()
            elapsed = (time.time() - start) * 1000
            return {"success": True, "response_time_ms": round(elapsed, 1)}
        except Exception as e:
            elapsed = (time.time() - start) * 1000
            return {"success": False, "response_time_ms": round(elapsed, 1), "error": str(e)}

    async def get_models(self) -> list:
        client = await self._get_client()
        response = await client.get("/api/tags")
        data = response.json()
        return [m["name"] for m in data.get("models", [])]

    async def chat_stream(self, messages: list[dict]) -> AsyncIterator[str]:
        client = await self._get_client()
        async with client.stream(
            "POST",
            "/api/chat",
            json={
                "model": self.model,
                "messages": messages,
                "stream": True,
                "options": {
                    "temperature": self.temperature,
                    "top_p": settings.top_p,
                    "num_predict": self.max_tokens,
                },
            },
        ) as response:
            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        data = json.loads(line)
                        if data.get("done"):
                            break
                        yield data["message"]["content"]
                    except (json.JSONDecodeError, KeyError):
                        continue

    async def chat(self, messages: list[dict]) -> str:
        client = await self._get_client()
        response = await client.post(
            "/api/chat",
            json={
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": self.temperature,
                    "top_p": settings.top_p,
                    "num_predict": self.max_tokens,
                },
            },
        )
        data = response.json()
        return data["message"]["content"]

    def build_cost_group_mapping_prompt(self, cost_groups: list[dict]) -> list[dict]:
        cost_group_list = "\n".join([
            f"- {cg['value']} (出现{cg['count']}次)" for cg in cost_groups
        ])
        system_prompt = """你是风电运维成本分析专家。请根据提供的CostGroup列表，将每个CostGroup映射到以下7类业务成本之一：
1. 零部件成本 (Parts)
2. 吊车成本 (Crane)
3. 运输费用 (Freight/Transport)
4. 人力成本 (Labour/Labor)
5. 工具费用 (Tools)
6. 其他费用 (Other)
7. 总成本合计 (Total)

请输出严格的JSON格式，只输出JSON不要有其他内容。"""
        user_prompt = f"""请将以下CostGroup映射到7类业务成本：

{cost_group_list}

输出格式：
{{"mappings": [{{"cost_group": "xxx", "business_cost_category": "零部件成本"}}, ...]}}
请确保每个CostGroup都有对应的映射。"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def build_case_inference_prompt(
        self, case_data: dict, historical_stats: dict, mappings: list[dict], rules: list[dict]
    ) -> list[dict]:
        stats_json = json.dumps(historical_stats.get("cost_group_stats", {}), ensure_ascii=False, indent=2)
        mappings_json = json.dumps([{"cost_group": m.cost_group_value if hasattr(m, 'cost_group_value') else m.get('cost_group_value', ''),
                                       "business_category": m.business_cost_category if hasattr(m, 'business_cost_category') else m.get('business_cost_category', '')}
                                      for m in mappings], ensure_ascii=False, indent=2)
        rules_text = "\n".join([
            f"- [{r.get('scope', 'global')}] {r.get('name', '')}: {r.get('description', '')}"
            for r in rules
        ]) if rules else "无"

        system_prompt = """你是风电运维成本估算专家。根据历史成本数据和故障描述，推断7类业务成本。
优先匹配同Platform + 同Component的历史记录，降级到全局平均。
输出严格JSON格式，只输出JSON不要有其他内容。"""

        user_prompt = f"""案例信息：
- 风机型号: {case_data.get('turbine_model', '')}
- 平台: {case_data.get('platform', '')}
- 故障部件: {case_data.get('component', '')}
- 国家: {case_data.get('country', '')}
- 故障描述: {case_data.get('fault_description', '')}
- 规定维修时长(小时): {case_data.get('repair_duration_hours', 0)}
- 每日罚款额(EUR): {case_data.get('penalty_amount_eur', 0)}

CostGroup → 业务成本映射:
{mappings_json}

匹配到的历史数据统计 (按CostGroup):
{stats_json}

活跃规则:
{rules_text}

请推断以下7类业务成本的EUR估算值，输出格式：
{{"items": [
  {{"business_cost_category": "零部件成本", "estimated_value": 12345.67, "confidence": 0.85, "reasoning": "...", "source_record_count": 87}},
  {{"business_cost_category": "吊车成本", "estimated_value": ...}},
  {{"business_cost_category": "运输费用", "estimated_value": ...}},
  {{"business_cost_category": "人力成本", "estimated_value": ...}},
  {{"business_cost_category": "工具费用", "estimated_value": ...}},
  {{"business_cost_category": "其他费用", "estimated_value": ...}},
  {{"business_cost_category": "总成本合计", "estimated_value": ..., "confidence": 0.9, "reasoning": "以上各项合计"}}
], "total_estimated_cost": 123456.78}}"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def build_plan_generation_prompt(
        self, case_data: dict, cost_items: list[dict], rules: list[dict], engineer_notes: str = ""
    ) -> list[dict]:
        cost_items_json = json.dumps(cost_items, ensure_ascii=False, indent=2)
        rules_text = "\n".join([
            f"- [{r.get('scope', 'global')}] {r.get('name', '')}: {r.get('description', '')}"
            for r in rules
        ]) if rules else "无"

        system_prompt = """你是风电运维物流方案专家。基于审核后的案例成本数据，生成三种采购/物流方案：
- 方案A：丹麦总部采购 + 海运 (denmark_sea)
- 方案B：中国采购 + 空运 (china_air)
- 方案C：当地采购 + 陆运 (local_land)

每个方案需要调整运输费用、关税、时间相关成本。输出严格JSON格式。"""

        user_prompt = f"""案例信息：
- 风机型号: {case_data.get('turbine_model', '')}
- 国家: {case_data.get('country', '')}
- 故障部件: {case_data.get('component', '')}
- 故障描述: {case_data.get('fault_description', '')}
- 规定维修时长(小时): {case_data.get('repair_duration_hours', 0)}
- 每日罚款额(EUR): {case_data.get('penalty_amount_eur', 0)}

审核后的成本项(基准):
{cost_items_json}

活跃规则:
{rules_text}

工程师补充提示词: {engineer_notes or '无'}

请生成三种方案的完整成本明细。输出格式：
{{"plans": [
  {{
    "plan_type": "denmark_sea",
    "plan_label": "方案A：丹麦总部采购 + 海运",
    "items": [
      {{"business_cost_category": "零部件成本", "estimated_value": 12345, "reasoning": "..."}},
      ...
    ],
    "total_cost_eur": 123456,
    "total_duration_days": 45,
    "comparison_rank": 2,
    "reasoning": "方案整体分析..."
  }},
  ...
]}}
请确保comparison_rank: 1为最优方案，3为最差。"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    async def infer_cost_group_mapping(self, cost_groups: list[dict]) -> dict:
        messages = self.build_cost_group_mapping_prompt(cost_groups)
        for attempt in range(settings.max_retries + 1):
            try:
                response_text = await self.chat(messages)
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    return json.loads(response_text[json_start:json_end])
            except (json.JSONDecodeError, Exception) as e:
                if attempt == settings.max_retries:
                    raise
                continue
        return {"mappings": []}

    async def infer_case_costs(
        self, case_data: dict, historical_stats: dict, mappings: list, rules: list
    ) -> dict:
        messages = self.build_case_inference_prompt(case_data, historical_stats, mappings, rules)
        for attempt in range(settings.max_retries + 1):
            try:
                response_text = await self.chat(messages)
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    return json.loads(response_text[json_start:json_end])
            except (json.JSONDecodeError, Exception):
                if attempt == settings.max_retries:
                    raise
                continue
        return {"items": [], "total_estimated_cost": 0}

    async def infer_plans(
        self, case_data: dict, cost_items: list[dict], rules: list[dict], engineer_notes: str = ""
    ) -> dict:
        messages = self.build_plan_generation_prompt(case_data, cost_items, rules, engineer_notes)
        for attempt in range(settings.max_retries + 1):
            try:
                response_text = await self.chat(messages)
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    return json.loads(response_text[json_start:json_end])
            except (json.JSONDecodeError, Exception):
                if attempt == settings.max_retries:
                    raise
                continue
        return {"plans": []}

    async def infer_plans_validate(
        self, case_data: dict, engine_plans: list[dict], rules: list[dict], engineer_notes: str = ""
    ) -> dict:
        messages = self.build_plan_validation_prompt(case_data, engine_plans, rules, engineer_notes)
        for attempt in range(settings.max_retries + 1):
            try:
                response_text = await self.chat(messages)
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    return json.loads(response_text[json_start:json_end])
            except (json.JSONDecodeError, Exception):
                if attempt == settings.max_retries:
                    raise
                continue
        return {"plans": []}

    def build_plan_validation_prompt(
        self, case_data: dict, engine_plans: list[dict], rules: list[dict], engineer_notes: str = ""
    ) -> list[dict]:
        plans_json = json.dumps([{
            "plan_label": p.get("plan_label", ""),
            "total_cost_eur": p.get("total_cost_eur"),
            "total_duration_days": p.get("total_duration_days"),
            "penalty_amount_eur": p.get("penalty_amount_eur"),
            "total_with_penalty_eur": p.get("total_with_penalty_eur"),
            "is_feasible": p.get("is_feasible"),
            "infeasibility_reason": p.get("infeasibility_reason", ""),
            "items": [{"business_cost_category": it.get("business_cost_category"),
                       "estimated_value": it.get("estimated_value")}
                      for it in p.get("items", [])],
        } for p in engine_plans], ensure_ascii=False, indent=2)

        rules_text = "\n".join([
            f"- [{r.get('scope', 'global')}] {r.get('name', '')}: {r.get('description', '')}"
            for r in rules
        ]) if rules else "无"

        system_prompt = """你是风电运维物流方案评审专家。规则引擎已经根据业务规则计算出5个方案的成本。
请做以下工作：
1. 校验各方案数值是否合理，标注异常项
2. 为每个方案的每个成本项补充自然语言推理说明
3. 对不可行方案确认原因
4. 输出仍需为严格JSON。"""

        user_prompt = f"""案例信息：
- 风机型号: {case_data.get('turbine_model', '')}
- 国家: {case_data.get('country', '')}
- 故障部件: {case_data.get('component', '')}
- 规定维修时长(小时): {case_data.get('repair_duration_hours', 0)}
- 每日罚款额(EUR): {case_data.get('penalty_amount_eur', 0)}
- 工程师补充: {engineer_notes or '无'}

规则引擎预计算结果:
{plans_json}

活跃规则:
{rules_text}

请为每个方案补充 reasoning 和 items[].reasoning 后输出。格式：
{{"plans": [{{"plan_label":"方案1","reasoning":"整体分析...","composite_score":85,"items":[{{"business_cost_category":"零部件成本","reasoning":"..."}}]}}]}}
只输出JSON。"""
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
