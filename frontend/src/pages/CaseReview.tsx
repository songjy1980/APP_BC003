import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Descriptions, Table, Button, InputNumber, Space, Tag, Typography, message, Modal, Input, Alert, Spin, Divider,
} from 'antd'
import { EditOutlined, BarChartOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCaseStore } from '../stores/caseStore'
import type { CaseCostItem } from '../types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function CaseReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentCase, loading, fetchCase, reviewCosts, generatePlans, deleteCase } = useCaseStore()
  const [editingItems, setEditingItems] = useState<Record<string, { value: number; reason: string }>>({})
  const [saving, setSaving] = useState(false)
  const [planLoading, setPlanLoading] = useState(false)
  const [reviewed, setReviewed] = useState(false)

  useEffect(() => {
    if (id) fetchCase(parseInt(id))
  }, [id])

  useEffect(() => {
    if (currentCase?.status === 'reviewed' || currentCase?.status === 'plans_generated') {
      setReviewed(true)
    }
  }, [currentCase])

  const handleSaveReviews = async () => {
    if (!id) return
    setSaving(true)
    const reviews = Object.entries(editingItems).map(([category, { value, reason }]) => ({
      category,
      reviewed_value: value,
      override_reason: reason || undefined,
    }))
    await reviewCosts(parseInt(id), reviews)
    setSaving(false)
    setReviewed(true)
    message.success('审核修改已保存')
  }

  const handleGeneratePlans = async () => {
    if (!id) return
    setPlanLoading(true)
    await generatePlans(parseInt(id))
    setPlanLoading(false)
    navigate(`/cases/${id}/plans`)
  }

  const handleDelete = () => {
    if (!id) return
    Modal.confirm({
      title: '确认删除此案例？',
      content: '删除后数据不可恢复',
      onOk: async () => {
        await deleteCase(parseInt(id))
        navigate('/cases/new')
      },
    })
  }

  const statusColors: Record<string, string> = {
    draft: 'default',
    ai_filled: 'blue',
    reviewed: 'orange',
    plans_generated: 'green',
  }

  const costColumns = [
    {
      title: '成本项', dataIndex: 'business_cost_category', width: 140,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'AI 推断值 (EUR)', dataIndex: 'ai_inferred_value', width: 140, align: 'right' as const,
      render: (v: number | null) => v?.toLocaleString() ?? '-',
    },
    {
      title: '置信度', dataIndex: 'ai_confidence', width: 90, align: 'center' as const,
      render: (v: number | null) => {
        if (!v) return '-'
        const pct = (v * 100).toFixed(0)
        const color = v >= 0.7 ? 'green' : v >= 0.4 ? 'orange' : 'red'
        return <Tag color={color}>{pct}%</Tag>
      },
    },
    {
      title: '审核修改值 (EUR)', dataIndex: 'business_cost_category', width: 200,
      render: (category: string, record: CaseCostItem) => {
        const currentValue = editingItems[category]?.value ?? record.reviewed_value ?? record.ai_inferred_value
        const isEditing = editingItems[category] !== undefined
        const isOverridden = record.is_overridden === 1
        return (
          <Space>
            <InputNumber
              value={currentValue ?? undefined}
              onChange={(v) => setEditingItems((prev) => ({
                ...prev,
                [category]: { value: v ?? 0, reason: prev[category]?.reason || '' },
              }))}
              style={{ width: 120 }}
              status={isEditing ? 'warning' : undefined}
            />
            {isOverridden && <Tag color="orange">已修改</Tag>}
            {isEditing && <Tag color="warning">待保存</Tag>}
          </Space>
        )
      },
    },
    {
      title: '修改原因', dataIndex: 'business_cost_category', width: 180,
      render: (category: string, record: CaseCostItem) => (
        <Input
          placeholder="可选：说明修改原因"
          value={editingItems[category]?.reason ?? record.override_reason ?? ''}
          onChange={(e) => setEditingItems((prev) => ({
            ...prev,
            [category]: { value: prev[category]?.value ?? record.reviewed_value ?? record.ai_inferred_value ?? 0, reason: e.target.value },
          }))}
          size="small"
        />
      ),
    },
    {
      title: '匹配记录数', dataIndex: 'source_record_count', width: 100, align: 'center' as const,
      render: (v: number | null) => v ?? '-',
    },
  ]

  if (loading && !currentCase) {
    return <Spin tip="加载中..."><div style={{ padding: 100 }} /></Spin>
  }

  if (!currentCase) {
    return <Alert type="warning" message="案例未找到" />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>案例审核: {currentCase.case_name}</Title>
        <Space>
          <Tag color={statusColors[currentCase.status] || 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
            {currentCase.status}
          </Tag>
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>删除</Button>
        </Space>
      </div>

      <Card style={{ marginTop: 16, marginBottom: 16 }} size="small">
        <Descriptions column={4} size="small">
          <Descriptions.Item label="风机型号">{currentCase.turbine_model}</Descriptions.Item>
          <Descriptions.Item label="平台">{currentCase.platform || '-'}</Descriptions.Item>
          <Descriptions.Item label="国家">{currentCase.country}</Descriptions.Item>
          <Descriptions.Item label="项目">{currentCase.project_name}</Descriptions.Item>
          <Descriptions.Item label="合同类型">{currentCase.contract_type}</Descriptions.Item>
          <Descriptions.Item label="故障部件">{currentCase.component || '-'}</Descriptions.Item>
          <Descriptions.Item label="维修时长(h)">{currentCase.repair_duration_hours}</Descriptions.Item>
          <Descriptions.Item label="每日罚款(EUR)">€{currentCase.penalty_amount_eur.toLocaleString()}</Descriptions.Item>
        </Descriptions>
        <Paragraph style={{ marginTop: 8 }}>
          <Text strong>故障描述: </Text>
          {currentCase.fault_description}
        </Paragraph>
        {currentCase.engineer_notes && (
          <Paragraph>
            <Text strong>补充提示词: </Text>
            {currentCase.engineer_notes}
          </Paragraph>
        )}
      </Card>

      <Card title="成本明细审核" extra={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveReviews}
            loading={saving}
            disabled={Object.keys(editingItems).length === 0}
          >
            保存审核修改
          </Button>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={handleGeneratePlans}
            loading={planLoading}
            disabled={!reviewed}
            style={{ background: '#059669', borderColor: '#059669' }}
          >
            生成三方案对比
          </Button>
        </Space>
      }>
        {!reviewed && (
          <Alert
            message="请审核 AI 推断的各项成本，可直接在表格中修改数值，修改后点击「保存审核修改」"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        {currentCase.cost_items && currentCase.cost_items.length > 0 ? (
          <Table
            dataSource={currentCase.cost_items}
            rowKey="id"
            columns={costColumns}
            pagination={false}
            size="small"
            bordered
          />
        ) : (
          <Alert message="尚未进行 AI 推断，请先在案例创建页面完成" type="warning" showIcon />
        )}
      </Card>
    </div>
  )
}
