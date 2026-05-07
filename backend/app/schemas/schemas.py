from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class RawCostRecordSchema(BaseModel):
    id: int
    upload_batch_id: str
    platform: Optional[str] = None
    site_functional_location: Optional[str] = None
    component: Optional[str] = None
    site_name: str
    cost_group: str
    cost_type_description: Optional[str] = None
    cost_per_unit: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate_eur: Optional[float] = None
    transfer_price_eur_net_incl_claim_sum: Optional[float] = None
    quantity_calc_sum: Optional[float] = None
    failure_events: Optional[int] = None
    transfer_price_eur_sum: Optional[float] = None
    transfer_price_eur_claim_sum: Optional[float] = None
    created_at: str

    class Config:
        from_attributes = True


class DataSummarySchema(BaseModel):
    total_rows: int
    cost_groups: List[dict]
    currencies: List[dict]
    site_names: List[dict]
    platforms: List[dict]
    components: List[dict]
    upload_batch_id: Optional[str] = None


class CostGroupMappingSchema(BaseModel):
    id: int
    cost_group_value: str
    business_cost_category: str
    is_user_defined: int

    class Config:
        from_attributes = True


class CostGroupMappingUpdateSchema(BaseModel):
    cost_group_value: str
    business_cost_category: str


class CaseCreateSchema(BaseModel):
    case_name: str
    turbine_model: str
    country: str
    project_name: str
    contract_type: str
    fault_description: str
    repair_duration_hours: float
    penalty_amount_eur: float = 0
    platform: Optional[str] = None
    component: Optional[str] = None
    engineer_notes: Optional[str] = None


class CaseCostItemSchema(BaseModel):
    id: int
    case_id: int
    business_cost_category: str
    ai_inferred_value: Optional[float] = None
    ai_confidence: Optional[float] = None
    ai_reasoning: Optional[str] = None
    reviewed_value: Optional[float] = None
    is_overridden: int = 0
    override_reason: Optional[str] = None
    source_record_count: Optional[int] = None
    source_avg_cost: Optional[float] = None

    class Config:
        from_attributes = True


class CaseSchema(BaseModel):
    id: int
    case_name: str
    turbine_model: str
    country: str
    project_name: str
    contract_type: str
    fault_description: str
    repair_duration_hours: float
    penalty_amount_eur: float
    status: str
    platform: Optional[str] = None
    component: Optional[str] = None
    engineer_notes: Optional[str] = None
    cost_items: List[CaseCostItemSchema] = []
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class CaseListSchema(BaseModel):
    id: int
    case_name: str
    turbine_model: str
    country: str
    status: str
    created_at: str

    class Config:
        from_attributes = True


class CostReviewSchema(BaseModel):
    category: str
    reviewed_value: float
    override_reason: Optional[str] = None


class PlanCostItemSchema(BaseModel):
    id: int
    plan_id: int
    business_cost_category: str
    estimated_value: Optional[float] = None
    ai_reasoning: Optional[str] = None

    class Config:
        from_attributes = True


class PlanSchema(BaseModel):
    id: int
    case_id: int
    plan_type: str
    plan_label: str
    total_cost_eur: Optional[float] = None
    total_duration_days: Optional[float] = None
    comparison_rank: Optional[int] = None
    ai_reasoning: Optional[str] = None
    cost_items: List[PlanCostItemSchema] = []

    class Config:
        from_attributes = True


class RuleCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    scope: str = "global"
    customer_code: Optional[str] = None
    cost_category: Optional[str] = None
    applicable_flow: Optional[str] = None
    rule_type: str
    rule_value: float
    condition_json: Optional[str] = None
    priority: int = 0
    enabled: int = 1


class RuleSchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    scope: str
    customer_code: Optional[str] = None
    cost_category: Optional[str] = None
    applicable_flow: Optional[str] = None
    rule_type: str
    rule_value: float
    condition_json: Optional[str] = None
    priority: int
    enabled: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class AIConfigSchema(BaseModel):
    id: int = 1
    ollama_base_url: str = "http://localhost:11434"
    model_name: str = "qwen2.5:7b"
    temperature: float = 0.3
    top_p: float = 0.9
    max_tokens: int = 4096


class AIConfigUpdateSchema(BaseModel):
    ollama_base_url: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None
    max_tokens: Optional[int] = None


class SSEProgressEvent(BaseModel):
    type: str = "progress"
    message: str


class SSEResultEvent(BaseModel):
    type: str = "result"
    data: dict


class AITestResult(BaseModel):
    success: bool
    response_time_ms: Optional[float] = None
    error: Optional[str] = None
