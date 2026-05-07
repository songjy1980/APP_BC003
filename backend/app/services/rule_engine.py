import json
import math
from datetime import datetime
from typing import Optional


class RuleEngine:
    def __init__(self, rules: list):
        self.rules = rules

    def compute_plan(
        self,
        plan_def: dict,
        base_costs: list[dict],
        country: str,
        component: str,
        penalty_per_day: float,
        repair_hours: int,
    ) -> dict:
        source = plan_def["source"]
        transport = plan_def["transport"]

        costs = {}
        for ci in base_costs:
            costs[ci["business_cost_category"]] = ci.get("estimated_value", 0) or 0

        parts_base = costs.get("零部件成本", 0)
        disabled = False
        disabled_reason = ""

        applicable = self._match_rules(source, transport, country, component)

        parts_mult = 1.0
        overhead_rate = 0.0
        freight_rate = 0.0
        freight_mult = 1.0
        base_days = 0
        typhoon_buffer = 0
        penalty_weight = 1.0

        for rule in applicable:
            rule_type = rule.get("rule_type", "multiply")
            rule_val = rule.get("rule_value", 1.0)
            cond = self._parse_cond(rule.get("condition_json"))
            dim = cond.get("dimension", "")
            cat = rule.get("cost_category", "")

            if dim == "disable" or (cond.get("action") == "disable"):
                if cond.get("component") and cond["component"] in component:
                    if cond.get("transport") and cond["transport"] == transport:
                        disabled = True
                        disabled_reason = f"规则: {rule.get('name', '')}"
                        continue

            if rule_type == "cap" and cond.get("action") == "disable":
                if cond.get("component") and cond["component"] in component:
                    if cond.get("transport") and cond["transport"] == transport:
                        disabled = True
                        disabled_reason = f"规则: {rule.get('name', '')}"

            if cat == "零部件成本" and dim == "parts_base":
                if rule_type == "multiply":
                    parts_mult *= rule_val

            elif cat == "管理费":
                if rule_type == "multiply":
                    overhead_rate = rule_val

            elif cat == "运输费用" and dim == "freight_rate":
                if rule_type == "multiply":
                    freight_rate += rule_val

            elif cat == "运输费用" and dim == "freight_multiplier":
                if rule_type == "multiply":
                    freight_mult = rule_val

            elif cat == "运输天数" and dim == "base_days":
                if rule_type == "add":
                    base_days = max(base_days, rule_val)

            elif cat == "运输天数" and dim == "typhoon_buffer":
                if rule_type == "add":
                    typhoon_buffer = max(typhoon_buffer, rule_val)

            elif cat == "罚款权重" and dim == "penalty_weight":
                if rule_type == "multiply":
                    penalty_weight *= rule_val

        adjusted_parts = round(parts_base * parts_mult, 2)
        overhead = round(adjusted_parts * overhead_rate, 2)

        if transport == "air":
            sea_rules = self._match_rules(source, "sea", country, component)
            sea_freight_rate = 0.0
            for rule in sea_rules:
                cond = self._parse_cond(rule.get("condition_json"))
                if rule.get("cost_category") == "运输费用" and cond.get("dimension") == "freight_rate":
                    sea_freight_rate += rule.get("rule_value", 0)
            if freight_rate == 0:
                freight_rate = sea_freight_rate
            freight_cost = round(adjusted_parts * freight_rate * freight_mult, 2)
        elif transport == "land" and source == "local":
            freight_cost = round(adjusted_parts * self._get_land_rate(applicable), 2)
        else:
            freight_cost = round(adjusted_parts * freight_rate, 2)

        total_days = base_days + typhoon_buffer
        repair_days = repair_hours / 24.0
        total_completion_days = total_days + repair_days
        contract_days = total_days + 14

        overdue_days = max(0, round(total_completion_days - contract_days))
        penalty = round(overdue_days * penalty_per_day * penalty_weight, 2)
        is_overtime = overdue_days > 0

        direct_cost = adjusted_parts + overhead + freight_cost + \
            (costs.get("吊车成本", 0) or 0) + (costs.get("人力成本", 0) or 0) + \
            (costs.get("工具费用", 0) or 0) + (costs.get("其他费用", 0) or 0)

        total_with_penalty = round(direct_cost + penalty, 2)

        items = [
            {"business_cost_category": "零部件成本", "cost_subtype": "采购",
             "estimated_value": adjusted_parts, "ai_reasoning": f"基准 × {parts_mult:.2f}"},
            {"business_cost_category": "管理费", "cost_subtype": "overhead",
             "estimated_value": overhead, "ai_reasoning": f"零件费 × {overhead_rate:.0%}"},
        ]

        if transport == "sea":
            items.append({"business_cost_category": "运输费用", "cost_subtype": "海运",
                          "estimated_value": freight_cost, "ai_reasoning": f"零件费 × 运费倍数"})
        elif transport == "air":
            items.append({"business_cost_category": "运输费用", "cost_subtype": "空运",
                          "estimated_value": freight_cost, "ai_reasoning": f"海运运费 × {freight_mult:.1f}"})
        elif transport == "land":
            items.append({"business_cost_category": "运输费用", "cost_subtype": "陆运",
                          "estimated_value": freight_cost, "ai_reasoning": "本地陆运"})

        for cat in ["吊车成本", "人力成本", "工具费用", "其他费用"]:
            if cat in costs:
                items.append({"business_cost_category": cat, "cost_subtype": None,
                              "estimated_value": costs[cat], "ai_reasoning": "基于用户审核值"})

        items.append({"business_cost_category": "总成本（含罚款）", "cost_subtype": None,
                      "estimated_value": total_with_penalty, "ai_reasoning": ""})

        return {
            "plan_type": plan_def["plan_type"],
            "plan_label": plan_def["plan_label"],
            "source": source,
            "transport": transport,
            "items": items,
            "total_cost_eur": direct_cost,
            "total_with_penalty_eur": total_with_penalty,
            "penalty_amount_eur": penalty,
            "total_duration_days": total_days,
            "total_completion_days": round(total_completion_days, 1),
            "is_overtime": is_overtime,
            "overdue_days": overdue_days,
            "is_feasible": not disabled,
            "infeasibility_reason": disabled_reason if disabled else "",
        }

    def compute_all_scores(self, plans: list[dict], confidence_avg: float, weights: Optional[dict] = None) -> list[dict]:
        all_costs = [p.get("total_with_penalty_eur", 0) or 0 for p in plans]
        min_c = min(all_costs) if all_costs else 1
        max_c = max(all_costs) if all_costs else 1e9
        for plan in plans:
            plan["composite_score"] = self._score_one(plan, confidence_avg, min_c, max_c, weights)
        return plans

    def _score_one(self, plan: dict, confidence_avg: float, min_cost: float, max_cost: float, weights: Optional[dict] = None) -> float:
        if weights is None:
            weights = {"total_cost": 50, "penalty_risk": 25, "confidence": 15, "stability": 10}
        rng = max_cost - min_cost if max_cost > min_cost else 1
        cost_score = 100 * (1 - (plan.get("total_with_penalty_eur", 0) - min_cost) / rng) if rng > 0 else 50
        repair_days = plan.get("total_completion_days", 0) - plan.get("total_duration_days", 0)
        buffer_days = max(0, plan.get("total_duration_days", 0) - repair_days)
        if buffer_days > 7:
            penalty_score = 100
        elif buffer_days > 3:
            penalty_score = 60
        else:
            penalty_score = 20
        conf_score = confidence_avg * 100
        stability_score = 50 if plan.get("is_feasible") else 0
        score = (cost_score * weights["total_cost"] / 100 +
                 penalty_score * weights["penalty_risk"] / 100 +
                 conf_score * weights["confidence"] / 100 +
                 stability_score * weights["stability"] / 100)
        return round(score, 1)

    def _match_rules(self, source: str, transport: str, country: str, component: str) -> list[dict]:
        matched = []
        for rule in self.rules:
            if not rule.get("enabled"):
                continue
            cond = self._parse_cond(rule.get("condition_json"))
            if not cond:
                continue

            rule_source = cond.get("source")
            rule_transport = cond.get("transport")
            rule_country = cond.get("country")
            rule_component = cond.get("component")
            rule_market = cond.get("market")

            if rule_source and rule_source != source:
                continue
            if rule_transport and rule_transport != transport:
                continue
            if rule_country and rule_country not in country:
                continue
            if rule_component and rule_component not in component:
                continue
            if rule_market:
                if rule_market == "developed" and country not in ("JP", "KR", "AU", "NZ"):
                    continue
                if rule_market == "developing" and country in ("JP", "KR", "AU", "NZ", "NC"):
                    continue

            matched.append(rule)
        return sorted(matched, key=lambda r: -(r.get("priority") or 0))

    def _parse_cond(self, cond_json) -> dict:
        if not cond_json:
            return {}
        if isinstance(cond_json, dict):
            return cond_json
        try:
            return json.loads(cond_json) if isinstance(cond_json, str) else cond_json
        except (json.JSONDecodeError, TypeError):
            return {}

    def _get_land_rate(self, applicable: list) -> float:
        for r in applicable:
            cond = self._parse_cond(r.get("condition_json"))
            if cond.get("dimension") == "freight_rate" and cond.get("transport") == "land":
                return r.get("rule_value", 0.03)
        return 0.03
