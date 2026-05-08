import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Typography, Tag, Space, Collapse, Spin, Alert, Table, message, Progress,
} from 'antd'
import {
  TrophyOutlined, ArrowLeftOutlined, DownloadOutlined, ReloadOutlined,
  CloseCircleOutlined, DashboardOutlined,
} from '@ant-design/icons'
import { useCaseStore } from '../stores/caseStore'
import type { PlanItem } from '../types'
import Papa from 'papaparse'
import { saveAs } from 'file-saver'

const { Title, Text, Paragraph } = Typography

const PLAN_COLORS: Record<string, string> = {
  denmark_sea: '#2563eb',
  denmark_air: '#7c3aed',
  china_sea: '#d97706',
  china_air: '#dc2626',
  local_land: '#059669',
}

const PLAN_ICONS: Record<string, string> = {
  denmark_sea: '🇩🇰🚢',
  denmark_air: '🇩🇰✈️',
  china_sea: '🇨🇳🚢',
  china_air: '🇨🇳✈️',
  local_land: '🏠🚛',
}

export default function PlanComparison() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentCase, currentPlans, loading, error, sseMessages, fetchCase, fetchPlans, generatePlans } = useCaseStore()
  const [planLoading, setPlanLoading] = useState(false)

  useEffect(() => {
    if (id) {
      fetchCase(parseInt(id))
      fetchPlans(parseInt(id))
    }
  }, [id])

  const handleRegenerate = async () => {
    if (!id) return
    setPlanLoading(true)
    const result = await generatePlans(parseInt(id))
    if (result && result.type === 'result') {
      await fetchPlans(parseInt(id))
    } else {
      message.error('方案生成失败，请检查 AI 服务是否正常运行')
    }
    setPlanLoading(false)
  }

  const handleExport = () => {
    if (!currentCase || !currentPlans.length) return
    const rows: string[][] = []
    rows.push(['WindOps BC Analyzer - 方案对比导出'])
    rows.push([])
    rows.push(['案例名称', currentCase.case_name])
    rows.push(['风机型号', currentCase.turbine_model])
    rows.push(['国家', currentCase.country])
    rows.push([])
    rows.push(['方案', '成本项', '预估金额(EUR)', '总成本(EUR)', '总天数', '综合评分', '排名', '可行'])

    currentPlans.forEach((plan) => {
      plan.cost_items?.forEach((item) => {
        rows.push([
          plan.plan_label, item.business_cost_category,
          item.estimated_value?.toString() || '', '', '', '', '',
          plan.is_feasible ? '可行' : '不可行',
        ])
      })
      rows.push([
        plan.plan_label, '合计', '',
        plan.total_cost_eur?.toString() || '',
        plan.total_duration_days?.toString() || '',
        plan.composite_score?.toString() || '',
        plan.comparison_rank?.toString() || '',
        plan.is_feasible ? '可行' : '不可行',
      ])
      rows.push([])
    })

    const csv = Papa.unparse(rows)
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `plan_comparison_case_${id}_${Date.now()}.csv`)
    message.success('CSV 已导出')
  }

  if (loading && !currentPlans.length) {
    return <Spin tip="加载中..."><div style={{ padding: 100 }} /></Spin>
  }

  const rankedPlans = [...currentPlans].sort((a, b) => (a.comparison_rank || 99) - (b.comparison_rank || 99))

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/cases/${id}`)}>返回审核</Button>
      </Space>

      <Title level={4}>
        多方案对比分析
        {currentCase && <Text type="secondary" style={{ fontSize: 16, marginLeft: 16 }}>{currentCase.case_name}</Text>}
      </Title>

      {error && <Alert type="error" message={error} closable style={{ marginBottom: 16 }} />}

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={handleRegenerate} loading={planLoading}>
          重新分析
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!currentPlans.length}>
          导出 CSV
        </Button>
        {rankedPlans.length > 0 && (
          <Button icon={<DashboardOutlined />} type="primary"
                  onClick={() => navigate(`/cases/${id}/dashboard`)}>
            查看仪表盘
          </Button>
        )}
        {rankedPlans.length > 0 && <Text type="secondary">{rankedPlans.length} 个方案</Text>}
      </Space>

      {planLoading && <Spin tip="规则引擎计算中..."><div style={{ padding: 40 }} /></Spin>}

      {sseMessages.length > 0 && planLoading && (
        <Alert type="info" message={sseMessages[sseMessages.length - 1]} style={{ marginBottom: 16 }} />
      )}

      {rankedPlans.length === 0 && !planLoading && (
        <Alert
          message="尚未生成方案对比"
          description={error
            ? `方案生成失败: ${error}。请确认 AI 服务正常运行后重试。`
            : "请点击下方「重新分析」按钮生成五方案对比"}
          type={error ? "error" : "warning"}
          showIcon
          action={
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={handleRegenerate} loading={planLoading}>
              重新分析
            </Button>
          }
        />
      )}

      {rankedPlans.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {rankedPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isBest={plan.comparison_rank === 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, isBest }: { plan: PlanItem; isBest: boolean }) {
  const planColor = PLAN_COLORS[plan.plan_type] || '#6b7280'
  const planIcon = PLAN_ICONS[plan.plan_type] || '📊'
  const feasible = plan.is_feasible !== 0
  const cardMinWidth = feasible ? 230 : 200

  return (
    <Card
      style={{
        minWidth: cardMinWidth,
        flex: 1,
        borderColor: isBest ? '#059669' : feasible ? undefined : '#e5e7eb',
        borderWidth: isBest ? 2 : 1,
        boxShadow: isBest ? '0 4px 12px rgba(5,150,105,0.15)' : undefined,
        opacity: feasible ? 1 : 0.6,
        background: feasible ? undefined : '#f9fafb',
      }}
      title={
        <Space>
          <span style={{ fontSize: 18 }}>{planIcon}</span>
          <span style={{ fontWeight: 700, fontSize: 13 }}>{plan.plan_label}</span>
          {isBest && <Tag color="green" icon={<TrophyOutlined />}>推荐</Tag>}
          {!feasible && <Tag color="red" icon={<CloseCircleOutlined />}>不可行</Tag>}
        </Space>
      }
      extra={
        isBest && <Text strong style={{ color: '#059669' }}>⭐ 最优</Text>
      }
    >
      {!feasible && plan.infeasibility_reason && (
        <Alert type="warning" message={plan.infeasibility_reason} style={{ marginBottom: 8, fontSize: 12 }} size="small" />
      )}

      <Table
        dataSource={(plan.cost_items || []).filter((it) => it.business_cost_category !== '总成本（含罚款）')}
        rowKey="id"
        pagination={false}
        size="small"
        showHeader={false}
        columns={[
          { title: '', dataIndex: 'business_cost_category', width: 90, render: (v: string, r: any) => r.cost_subtype ? `${v}(${r.cost_subtype})` : v },
          { title: '', dataIndex: 'estimated_value', align: 'right' as const, width: 80,
            render: (v: number | null) => v != null ? `€${v.toLocaleString()}` : '-',
          },
        ]}
        style={{ marginBottom: 8 }}
      />

      {plan.penalty_amount_eur != null && plan.penalty_amount_eur > 0 && (
        <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>
          <Text type="danger">罚款: €{plan.penalty_amount_eur.toLocaleString()}</Text>
        </Paragraph>
      )}

      <div style={{ marginBottom: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Text strong>总成本</Text>
          <Text strong style={{ fontSize: 16, color: isBest ? '#059669' : '#1a1a2e' }}>
            €{(plan.total_cost_eur || 0).toLocaleString()}
          </Text>
        </Space>
      </div>

      <Paragraph style={{ marginBottom: 4 }}>
        <Text strong>预计天数: </Text>
        <Text style={{ color: planColor, fontSize: 14, fontWeight: 700 }}>{plan.total_duration_days}</Text> 天
      </Paragraph>

      {plan.composite_score != null && (
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: 12 }}>综合评分: </Text>
          <Progress
            percent={Math.round(plan.composite_score)}
            size="small"
            strokeColor={isBest ? '#059669' : planColor}
            format={(p) => `${p}分`}
          />
        </div>
      )}

      {plan.comparison_rank != null && (
        <Paragraph style={{ marginBottom: 4 }}>
          <Text strong>排名: </Text>
          <Tag color={plan.comparison_rank === 1 ? 'green' : plan.comparison_rank === 2 ? 'orange' : plan.comparison_rank <= 3 ? 'blue' : 'default'}>
            第 {plan.comparison_rank} 名
          </Tag>
        </Paragraph>
      )}

      {plan.ai_reasoning && (
        <Collapse
          size="small"
          items={[{ key: 'reasoning', label: 'AI 分析摘要', children: <Paragraph style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{plan.ai_reasoning}</Paragraph> }]}
        />
      )}
    </Card>
  )
}
