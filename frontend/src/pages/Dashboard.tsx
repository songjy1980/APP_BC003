import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Typography, Space, Select, Row, Col, Alert, Collapse, Tag, Progress, Spin,
} from 'antd'
import {
  ArrowLeftOutlined, TrophyOutlined, WarningOutlined, DownloadOutlined,
} from '@ant-design/icons'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ScatterChart, Scatter, ZAxis,
  PieChart, Pie, Cell,
} from 'recharts'
import { useCaseStore } from '../stores/caseStore'
import type { PlanItem } from '../types'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

const { Title, Text, Paragraph } = Typography

const COLORS = ['#2563eb', '#7c3aed', '#d97706', '#dc2626', '#059669']
const CAT_COLORS: Record<string, string> = {
  '零部件成本': '#2563eb',
  '管理费': '#7c3aed',
  '运输费用': '#d97706',
  '吊车成本': '#dc2626',
  '人力成本': '#0891b2',
  '工具费用': '#059669',
  '其他费用': '#78716c',
  '总成本（含罚款）': '#1e293b',
}

export default function Dashboard() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentCase, currentPlans, fetchCase, fetchPlans } = useCaseStore()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      Promise.all([fetchCase(parseInt(id)), fetchPlans(parseInt(id))]).finally(() => setLoading(false))
    }
  }, [id])

  const rankedPlans = useMemo(() => [...currentPlans].sort((a, b) => (a.comparison_rank || 99) - (b.comparison_rank || 99)), [currentPlans])
  const bestPlan = rankedPlans[0]

  const barData = useMemo(() => {
    return rankedPlans.map((p) => {
      const row: any = { name: p.plan_label?.replace(/方案\d[：:]/, '') }
      const items = p.cost_items || []
      for (const it of items) {
        if (it.business_cost_category !== '总成本（含罚款）') {
          row[it.business_cost_category] = it.estimated_value || 0
        }
      }
      return row
    })
  }, [rankedPlans])

  const radarData = useMemo(() => {
    if (!bestPlan) return []
    return [
      { factor: '总成本', full: 100, value: 100 },
      { factor: '罚款风险', full: 100, value: 60 },
      { factor: '置信度', full: 100, value: 70 },
      { factor: '稳定性', full: 100, value: bestPlan.is_feasible ? 80 : 20 },
    ]
  }, [bestPlan])

  const scatterData = useMemo(() => {
    return rankedPlans
      .filter((p) => p.is_feasible)
      .map((p, i) => ({
        x: p.total_duration_days || 0,
        y: p.total_cost_eur || 0,
        z: p.composite_score || 50,
        name: p.plan_label?.replace(/方案\d[：:]/, ''),
        fill: COLORS[i],
      }))
  }, [rankedPlans])

  const pieData = useMemo(() => {
    const p = selectedPlan ? rankedPlans.find((pl) => pl.plan_type === selectedPlan) : bestPlan
    if (!p || !p.cost_items) return []
    return (p.cost_items || [])
      .filter((it) => it.business_cost_category !== '总成本（含罚款）')
      .map((it) => ({
        name: it.business_cost_category,
        value: it.estimated_value || 0,
      }))
  }, [rankedPlans, selectedPlan, bestPlan])

  const barCategories = useMemo(() => {
    const cats = new Set<string>()
    rankedPlans.forEach((p) => (p.cost_items || []).forEach((it) => {
      if (it.business_cost_category !== '总成本（含罚款）') cats.add(it.business_cost_category)
    }))
    return Array.from(cats)
  }, [rankedPlans])

  if (loading) {
    return <Spin tip="加载中..."><div style={{ padding: 100 }} /></Spin>
  }

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()

    const sheet1: any[][] = [['案例名称', currentCase?.case_name || '']]
    rankedPlans.forEach((p) => {
      sheet1.push([])
      sheet1.push([p.plan_label])
      sheet1.push(['成本项', '子类型', '金额(EUR)'])
      ;(p.cost_items || []).forEach((it) => {
        sheet1.push([it.business_cost_category, it.cost_subtype || '', it.estimated_value || 0])
      })
      sheet1.push(['总成本', '', p.total_cost_eur || 0])
      sheet1.push(['综合评分', '', p.composite_score || 0])
      sheet1.push(['排名', '', p.comparison_rank || 0])
      sheet1.push(['可行', '', p.is_feasible ? '是' : `否: ${p.infeasibility_reason || ''}`])
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), '方案对比')

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    saveAs(blob, `dashboard_case_${id}_${Date.now()}.xlsx`)
  }

  const handlePrintPDF = () => window.print()

  return (
    <div className="dashboard-page" style={{ maxWidth: 1400 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/cases/${id}/plans`)}>返回方案对比</Button>
        <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>导出 Excel</Button>
        <Button onClick={handlePrintPDF}>打印 PDF</Button>
      </Space>

      <Title level={4}>可视化仪表盘 {currentCase && <Text type="secondary">— {currentCase.case_name}</Text>}</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="📊 总成本对比 — 堆叠柱状图" size="small">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: number) => `€${v.toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {barCategories.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="a" fill={CAT_COLORS[cat] || '#888'} name={cat} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="🎯 综合评分 — 雷达图" size="small" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="factor" fontSize={12} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={10} />
                {rankedPlans.filter((p) => p.is_feasible).map((p, i) => (
                  <Radar key={p.id} name={p.plan_label?.replace(/方案\d[：:]/, '')} dataKey="value"
                         stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                ))}
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: -24 }}>
              <Space>
                {rankedPlans.filter((p) => p.is_feasible).map((p, i) => (
                  <Tag key={p.id} color={COLORS[i]}>{p.plan_label?.replace(/方案\d[：:]/, '')}</Tag>
                ))}
              </Space>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="📍 时间-成本 — 散点图" size="small">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name="完成天数" unit="天" fontSize={11} type="number" />
                <YAxis dataKey="y" name="总成本" unit="€" fontSize={11}
                       tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`} />
                <ZAxis dataKey="z" range={[80, 200]} name="评分" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }}
                         formatter={(v: any, name: string) => name === 'z' ? `${v}分` : name === 'y' ? `€${v.toLocaleString()}` : `${v}天`} />
                <Legend />
                {scatterData.map((d, i) => (
                  <Scatter key={i} name={d.name} data={[d]} fill={d.fill} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="🍩 成本构成 — 环形图" size="small"
                extra={
                  <Select size="small" value={selectedPlan || bestPlan?.plan_type || ''}
                          style={{ width: 160 }}
                          onChange={(v) => setSelectedPlan(v)}
                          options={rankedPlans.filter((p) => p.is_feasible).map((p) => ({
                            label: p.plan_label?.replace(/方案\d[：:]/, ''), value: p.plan_type,
                          }))}
                  />
                }>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}
                     dataKey="value" nameKey="name" label={({ name, pct }: any) => `${name} ${(pct * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={Object.values(COLORS)[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `€${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {bestPlan && (
        <Card style={{ marginTop: 16 }} title={
          <Space>
            <TrophyOutlined style={{ color: '#059669' }} />
            <span>🏆 AI 推荐结论 — {bestPlan.plan_label}</span>
          </Space>
        }>
          <Row gutter={16}>
            <Col span={8}>
              <Text strong>推荐理由</Text>
              <Paragraph style={{ marginTop: 4, fontSize: 13 }}>
                {bestPlan.ai_reasoning || `该方案综合评分 ${bestPlan.composite_score} 分，排名第 ${bestPlan.comparison_rank}，为最优方案。`}
              </Paragraph>
              <Progress percent={Math.round(bestPlan.composite_score || 0)} strokeColor="#059669" size="small" format={(p) => `${p} 分`} />
            </Col>
            <Col span={8}>
              <Text strong>关键风险</Text>
              {bestPlan.penalty_amount_eur != null && bestPlan.penalty_amount_eur > 0 ? (
                <Alert type="warning" message={`预计罚款 €${bestPlan.penalty_amount_eur.toLocaleString()}`} style={{ marginTop: 4, fontSize: 12 }} />
              ) : (
                <Alert type="success" message="无罚款风险" style={{ marginTop: 4, fontSize: 12 }} />
              )}
            </Col>
            <Col span={8}>
              <Text strong>方案概况</Text>
              <Paragraph style={{ marginTop: 4, fontSize: 13 }}>
                总成本: €{bestPlan.total_cost_eur?.toLocaleString()}<br />
                预计天数: {bestPlan.total_duration_days} 天<br />
                可行: {bestPlan.is_feasible ? '✅' : `❌ ${bestPlan.infeasibility_reason}`}
              </Paragraph>
            </Col>
          </Row>

          {bestPlan.ai_reasoning && (
            <Collapse size="small" style={{ marginTop: 8 }}
                      items={[{ key: 'detail', label: '📝 AI 推理过程', children: <Paragraph style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{bestPlan.ai_reasoning}</Paragraph> }]}
            />
          )}
        </Card>
      )}
    </div>
  )
}
