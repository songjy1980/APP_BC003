import re
import json
from typing import Optional


TYPE_MAP = {
    "倍数": "multiply",
    "加值": "add",
    "上限": "cap",
    "下限": "floor",
    "统计策略": "statistics",
    "检测规则": "detection",
    "标记规则": "marker",
}

REGION_EAST_ASIA = ["日本", "韩国", "JP", "KR"]
REGION_SE_ASIA = ["泰国", "越南", "菲律宾", "印尼", "TH", "VN", "PH", "ID"]
REGION_OCEANIA = ["澳大利亚", "新西兰", "AU", "NZ"]
REGION_SOUTH_ASIA = ["巴基斯坦", "PK"]

SOURCE_DENMARK = "denmark"
SOURCE_CHINA = "china"
SOURCE_LOCAL = "local"


def _infer_parts_condition(name: str, description: str) -> tuple[str, str]:
    cond = {}
    if "丹麦" in name:
        cond["source"] = SOURCE_DENMARK
    elif "中国" in name:
        cond["source"] = SOURCE_CHINA
    elif "本地" in name or "当地" in name:
        cond["source"] = SOURCE_LOCAL
    if "发达" in name:
        cond["market"] = "developed"
    if "发展中" in name:
        cond["market"] = "developing"
    if "新喀里多尼亚" in name or "NC" in name:
        cond["country"] = "NC"
    cond["dimension"] = "parts_base"
    return "零部件成本", json.dumps(cond, ensure_ascii=False) if cond else None


def _infer_cost_category_and_condition(name: str, description: str, rule_type: str, applicable_flow: str) -> tuple[str, Optional[str]]:
    combined = name + " " + description

    if "管理费" in name:
        if "丹麦" in name:
            return "管理费", json.dumps({"source": SOURCE_DENMARK, "dimension": "overhead"}, ensure_ascii=False)
        if "中国" in name:
            return "管理费", json.dumps({"source": SOURCE_CHINA, "dimension": "overhead"}, ensure_ascii=False)
        if "本地" in name:
            return "管理费", json.dumps({"source": SOURCE_LOCAL, "dimension": "overhead"}, ensure_ascii=False)
        return "管理费", json.dumps({"dimension": "overhead"}, ensure_ascii=False)

    if "采购基准" in name or ("采购" in name and "成本" in name and "运输" not in combined.lower()):
        return _infer_parts_condition(name, description)

    if "采购溢价" in name or "采购折价" in name or "远程溢价" in name:
        return _infer_parts_condition(name, description)

    if "空运" in name and "倍数" in name:
        return "运输费用", json.dumps({"transport": "air", "dimension": "freight_multiplier"}, ensure_ascii=False)

    if "叶片空运不可行" in name:
        return "运输费用", json.dumps({"transport": "air", "component": "Blade", "action": "disable"}, ensure_ascii=False)

    transport_match = re.search(r'(丹麦|中国|本地)→(.+?)(海运|陆运|空运|运输)', name)
    if not transport_match:
        transport_match = re.search(r'(丹麦|中国|本地).*(海运|陆运|空运)', name)
    if transport_match or ("海运" in name or "陆运" in name or "空运" in name) and ("→" in name or "成本" in name):
        cond = {}
        if "丹麦" in name:
            cond["source"] = SOURCE_DENMARK
        elif "中国" in name:
            cond["source"] = SOURCE_CHINA
        elif "本地" in name:
            cond["source"] = SOURCE_LOCAL

        if "海运" in name:
            cond["transport"] = "sea"
        elif "空运" in name:
            cond["transport"] = "air"
        elif "陆运" in name:
            cond["transport"] = "land"

        for region_name, region_tag in [("东亚", "east_asia"), ("东南亚", "southeast_asia"),
                                          ("大洋洲", "oceania"), ("巴基斯坦", "south_asia"),
                                          ("新喀里多尼亚", "nc")]:
            if region_name in name:
                cond["target_region"] = region_tag
                break

        cond["dimension"] = "freight_rate"
        return "运输费用", json.dumps(cond, ensure_ascii=False) if cond else None

    if "基础天数" in name and "海运" in name:
        cond = {"transport": "sea", "dimension": "base_days"}
        if "丹麦" in name:
            cond["source"] = SOURCE_DENMARK
        elif "中国" in name:
            cond["source"] = SOURCE_CHINA
        return "运输天数", json.dumps(cond, ensure_ascii=False)

    if "基础天数" in name and "空运" in name:
        cond = {"transport": "air", "dimension": "base_days"}
        if "丹麦" in name:
            cond["source"] = SOURCE_DENMARK
        elif "中国" in name:
            cond["source"] = SOURCE_CHINA
        return "运输天数", json.dumps(cond, ensure_ascii=False)

    if "基础天数" in name and "陆运" in name:
        return "运输天数", json.dumps({"transport": "land", "dimension": "base_days"}, ensure_ascii=False)

    if "时效敏感" in name or "时效敏感度" in name:
        cond = {"dimension": "penalty_weight"}
        country_hints = REGION_EAST_ASIA + REGION_SE_ASIA + REGION_OCEANIA + REGION_SOUTH_ASIA + \
            ["新喀里多尼亚", "NC", "中国", "CN", "澳新", "澳大利亚", "新西兰", "印度尼西亚", "印尼"]
        for country_tag in country_hints:
            if country_tag in name:
                if country_tag == "澳新":
                    cond["country"] = "AU/NZ"
                elif country_tag == "印度尼西亚":
                    cond["country"] = "ID"
                else:
                    cond["country"] = country_tag
                break
        return "罚款权重", json.dumps(cond, ensure_ascii=False)

    if "台风" in name and ("海运" in name or "Buffer" in name):
        cond = {"dimension": "typhoon_buffer"}
        if "峰值" in name or "峰值期" in name:
            cond["season"] = "peak"
        elif "肩峰" in name or "肩峰期" in name:
            cond["season"] = "shoulder"
        elif "低谷" in name or "低谷期" in name:
            cond["season"] = "off"
        if "空运" in name:
            cond["transport"] = "air"
        else:
            cond["transport"] = "sea"
        return "运输天数", json.dumps(cond, ensure_ascii=False)

    if "台风" in name and "间接" in name:
        cond = {"dimension": "typhoon_buffer", "season": "peak", "transport": "sea", "scope": "indirect"}
        return "运输天数", json.dumps(cond, ensure_ascii=False)

    if "台风直接受影响" in name:
        return "运输天数", json.dumps({"dimension": "typhoon_zones", "type": "direct"}, ensure_ascii=False)

    if "样例量阈值" in name or "异常值检测" in name or "中位数" in name or "等权" in name or "默认丹麦" in name or "运输成本异常" in name:
        return "历史数据处理", None

    return "其他费用", None


