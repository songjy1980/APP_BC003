export interface DataSummary {
  total_rows: number
  cost_groups: { value: string; count: number }[]
  currencies: { value: string; count: number }[]
  site_names: { value: string; count: number }[]
  platforms: { value: string; count: number }[]
  components: { value: string; count: number }[]
  upload_batch_id: string | null
}

export interface CostGroupMapping {
  id: number
  cost_group_value: string
  business_cost_category: string
  is_user_defined: number
}

export interface CaseCreate {
  case_name: string
  turbine_model: string
  country: string
  project_name: string
  contract_type: string
  fault_description: string
  repair_duration_hours: number
  penalty_amount_eur: number
  platform?: string
  component?: string
  engineer_notes?: string
}

export interface CaseItem {
  id: number
  case_name: string
  turbine_model: string
  country: string
  project_name: string
  contract_type: string
  fault_description: string
  repair_duration_hours: number
  penalty_amount_eur: number
  status: string
  platform?: string
  component?: string
  engineer_notes?: string
  cost_items?: CaseCostItem[]
  created_at: string
  updated_at: string
}

export interface CaseCostItem {
  id: number
  case_id: number
  business_cost_category: string
  ai_inferred_value: number | null
  ai_confidence: number | null
  ai_reasoning: string | null
  reviewed_value: number | null
  is_overridden: number
  override_reason: string | null
  source_record_count: number | null
  source_avg_cost: number | null
}

export interface PlanItem {
  id: number
  case_id: number
  plan_type: string
  plan_label: string
  total_cost_eur: number | null
  total_duration_days: number | null
  penalty_amount_eur: number | null
  comparison_rank: number | null
  composite_score: number | null
  is_feasible: number
  infeasibility_reason: string | null
  ai_reasoning: string | null
  cost_items: PlanCostItem[]
}

export interface PlanCostItem {
  id: number
  plan_id: number
  business_cost_category: string
  cost_subtype: string | null
  estimated_value: number | null
  ai_reasoning: string | null
}

export interface RuleItem {
  id: number
  name: string
  description: string | null
  scope: string
  customer_code: string | null
  cost_category: string | null
  applicable_flow: string | null
  rule_type: string
  rule_value: number
  condition_json: string | null
  priority: number
  enabled: number
  created_at: string
  updated_at: string
}

export interface AIConfigItem {
  id: number
  ollama_base_url: string
  model_name: string
  temperature: number
  top_p: number
  max_tokens: number
}

export interface RawRecord {
  id: number
  upload_batch_id: string
  platform: string | null
  component: string | null
  site_name: string
  cost_group: string
  cost_type_description: string | null
  cost_per_unit: number | null
  currency: string | null
  exchange_rate_eur: number | null
}

export interface PaginatedRecords {
  total: number
  page: number
  page_size: number
  records: RawRecord[]
}

export interface SSEEvent {
  type: 'progress' | 'result' | 'error'
  message?: string
  data?: unknown
}
