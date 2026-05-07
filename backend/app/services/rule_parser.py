import re
from html.parser import HTMLParser
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
            rule_value, condition_json = _extract_value(raw_value)

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

            rules.append({
                "name": name,
                "scope": scope,
                "customer_code": customer_code or None,
                "description": description,
                "applicable_flow": applicable_flow,
                "rule_type": rule_type,
                "rule_value": rule_value,
                "condition_json": condition_json,
                "priority": priority,
                "enabled": 1,
            })

    return rules