def _clean_tags(text: str) -> str:
    return re.sub(r'<[^>]+>', '', text).strip()


def _extract_value(raw: str) -> tuple[float, Optional[str]]:
    numbers = re.findall(r'[\d.]+', raw)
    if not numbers:
        return 1.0, raw or None
    val = float(numbers[0])
    condition = raw if len(numbers) > 1 or "天" in raw or "→" in raw else None
    return val, condition


def parse_rule_html(filepath: str) -> list[dict]:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    rules = []

    table_re = re.compile(r'<table>(.*?)</table>', re.DOTALL)
    row_re = re.compile(r'<tr>(.*?)</tr>', re.DOTALL)
    cell_re = re.compile(r'<t[dh][^>]*>(.*?)</t[dh]>', re.DOTALL)

    for table_match in table_re.finditer(content):
        table_html = table_match.group(1)
        rows = row_re.findall(table_html)
        header_texts = []
        for row in rows:
            cells = [_clean_tags(c) for c in cell_re.findall(row)]
            if not cells:
                continue
            if "规则名称" in cells[0] or set(["规则名称"]) & set(cells):
                header_texts = cells
                continue
            if len(cells) < 5 or header_texts == []:
                continue
            if "组" in cells[0] and "规则数" in cells[1]:
                continue

            col_map = {}
            for i, h in enumerate(header_texts):
                if "规则名称" in h:
                    col_map["name"] = i
                elif "范围" in h and len(h) <= 4:
                    col_map["scope"] = i
                elif "客户代码" in h:
                    col_map["customer_code"] = i
                elif "描述" in h:
                    col_map["description"] = i
                elif "类型" in h and len(h) <= 4:
                    col_map["rule_type"] = i
                elif "值" in h and len(h) <= 4:
                    col_map["value"] = i
                elif "优先级" in h:
                    col_map["priority"] = i
                elif "适用流程" in h:
                    col_map["applicable_flow"] = i

            def get_cell(key: str) -> str:
                idx = col_map.get(key)
                if idx is not None and idx < len(cells):
                    return cells[idx]
                return ""

            name = get_cell("name")
            if not name or name == "规则名称":
                continue

            scope_cn = get_cell("scope")
            scope = "global" if "全局" in scope_cn else "customer"

            customer_code = get_cell("customer_code")
            if customer_code in ("—", "-", ""):
                customer_code = ""

            description = get_cell("description")

            cn_type = get_cell("rule_type")
            rule_type = TYPE_MAP.get(cn_type, "multiply")

            raw_value = get_cell("value")
            rule_value, legacy_condition = _extract_value(raw_value)

            try:
                priority = int(get_cell("priority"))
            except ValueError:
                priority = 5

            applicable_flow = get_cell("applicable_flow")
            if "创建" in applicable_flow:
                applicable_flow = "create_case"
            elif "生成" in applicable_flow or "方案" in applicable_flow:
                applicable_flow = "generate_plan"
            else:
                applicable_flow = ""

            cost_category, condition_json = _infer_cost_category_and_condition(
                name, description, rule_type, applicable_flow
            )
            if condition_json is None:
                condition_json = legacy_condition

            rules.append({
                "name": name,
                "scope": scope,
                "customer_code": customer_code or None,
                "description": description,
                "cost_category": cost_category,
                "applicable_flow": applicable_flow,
                "rule_type": rule_type,
                "rule_value": rule_value,
                "condition_json": condition_json,
                "priority": priority,
                "enabled": 1,
            })

    return rules
