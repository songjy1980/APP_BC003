from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.database import Base


class RawCostRecord(Base):
    __tablename__ = "raw_cost_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    upload_batch_id = Column(String, nullable=False)
    platform = Column(String, nullable=True)
    site_functional_location = Column(String, nullable=True)
    component = Column(String, nullable=True)
    site_name = Column(String, nullable=False)
    cost_group = Column(String, nullable=False)
    cost_type_description = Column(String, nullable=True)
    cost_per_unit = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    exchange_rate_eur = Column(Float, nullable=True)
    transfer_price_eur_net_incl_claim_sum = Column(Float, nullable=True)
    quantity_calc_sum = Column(Float, nullable=True)
    failure_events = Column(Integer, nullable=True)
    transfer_price_eur_sum = Column(Float, nullable=True)
    transfer_price_eur_claim_sum = Column(Float, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())


class CostGroupMapping(Base):
    __tablename__ = "cost_group_mapping"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cost_group_value = Column(String, nullable=False, unique=True)
    business_cost_category = Column(String, nullable=False)
    is_user_defined = Column(Integer, default=0)
    updated_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_name = Column(String, nullable=False)
    turbine_model = Column(String, nullable=False)
    country = Column(String, nullable=False)
    project_name = Column(String, nullable=False)
    contract_type = Column(String, nullable=False)
    fault_description = Column(String, nullable=False)
    repair_duration_hours = Column(Float, nullable=False)
    penalty_amount_eur = Column(Float, nullable=False, default=0)
    status = Column(String, nullable=False, default="draft")
    upload_batch_id = Column(String, nullable=True)
    platform = Column(String, nullable=True)
    component = Column(String, nullable=True)
    engineer_notes = Column(Text, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    updated_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    cost_items = relationship("CaseCostItem", back_populates="case", cascade="all, delete-orphan")
    plans = relationship("Plan", back_populates="case", cascade="all, delete-orphan")


class CaseCostItem(Base):
    __tablename__ = "case_cost_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    business_cost_category = Column(String, nullable=False)
    ai_inferred_value = Column(Float, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    reviewed_value = Column(Float, nullable=True)
    is_overridden = Column(Integer, default=0)
    override_reason = Column(Text, nullable=True)
    source_record_count = Column(Integer, nullable=True)
    source_avg_cost = Column(Float, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    updated_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    case = relationship("Case", back_populates="cost_items")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    plan_type = Column(String, nullable=False)
    plan_label = Column(String, nullable=False)
    total_cost_eur = Column(Float, nullable=True)
    total_duration_days = Column(Float, nullable=True)
    comparison_rank = Column(Integer, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    case = relationship("Case", back_populates="plans")
    cost_items = relationship("PlanCostItem", back_populates="plan", cascade="all, delete-orphan")


class PlanCostItem(Base):
    __tablename__ = "plan_cost_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    plan_id = Column(Integer, ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    business_cost_category = Column(String, nullable=False)
    estimated_value = Column(Float, nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())

    plan = relationship("Plan", back_populates="cost_items")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    scope = Column(String, nullable=False, default="global")
    customer_code = Column(String, nullable=True)
    cost_category = Column(String, nullable=True)
    rule_type = Column(String, nullable=False)
    rule_value = Column(Float, nullable=False)
    condition_json = Column(Text, nullable=True)
    priority = Column(Integer, default=0)
    enabled = Column(Integer, default=1)
    created_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())
    updated_at = Column(String, nullable=False, default=lambda: datetime.now().isoformat())


class SiteCountryMap(Base):
    __tablename__ = "site_country_map"

    site_code = Column(String, primary_key=True)
    country_code = Column(String, nullable=False)
    country_name = Column(String, nullable=False)


class AIConfig(Base):
    __tablename__ = "ai_config"

    id = Column(Integer, primary_key=True)
    ollama_base_url = Column(String, nullable=False, default="http://localhost:11434")
    model_name = Column(String, nullable=False, default="qwen2.5:14b")
    temperature = Column(Float, nullable=False, default=0.3)
    top_p = Column(Float, nullable=False, default=0.9)
    max_tokens = Column(Integer, nullable=False, default=4096)
