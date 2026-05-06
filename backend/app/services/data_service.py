import uuid
import pandas as pd
from io import BytesIO
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import RawCostRecord, CostGroupMapping


class DataService:

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
