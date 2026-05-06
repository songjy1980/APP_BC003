import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Form, Input, InputNumber, Button, Select, Typography, Divider, Alert, message, Space, Spin, Tag, Steps, Collapse
} from 'antd'
import {
  RobotOutlined, UserOutlined, ThunderboltOutlined, CheckCircleOutlined,
  ArrowRightOutlined, EyeOutlined,
} from '@ant-design/icons'
import { useCaseStore } from '../stores/caseStore'
import { useDataStore } from '../stores/dataStore'
import type { CaseCreate as CaseCreateType } from '../types'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const COUNTRIES = [
  'AU', 'ID', 'JP', 'KR', 'NZ', 'PH', 'TH', 'NC', 'CN', 'PK', 'VN'
]

const CONTRACT_TYPES = ['Full-Service', 'Parts-Only', 'Time-and-Materials', 'Fixed-Price']

export default function CaseCreate() {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const { loading, sseMessages, error, clearMessages, createCase, inferCosts } = useCaseStore()
  const { summary } = useDataStore()
  const [caseId, setCaseId] = useState<number | null>(null)
  const [inferred, setInferred] = useState(false)
  const [inferResult, setInferResult] = useState<Record<string, unknown> | null>(null)
  const [currentStep, setCurrentStep] = useState(0)

  const platforms = summary?.platforms.map((p) => p.value).filter(Boolean) || []
  const components = summary?.components.map((c) => c.value).filter(Boolean) || []

  useEffect(() => {
    clearMessages()
  }, [])

  const handleCreateAndInfer = async () => {
    try {
      const values = await form.validateFields()
      setCurrentStep(1)
      const id = await createCase(values as CaseCreateType)
      setCaseId(id)
      setCurrentStep(2)
      const result = await inferCosts(id)
      if (result?.type === 'result') {
        setInferred(true)
        setInferResult(result.data as Record<string, unknown>)
        setCurrentStep(3)
        message.success('AI 推断完成，请查看结果')
      }
    } catch (e: unknown) {
      if ((e as { errorFields?: unknown[] }).errorFields) return
      message.error('操作失败: ' + ((e as Error).message || '未知错误'))
    }
  }

  const handleReview = () => {
    if (caseId) {
      navigate(`/cases/${caseId}`)
    }
  }

  return (
    <div>
      <Title level={4}>案例创建</Title>
      <Text type="secondary">创建风电运维案例，AI 辅助推断成本</Text>

      <Steps
        current={currentStep}
        style={{ marginTop: 16, marginBottom: 24 }}
        size="small"
        items={[
          { title: '填写信息' },
          { title: '创建案例' },
          { title: 'AI 推断' },
          { title: '审核确认' },
        ]}
      />

      {error && <Alert type="error" message={error} closable style={{ marginBottom: 16 }} />}

      <div style={{ display: 'flex', gap: 24 }}>
        <Card
          title={<span><UserOutlined style={{ color: '#d97706', marginRight: 8 }} />🟡 用户输入区</span>}
          style={{ flex: 2 }}
        >
          <Form form={form} layout="vertical" initialValues={{ penalty_amount_eur: 0, repair_duration_hours: 14 }}>
            <Form.Item label="案例名称" name="case_name" rules={[{ required: true }]}>
              <Input placeholder="如：JP-Wind-Phase2 Gearbox故障案例" />
            </Form.Item>

            <Form.Item label="风机平台 (Platform)" name="platform">
              <Select
                showSearch
                placeholder="从历史数据中选择"
                options={platforms.map((p) => ({ label: p, value: p }))}
                allowClear
              />
            </Form.Item>

            <Form.Item label="风机型号" name="turbine_model" rules={[{ required: true }]}>
              <Input placeholder="如：Vestas V112-3.45MW" />
            </Form.Item>

            <Form.Item label="国家" name="country" rules={[{ required: true }]}>
              <Select
                showSearch
                placeholder="选择目标国家"
                options={COUNTRIES.map((c) => ({ label: c, value: c }))}
              />
            </Form.Item>

            <Form.Item label="项目名称" name="project_name" rules={[{ required: true }]}>
              <Input placeholder="如：JP-Wind-Phase2" />
            </Form.Item>

            <Form.Item label="合同类型" name="contract_type" rules={[{ required: true }]}>
              <Select options={CONTRACT_TYPES.map((c) => ({ label: c, value: c }))} />
            </Form.Item>

            <Form.Item label="故障部件 (Component)" name="component">
              <Select
                showSearch
                placeholder="从历史数据中选择"
                options={components.map((c) => ({ label: c, value: c }))}
                allowClear
              />
            </Form.Item>

            <Form.Item label="故障描述" name="fault_description" rules={[{ required: true }]}>
              <TextArea rows={3} placeholder="详细描述故障情况..." />
            </Form.Item>

            <Form.Item label="规定维修时长 (小时)" name="repair_duration_hours" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="每日罚款额 (EUR)" name="penalty_amount_eur">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="补充提示词（将传递给AI）" name="engineer_notes">
              <TextArea rows={2} placeholder="如：客户关系紧张，优先避免罚款..." />
            </Form.Item>

            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleCreateAndInfer}
              loading={loading}
              size="large"
              block
              disabled={!summary}
            >
              创建案例并 AI 自动填充
            </Button>
            {!summary && (
              <Alert
                message="请先上传历史数据"
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </Form>
        </Card>

        <Card
          title={<span><RobotOutlined style={{ color: '#059669', marginRight: 8 }} />🟢 AI 推断区</span>}
          style={{ flex: 1, background: '#f0fdf4', borderColor: '#d1fae5' }}
        >
          {!inferred ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <RobotOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
              <p style={{ color: '#9ca3af', marginTop: 12 }}>填写左侧表单后<br />点击「创建并AI填充」</p>
            </div>
          ) : (
            <div>
              <Tag color="success" icon={<CheckCircleOutlined />}>AI 推断完成</Tag>
              <Divider />
              {sseMessages.length > 0 && (
                <Collapse
                  size="small"
                  items={[{ key: 'log', label: '处理日志', children: sseMessages.map((m, i) => <p key={i} style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{m}</p>) }]}
                  style={{ marginBottom: 12 }}
                />
              )}
              {inferResult && (
                <div>
                  <Paragraph style={{ marginBottom: 8 }}>
                    <Text strong>总预估成本: </Text>
                    <Text style={{ fontSize: 20, color: '#059669' }}>
                      €{(inferResult.total_estimated_cost as number)?.toLocaleString()}
                    </Text>
                  </Paragraph>
                  {(inferResult.items as Array<Record<string, unknown>>)?.map((item, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 8 }}>
                      <Text strong>{item.business_cost_category as string}</Text>
                      <br />
                      <Text>€{(item.estimated_value as number)?.toLocaleString()}</Text>
                      <Tag style={{ marginLeft: 8 }} color="blue">
                        置信度: {((item.confidence as number) * 100).toFixed(0)}%
                      </Tag>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
                        {item.reasoning as string}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={handleReview}
                style={{ marginTop: 16 }}
                block
              >
                进入审核编辑
              </Button>
            </div>
          )}
        </Card>
      </div>

      {loading && <Spin tip="AI 正在分析..." style={{ display: 'block', marginTop: 24, textAlign: 'center' }}>
        <div style={{ padding: 50 }} />
      </Spin>}
    </div>
  )
}
