import uuid
import pandas as pd
from io import BytesIO
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import RawCostRecord, CostGroupMapping


class DataService:

    async def _auto_build_mappings(self, db: AsyncSession):
        from sqlalchemy import distinct
        result = await db.execute(select(distinct(RawCostRecord.cost_group)))
        cost_groups = [r[0] for r in result.all() if r[0]]
        result = await db.execute(select(CostGroupMapping.cost_group_value))
        existing = set(r[0] for r in result.all())
        default_map = {
            "parts": "零部件成本", "spare": "零部件成本",
            "crane": "吊车成本", "freight": "运输费用", "transport": "运输费用",
            "labour": "人力成本", "labor": "人力成本", "tools": "工具费用",
            "other": "其他费用",
        }
        for cg in cost_groups:
            if cg in existing:
                continue
            bc = "其他费用"
            for key, val in default_map.items():
                if key in cg.lower():
                    bc = val
                    break
            db.add(CostGroupMapping(cost_group_value=cg, business_cost_category=bc, is_user_defined=0))
        await db.flush()

    async def upload_csv(self, db: AsyncSession, file_bytes: bytes, filename: str) -> dict:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(BytesIO(file_bytes))
        else:
            df = pd.read_csv(BytesIO(file_bytes))

        df.columns = df.columns.str.strip()
        column_mapping = {
            "Platform": "platform",
            "SiteFunctionalLocation": "site_functional_location",
            "Component": "component",
            "SiteName": "site_name",
            "CostGroup": "cost_group",
            "CostTypeDescription": "cost_type_description",
            "CostPerUnit": "cost_per_unit",
            "Currency": "currency",
            "ExchangeRateEUR": "exchange_rate_eur",
            "TransferPriceEURNetInclClaimSum": "transfer_price_eur_net_incl_claim_sum",
            "QuantityCalcSum": "quantity_calc_sum",
            "FailureEvents": "failure_events",
            "TransferPriceEURSum": "transfer_price_eur_sum",
            "TransferPriceEURClaimSum": "transfer_price_eur_claim_sum",
        }
        df.rename(columns=column_mapping, inplace=True)

        batch_id = str(uuid.uuid4())[:8]
        await db.execute(text("DELETE FROM raw_cost_records"))

        for _, row in df.iterrows():
            record = RawCostRecord(
                upload_batch_id=batch_id,
                platform=str(row.get("platform")) if pd.notna(row.get("platform")) else None,
                site_functional_location=str(row.get("site_functional_location")) if pd.notna(row.get("site_functional_location")) else None,
                component=str(row.get("component")) if pd.notna(row.get("component")) else None,
                site_name=str(row.get("site_name")) if pd.notna(row.get("site_name")) else "",
                cost_group=str(row.get("cost_group")) if pd.notna(row.get("cost_group")) else "",
                cost_type_description=str(row.get("cost_type_description")) if pd.notna(row.get("cost_type_description")) else None,
                cost_per_unit=float(row["cost_per_unit"]) if pd.notna(row.get("cost_per_unit")) else None,
                currency=str(row.get("currency")) if pd.notna(row.get("currency")) else None,
                exchange_rate_eur=float(row["exchange_rate_eur"]) if pd.notna(row.get("exchange_rate_eur")) else None,
                transfer_price_eur_net_incl_claim_sum=float(row["transfer_price_eur_net_incl_claim_sum"]) if pd.notna(row.get("transfer_price_eur_net_incl_claim_sum")) else None,
                quantity_calc_sum=float(row["quantity_calc_sum"]) if pd.notna(row.get("quantity_calc_sum")) else None,
                failure_events=int(row["failure_events"]) if pd.notna(row.get("failure_events")) else None,
                transfer_price_eur_sum=float(row["transfer_price_eur_sum"]) if pd.notna(row.get("transfer_price_eur_sum")) else None,
                transfer_price_eur_claim_sum=float(row["transfer_price_eur_claim_sum"]) if pd.notna(row.get("transfer_price_eur_claim_sum")) else None,
            )
            db.add(record)

        await db.commit()
        await self._auto_build_mappings(db)
        return {"batch_id": batch_id, "row_count": len(df)}

    async def get_records(
        self, db: AsyncSession, page: int = 1, page_size: int = 100,
        cost_group: str = None, platform: str = None, component: str = None, site_name: str = None
    ) -> dict:
        query = select(RawCostRecord)
        count_query = select(func.count(RawCostRecord.id))

        if cost_group:
            query = query.where(RawCostRecord.cost_group == cost_group)
            count_query = count_query.where(RawCostRecord.cost_group == cost_group)
        if platform:
            query = query.where(RawCostRecord.platform == platform)
            count_query = count_query.where(RawCostRecord.platform == platform)
        if component:
            query = query.where(RawCostRecord.component == component)
            count_query = count_query.where(RawCostRecord.component == component)
        if site_name:
            query = query.where(RawCostRecord.site_name == site_name)
            count_query = count_query.where(RawCostRecord.site_name == site_name)

        total_result = await db.execute(count_query)
        total = total_result.scalar()

        offset = (page - 1) * page_size
        query = query.order_by(RawCostRecord.id).offset(offset).limit(page_size)
        result = await db.execute(query)
        records = result.scalars().all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records,
        }

    async def get_summary(self, db: AsyncSession) -> dict:
        result = await db.execute(select(func.count(RawCostRecord.id)))
        total_rows = result.scalar()

        def _group_result(rows, key_col, cnt_col):
            result_list = []
            for row in rows:
                result_list.append({"value": getattr(row, key_col), "count": getattr(row, cnt_col)})
            return result_list

        cost_groups_result = await db.execute(
            select(RawCostRecord.cost_group, func.count(RawCostRecord.id).label("cnt"))
            .group_by(RawCostRecord.cost_group).order_by(func.count(RawCostRecord.id).desc())
        )
        cost_groups = _group_result(cost_groups_result.all(), "cost_group", "cnt")

        currencies_result = await db.execute(
            select(RawCostRecord.currency, func.count(RawCostRecord.id).label("cnt"))
            .group_by(RawCostRecord.currency).order_by(func.count(RawCostRecord.id).desc())
        )
        currencies = _group_result(currencies_result.all(), "currency", "cnt")

        site_names_result = await db.execute(
            select(RawCostRecord.site_name, func.count(RawCostRecord.id).label("cnt"))
            .group_by(RawCostRecord.site_name).order_by(func.count(RawCostRecord.id).desc())
        )
        site_names = _group_result(site_names_result.all(), "site_name", "cnt")

        platforms_result = await db.execute(
            select(RawCostRecord.platform, func.count(RawCostRecord.id).label("cnt"))
            .group_by(RawCostRecord.platform).order_by(func.count(RawCostRecord.id).desc())
        )
        platforms = _group_result(platforms_result.all(), "platform", "cnt")

        components_result = await db.execute(
            select(RawCostRecord.component, func.count(RawCostRecord.id).label("cnt"))
            .group_by(RawCostRecord.component).order_by(func.count(RawCostRecord.id).desc())
        )
        components = _group_result(components_result.all(), "component", "cnt")

        upload_batch = await db.execute(
            select(RawCostRecord.upload_batch_id).limit(1)
        )
        upload_batch_id = upload_batch.scalar()

        return {
            "total_rows": total_rows,
            "cost_groups": cost_groups,
            "currencies": currencies,
            "site_names": site_names,
            "platforms": platforms,
            "components": components,
            "upload_batch_id": upload_batch_id,
        }

    async def get_mappings(self, db: AsyncSession) -> list:
        result = await db.execute(select(CostGroupMapping))
        return result.scalars().all()

    async def update_mappings(self, db: AsyncSession, mappings: list[dict]) -> list:
        for m in mappings:
            existing = await db.execute(
                select(CostGroupMapping).where(CostGroupMapping.cost_group_value == m["cost_group_value"])
            )
            existing = existing.scalar()
            if existing:
                existing.business_cost_category = m["business_cost_category"]
                existing.is_user_defined = 1
            else:
                new_mapping = CostGroupMapping(
                    cost_group_value=m["cost_group_value"],
                    business_cost_category=m["business_cost_category"],
                    is_user_defined=1,
                )
                db.add(new_mapping)
        await db.commit()
        return await self.get_mappings(db)

    async def get_historical_stats(
        self, db: AsyncSession, platform: str = None, component: str = None, country: str = None
    ) -> dict:
        query = select(RawCostRecord)
        if platform:
            query = query.where(RawCostRecord.platform == platform)
        if component:
            query = query.where(RawCostRecord.component == component)

        result = await db.execute(query)
        records = result.scalars().all()

        groups = {}
        for r in records:
            cg = r.cost_group
            if cg not in groups:
                groups[cg] = []
            eur_val = r.transfer_price_eur_net_incl_claim_sum or r.transfer_price_eur_sum or r.cost_per_unit or 0
            groups[cg].append(eur_val)

        stats = {}
        for cg, vals in groups.items():
            import statistics
            stats[cg] = {
                "count": len(vals),
                "mean": statistics.mean(vals) if vals else 0,
                "median": statistics.median(vals) if vals else 0,
                "std": statistics.stdev(vals) if len(vals) > 1 else 0,
            }

        return {
            "total_matched_records": len(records),
            "cost_group_stats": stats,
            "platform": platform,
            "component": component,
        }

    async def compute_statistical_costs(
        self, db: AsyncSession, platform: str, component: str, mappings: list
    ) -> dict:
        import statistics

        mapping_dict = {}
        for m in mappings:
            cg_val = m.cost_group_value if hasattr(m, 'cost_group_value') else m.get('cost_group_value', '')
            bc = m.business_cost_category if hasattr(m, 'business_cost_category') else m.get('business_cost_category', '')
            if cg_val and bc:
                mapping_dict[cg_val] = bc

        query = select(RawCostRecord)
        if platform:
            query = query.where(RawCostRecord.platform == platform)
        if component:
            query = query.where(RawCostRecord.component == component)
        result = await db.execute(query)
        records = result.scalars().all()

        fallback = False
        if not records:
            fallback = True
            result = await db.execute(select(RawCostRecord))
            records = result.scalars().all()

        cost_group_values = {}
        for r in records:
            cg = r.cost_group
            if cg not in cost_group_values:
                cost_group_values[cg] = []
            eur_val = r.transfer_price_eur_net_incl_claim_sum or r.transfer_price_eur_sum or r.cost_per_unit or 0
            if eur_val > 0:
                cost_group_values[cg].append(eur_val)

        category_values = {}
        category_counts = {}
        category_details = {}

        for cg, vals in cost_group_values.items():
            bc = mapping_dict.get(cg, "其他费用")
            if bc not in category_values:
                category_values[bc] = []
                category_counts[bc] = 0
                category_details[bc] = []
            median_val = statistics.median(vals) if vals else 0
            category_values[bc].append(median_val)
            category_counts[bc] += len(vals)
            category_details[bc].append({
                "cost_group": cg, "count": len(vals),
                "median": round(median_val, 2),
                "mean": round(statistics.mean(vals), 2),
            })

        items = []
        total = 0.0
        for cat in ["零部件成本", "吊车成本", "运输费用", "人力成本", "工具费用", "其他费用"]:
            if cat in category_values:
                s = round(sum(category_values[cat]), 2)
                count = category_counts[cat]
                confidence = 0.85 if count >= 10 else (0.6 if count >= 3 else 0.3)
                reasoning = f"统计计算: {'全局' if fallback else 'Platform+Component'}匹配 {count} 条。" + \
                    "; ".join([f"{d['cost_group']}(n={d['count']},中位数={d['median']})" for d in category_details[cat]])
                items.append({
                    "business_cost_category": cat, "estimated_value": s,
                    "confidence": confidence, "reasoning": reasoning,
                    "source_record_count": count,
                })
                total += s

        items.append({
            "business_cost_category": "总成本合计",
            "estimated_value": round(total, 2), "confidence": 1.0,
            "reasoning": f"统计计算: 以上各项合计",
            "source_record_count": len(records),
        })

        return {
            "items": items, "total_estimated_cost": round(total, 2),
            "fallback": fallback, "total_matched_records": len(records),
        }
