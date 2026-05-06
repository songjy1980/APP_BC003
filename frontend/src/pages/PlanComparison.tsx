import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Typography, Tag, Space, Collapse, Spin, Alert, Table, message,
} from 'antd'
import {
  TrophyOutlined, ArrowLeftOutlined, DownloadOutlined, ReloadOutlined,
} from '@ant-design/icons'
import { useCaseStore } from '../stores/caseStore'
import type { PlanItem, PlanCostItem } from '../types'
import Papa from 'papaparse'
import { saveAs } from 'file-saver'

const { Title, Text, Paragraph } = Typography

const PLAN_COLORS: Record<string, string> = {
  denmark_sea: '#2563eb',
  china_air: '#d97706',
  local_land: '#059669',
}

const PLAN_ICONS: Record<string, string> = {
  denmark_sea: '🚢',
  china_air: '✈️',
  local_land: '🚛',
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
    await generatePlans(parseInt(id))
    await fetchPlans(parseInt(id))
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
    rows.push(['方案', '成本项', '预估金额(EUR)', '总成本(EUR)', '总天数', '排名'])

    currentPlans.forEach((plan) => {
      plan.cost_items?.forEach((item) => {
        rows.push([
          plan.plan_label,
          item.business_cost_category,
          item.estimated_value?.toString() || '',
          '',
          '',
          '',
        ])
      })
      rows.push([
        plan.plan_label,
        '合计',
        '',
        plan.total_cost_eur?.toString() || '',
        plan.total_duration_days?.toString() || '',
        plan.comparison_rank?.toString() || '',
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
      </Space>

      {planLoading && <Spin tip="AI 正在生成方案..."><div style={{ padding: 40 }} /></Spin>}

      {sseMessages.length > 0 && planLoading && (
        <Alert
          type="info"
          message={sseMessages[sseMessages.length - 1]}
          style={{ marginBottom: 16 }}
        />
      )}

      {rankedPlans.length === 0 && !planLoading && (
        <Alert
          message="尚未生成方案对比"
          description="请先在案例审核页面保存审核修改后，点击「生成三方案对比」"
          type="info"
          showIcon
        />
      )}

      {rankedPlans.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
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

  return (
    <Card
      style={{
        flex: 1,
        borderColor: isBest ? '#059669' : undefined,
        borderWidth: isBest ? 2 : 1,
        boxShadow: isBest ? '0 4px 12px rgba(5,150,105,0.15)' : undefined,
      }}
      title={
        <Space>
          <span style={{ fontSize: 20 }}>{planIcon}</span>
          <span style={{ fontWeight: 700 }}>{plan.plan_label}</span>
          {isBest && (
            <Tag color="green" icon={<TrophyOutlined />}>
              推荐方案
            </Tag>
          )}
        </Space>
      }
      extra={
        isBest && <Text strong style={{ color: '#059669' }}>⭐ 最优方案</Text>
      }
    >
      <Table
        dataSource={plan.cost_items || []}
        rowKey="id"
        pagination={false}
        size="small"
        showHeader={false}
        columns={[
          { title: '', dataIndex: 'business_cost_category', width: 100 },
          {
            title: '', dataIndex: 'estimated_value', align: 'right' as const,
            render: (v: number | null) => v ? `€${v.toLocaleString()}` : '-',
          },
        ]}
        summary={() =>
          plan.total_cost_eur != null ? (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><Text strong>总成本</Text></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ fontSize: 16, color: isBest ? '#059669' : '#1a1a2e' }}>
                  €{plan.total_cost_eur.toLocaleString()}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
        style={{ marginBottom: 12 }}
      />

      <Paragraph style={{ marginBottom: 4 }}>
        <Text strong>预计天数: </Text>
        <Text style={{ color: planColor, fontSize: 16, fontWeight: 700 }}>{plan.total_duration_days}</Text> 天
      </Paragraph>

      {plan.comparison_rank != null && (
        <Paragraph style={{ marginBottom: 4 }}>
          <Text strong>排名: </Text>
          <Tag color={plan.comparison_rank === 1 ? 'green' : plan.comparison_rank === 2 ? 'orange' : 'default'}>
            第 {plan.comparison_rank} 名
          </Tag>
        </Paragraph>
      )}

      {plan.ai_reasoning && (
        <Collapse
          size="small"
          items={[{ key: 'reasoning', label: 'AI 分析摘要', children: <Paragraph style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{plan.ai_reasoning}</Paragraph> }]}
        />
      )}
    </Card>
  )
}
