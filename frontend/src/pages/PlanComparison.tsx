import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Typography, Tag, Space, Collapse, Spin, Alert, Table, message, Progress,
  Slider, InputNumber, Divider, Descriptions, Tooltip,
} from 'antd'
import {
  TrophyOutlined, ArrowLeftOutlined, DownloadOutlined, ReloadOutlined,
  CloseCircleOutlined, DashboardOutlined, SettingOutlined, InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useCaseStore } from '../stores/caseStore'
import type { PlanItem } from '../types'
import api from '../api/client'
import Papa from 'papaparse'
import { saveAs } from 'file-saver'

const { Title, Text, Paragraph } = Typography

const PLAN_COLORS: Record<string, string> = {
  denmark_sea: '#2563eb', denmark_air: '#7c3aed', china_sea: '#d97706', china_air: '#dc2626', local_land: '#059669',
}
const PLAN_ICONS: Record<string, string> = {
  denmark_sea: '🇩🇰🚢', denmark_air: '🇩🇰✈️', china_sea: '🇨🇳🚢', china_air: '🇨🇳✈️', local_land: '🏠🚛',
}
const RANK_MEDALS = ['🥇', '🥈', '🥉', '4', '5', '6', '7', '8']

export default function PlanComparison() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentCase, currentPlans, loading, error, sseMessages, fetchCase, fetchPlans, generatePlans } = useCaseStore()
  const [planLoading, setPlanLoading] = useState(false)
  const [weights, setWeights] = useState<Record<string, number>>({ total_cost: 50, penalty_risk: 25, confidence: 15, stability: 10 })
  const [bufferDays, setBufferDays] = useState({ low: 7, medium: 3 })
  const [showScoringPanel, setShowScoringPanel] = useState(false)

  useEffect(() => {
    if (id) { fetchCase(parseInt(id)); fetchPlans(parseInt(id)) }
    api.get('/config/scoring').then(r => {
      const w: Record<string, number> = {}
      let low = 7, med = 3
      r.data.forEach((sw: any) => { w[sw.factor_name] = sw.weight; low = sw.low_risk_buffer_days; med = sw.medium_risk_buffer_days })
      setWeights(w); setBufferDays({ low, medium: med })
    }).catch(() => {})
  }, [id])

  const handleRegenerate = async () => {
    if (!id) return
    setPlanLoading(true)
    const result = await generatePlans(parseInt(id))
    if (result && result.type === 'result') await fetchPlans(parseInt(id))
    else message.error('方案生成失败')
    setPlanLoading(false)
  }

  const handleExport = () => {
    if (!currentCase || !currentPlans.length) return
    const rows: string[][] = []
    rows.push(['WindOps BC Analyzer - 方案对比导出']); rows.push([])
    rows.push(['案例名称', currentCase.case_name]); rows.push(['风机型号', currentCase.turbine_model])
    rows.push(['国家', currentCase.country]); rows.push([])
    rows.push(['方案', '成本项', '预估金额(EUR)', '总成本(EUR)', '总天数', '综合评分', '排名', '可行'])
    currentPlans.forEach((plan) => {
      plan.cost_items?.forEach((item) => {
        rows.push([plan.plan_label, item.business_cost_category, item.estimated_value?.toString() || '', '', '', '', '', plan.is_feasible ? '可行' : '不可行'])
      })
      rows.push([plan.plan_label, '合计', '', plan.total_cost_eur?.toString() || '', plan.total_duration_days?.toString() || '', plan.composite_score?.toString() || '', plan.comparison_rank?.toString() || '', plan.is_feasible ? '可行' : '不可行'])
      rows.push([])
    })
    const csv = Papa.unparse(rows)
    saveAs(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `plan_comparison_case_${id}_${Date.now()}.csv`)
    message.success('CSV 已导出')
  }

  const handleApplyWeights = async () => {
    const total = Object.values(weights).reduce((a, b) => a + b, 0)
    if (Math.abs(total - 100) > 0.1) { message.warning(`权重之和必须为 100%，当前 ${total}%`); return }
    try {
      const payload = [
        { id: 1, weight: weights.total_cost, low_risk_buffer_days: bufferDays.low, medium_risk_buffer_days: bufferDays.medium },
        { id: 2, weight: weights.penalty_risk, low_risk_buffer_days: bufferDays.low, medium_risk_buffer_days: bufferDays.medium },
        { id: 3, weight: weights.confidence, low_risk_buffer_days: bufferDays.low, medium_risk_buffer_days: bufferDays.medium },
        { id: 4, weight: weights.stability, low_risk_buffer_days: bufferDays.low, medium_risk_buffer_days: bufferDays.medium },
      ]
      await api.put('/config/scoring', payload)
      message.success('权重已应用')
      await handleRegenerate()
    } catch { message.error('保存失败') }
  }

  const resetWeights = () => { setWeights({ total_cost: 50, penalty_risk: 25, confidence: 15, stability: 10 }); setBufferDays({ low: 7, medium: 3 }) }

  const sortedPlans = useMemo(() => {
    const plans = [...currentPlans]
    const feasible = plans.filter(p => p.is_feasible !== 0)
    const infeasible = plans.filter(p => p.is_feasible === 0)
    feasible.sort((a, b) => {
      const sa = a.composite_score || 0; const sb = b.composite_score || 0
      if (sa !== sb) return sb - sa
      return (a.total_cost_eur || 0) - (b.total_cost_eur || 0)
    })
    return [...feasible, ...infeasible]
  }, [currentPlans])

  const caseSummary = currentCase ? { case_name: currentCase.case_name, turbine_model: currentCase.turbine_model, country: currentCase.country, project_name: (currentCase as any).project_name, contract_type: (currentCase as any).contract_type, fault_description: currentCase.fault_description, repair_duration_hours: (currentCase as any).repair_duration_hours, penalty_amount_eur: (currentCase as any).penalty_amount_eur, component: currentCase.component, platform: currentCase.platform } : null

  if (loading && !currentPlans.length) return <Spin tip="加载中..."><div style={{ padding: 100 }} /></Spin>

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/cases/${id}`)}>返回审核</Button>
      </Space>

      <Title level={4}>多方案对比分析 {currentCase && <Text type="secondary" style={{ fontSize: 16, marginLeft: 16 }}>{currentCase.case_name}</Text>}</Title>

      {caseSummary && (
        <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <Tag color="gold">🟡 用户输入</Tag>
              <Descriptions size="small" column={2} style={{ marginTop: 4 }}>
                <Descriptions.Item label="风机机型">{caseSummary.turbine_model}</Descriptions.Item>
                <Descriptions.Item label="国家">{caseSummary.country}</Descriptions.Item>
                <Descriptions.Item label="故障部件">{caseSummary.component}</Descriptions.Item>
                <Descriptions.Item label="合同类型">{caseSummary.contract_type || '-'}</Descriptions.Item>
                <Descriptions.Item label="维修时长">{caseSummary.repair_duration_hours} 小时</Descriptions.Item>
                <Descriptions.Item label="每日罚款">€{caseSummary.penalty_amount_eur?.toLocaleString() || 0}</Descriptions.Item>
                <Descriptions.Item label="故障描述" span={2}>{caseSummary.fault_description}</Descriptions.Item>
              </Descriptions>
            </div>
            <div>
              <Tag color="green">🟢 AI 推断</Tag>
              <Descriptions size="small" column={1} style={{ marginTop: 4 }}>
                <Descriptions.Item label="平台/机型">{caseSummary.platform}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </Card>
      )}

      {error && <Alert type="error" message={error} closable style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={handleRegenerate} loading={planLoading}>重新分析</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!currentPlans.length}>导出 CSV</Button>
        {sortedPlans.length > 0 && (
          <Button icon={<DashboardOutlined />} type="primary" onClick={() => navigate(`/cases/${id}/dashboard`)}>查看仪表盘</Button>
        )}
        <Button icon={<SettingOutlined />} onClick={() => setShowScoringPanel(!showScoringPanel)}>
          {showScoringPanel ? '收起' : '评分标准'}
        </Button>
        {sortedPlans.length > 0 && <Text type="secondary">{sortedPlans.filter(p => p.is_feasible).length} 个可行方案</Text>}
      </Space>

      {showScoringPanel && (
        <Card size="small" title="综合评分标准配置" style={{ marginBottom: 16 }}
              extra={
                <Space>
                  <Button size="small" onClick={resetWeights}>恢复默认</Button>
                  <Button size="small" type="primary" onClick={handleApplyWeights}>应用权重</Button>
                </Space>
              }>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[{ name: 'total_cost', label: '💰 总成本（含罚款）' }, { name: 'penalty_risk', label: '⚖️ 罚款风险' }, { name: 'confidence', label: '📊 数据置信度' }, { name: 'stability', label: '🔒 方案稳定性' }].map(f => (
              <div key={f.name} style={{ flex: '1 1 200px', minWidth: 180 }}>
                <Text strong>{f.label}：{weights[f.name] || 0}%</Text>
                <Slider min={0} max={100} step={5} value={weights[f.name] || 0} onChange={v => setWeights(prev => ({ ...prev, [f.name]: v }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            <div><Text strong>低风险缓冲：</Text><InputNumber min={1} max={30} value={bufferDays.low} onChange={v => setBufferDays(p => ({ ...p, low: v || 7 }))} addonAfter="天" /></div>
            <div><Text strong>中风险缓冲：</Text><InputNumber min={1} max={30} value={bufferDays.medium} onChange={v => setBufferDays(p => ({ ...p, medium: v || 3 }))} addonAfter="天" /></div>
            <div style={{ alignSelf: 'center' }}>
              <Tag color={Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 100) < 0.1 ? 'green' : 'red'}>
                权重和: {Object.values(weights).reduce((a, b) => a + b, 0)}%
              </Tag>
            </div>
          </div>
          <Divider style={{ margin: '12px 0' }} />
          <Alert type="info" message="综合评分 = 总成本得分×权重 + 罚款风险得分×权重 + 数据置信度得分×权重 + 方案稳定性得分×权重" style={{ fontSize: 12 }} />
        </Card>
      )}

      {planLoading && <Spin tip="规则引擎计算中..."><div style={{ padding: 40 }} /></Spin>}
      {sseMessages.length > 0 && planLoading && <Alert type="info" message={sseMessages[sseMessages.length - 1]} style={{ marginBottom: 16 }} />}

      {sortedPlans.length === 0 && !planLoading && (
        <Alert message="尚未生成方案对比" description="请点击「重新分析」按钮生成五方案对比" type="warning" showIcon
          action={<Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handleRegenerate} loading={planLoading}>重新分析</Button>} />
      )}

      {sortedPlans.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {sortedPlans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} rankIdx={i} isBest={i === 0 && plan.is_feasible !== 0} weights={weights} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, rankIdx, isBest, weights }: { plan: PlanItem; rankIdx: number; isBest: boolean; weights: Record<string, number> }) {
  const planColor = PLAN_COLORS[plan.plan_type] || '#6b7280'
  const planIcon = PLAN_ICONS[plan.plan_type] || '📊'
  const feasible = plan.is_feasible !== 0
  const isEconInfeasible = plan.infeasibility_reason?.includes('经济') || plan.infeasibility_reason?.includes('2 倍')
  const cardMinWidth = feasible ? 230 : 200

  const rankLabel = feasible ? (RANK_MEDALS[rankIdx] || `${rankIdx + 1}`) : '—'

  return (
    <Card
      style={{
        minWidth: cardMinWidth, flex: 1,
        borderColor: isBest ? '#059669' : feasible ? undefined : (isEconInfeasible ? '#f5222d' : '#e5e7eb'),
        borderWidth: isBest ? 2 : 1,
        boxShadow: isBest ? '0 4px 12px rgba(5,150,105,0.15)' : undefined,
        opacity: feasible ? 1 : 0.6,
        background: isEconInfeasible ? '#fff1f0' : (feasible ? undefined : '#f9fafb'),
      }}
      title={
        <Space>
          <span style={{ fontSize: 22, fontWeight: 700, color: planColor }}>{rankLabel}</span>
          <span style={{ fontSize: 18 }}>{planIcon}</span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{plan.plan_label}</span>
          {isBest && <Tag color="green" icon={<TrophyOutlined />}>推荐</Tag>}
          {!feasible && (isEconInfeasible ? <Tag color="volcano" icon={<WarningOutlined />}>经济不可行</Tag> : <Tag color="red" icon={<CloseCircleOutlined />}>不可行</Tag>)}
        </Space>
      }
      extra={isBest ? <Text strong style={{ color: '#059669' }}>⭐ 最优</Text> : null}
    >
      {!feasible && plan.infeasibility_reason && (
        <Alert type={isEconInfeasible ? 'error' : 'warning'} message={plan.infeasibility_reason} style={{ marginBottom: 8, fontSize: 12 }} />
      )}

      <Table
        dataSource={(plan.cost_items || []).filter(it => it.business_cost_category !== '总成本（含罚款）')}
        rowKey="id" pagination={false} size="small" showHeader={false}
        columns={[
          { title: '', dataIndex: 'business_cost_category', width: 90, render: (v: string, r: any) => r.cost_subtype ? `${v}(${r.cost_subtype})` : v },
          { title: '', dataIndex: 'estimated_value', align: 'right' as const, width: 80, render: (v: number | null) => v != null ? `€${v.toLocaleString()}` : '-' },
        ]}
        style={{ marginBottom: 8 }}
      />

      {plan.penalty_amount_eur != null && plan.penalty_amount_eur > 0 && (
        <Paragraph style={{ marginBottom: 4, fontSize: 12 }}><Text type="danger">罚款: €{plan.penalty_amount_eur.toLocaleString()}</Text></Paragraph>
      )}

      <div style={{ marginBottom: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>总成本</Text>
          <Text strong style={{ fontSize: 16, color: isBest ? '#059669' : '#1a1a2e' }}>€{(plan.total_cost_eur || 0).toLocaleString()}</Text>
        </Space>
      </div>

      <Paragraph style={{ marginBottom: 4 }}><Text strong>预计天数: </Text><Text style={{ color: planColor, fontSize: 14, fontWeight: 700 }}>{plan.total_duration_days}</Text> 天</Paragraph>

      {feasible && plan.composite_score != null && (
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>综合评分: </Text>
          <Progress percent={Math.round(plan.composite_score)} size="small" strokeColor={isBest ? '#059669' : planColor} format={p => `${p}分`} />
        </div>
      )}

      {!feasible && plan.composite_score == null && (
        <Paragraph style={{ marginBottom: 4 }}><Text type="secondary">综合评分: N/A</Text></Paragraph>
      )}

      {feasible && (
        <Collapse size="small" ghost items={[{
          key: 'scoring', label: '📊 评分明细',
          children: (
            <Table size="small" pagination={false} dataSource={[
              { factor: '💰 总成本（含罚款）', weight: `${weights.total_cost || 50}%`, score: Math.round(((plan.composite_score || 0) * (weights.total_cost || 50) / 100)) },
              { factor: '⚖️ 罚款风险', weight: `${weights.penalty_risk || 25}%`, score: Math.round(((plan.composite_score || 0) * (weights.penalty_risk || 25) / 100)) },
              { factor: '📊 数据置信度', weight: `${weights.confidence || 15}%`, score: Math.round(((plan.composite_score || 0) * (weights.confidence || 15) / 100)) },
              { factor: '🔒 方案稳定性', weight: `${weights.stability || 10}%`, score: Math.round(((plan.composite_score || 0) * (weights.stability || 10) / 100)) },
            ]} columns={[
              { title: '因子', dataIndex: 'factor' },
              { title: '权重', dataIndex: 'weight' },
              { title: '得分(0-100)', dataIndex: 'score' },
            ]} />
          ),
        }]} />
      )}

      {plan.ai_reasoning && (
        <Collapse size="small" items={[{ key: 'reasoning', label: 'AI 分析摘要', children: <Paragraph style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{plan.ai_reasoning}</Paragraph> }]} />
      )}
    </Card>
  )
}
