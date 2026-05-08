import { useEffect, useState, useMemo } from 'react'
import { Card, Form, Input, InputNumber, Button, Select, Alert, Typography, Space, Tag, Tabs, Slider, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '../stores/aiConfigStore'
import api from '../api/client'

const { Title, Text } = Typography

export default function AIConfig() {
  const { config, models, testResult, loading, fetchConfig, updateConfig, fetchModels, testConnection } =
    useAIConfigStore()
  const [form] = Form.useForm()
  const [selectedModel, setSelectedModel] = useState('')

  const [scoringWeights, setScoringWeights] = useState<any[]>([])
  const [scoringLoading, setScoringLoading] = useState(false)

  useEffect(() => { fetchConfig(); fetchModels(); fetchScoring() }, [])
  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        ollama_base_url: config.ollama_base_url,
        temperature: config.temperature,
        top_p: config.top_p,
        max_tokens: config.max_tokens,
      })
      setSelectedModel(config.model_name)
    }
  }, [config, form])

  const fetchScoring = async () => {
    try { const r = await api.get('/config/scoring'); setScoringWeights(r.data) } catch {}
  }

  const saveScoring = async () => {
    setScoringLoading(true)
    try {
      await api.put('/config/scoring', scoringWeights.map((w: any) => ({
        id: w.id, weight: w.weight, low_risk_buffer_days: w.low_risk_buffer_days, medium_risk_buffer_days: w.medium_risk_buffer_days,
      })))
      message.success('权重已保存')
    } catch { message.error('保存失败') }
    setScoringLoading(false)
  }

  const updateWeight = (id: number, field: string, value: number) => {
    setScoringWeights((prev) => prev.map((w) => (w.id === id ? { ...w, [field]: value } : w)))
  }

  const modelOptions = useMemo(() => {
    const opts = models.map((m) => ({ label: m, value: m }))
    if (selectedModel && !opts.some((o) => o.value === selectedModel)) {
      opts.unshift({ label: selectedModel, value: selectedModel })
    }
    return opts
  }, [models, selectedModel])

  const handleSave = async (values: Record<string, unknown>) => {
    await updateConfig({ ...values, model_name: selectedModel })
  }

  const weightFactors = scoringWeights.filter((w: any) => w.factor_name !== 'total_cost')

  return (
    <div>
      <Title level={4}>AI 模型配置</Title>
      <Text type="secondary">配置本地模型连接参数和综合评分权重</Text>

      <Tabs defaultActiveKey="model" items={[
        {
          key: 'model',
          label: <span><ThunderboltOutlined /> 模型连接</span>,
          children: (
            <>
              {config?.model_name && (
                <Alert style={{ marginTop: 12 }} type="info" showIcon
                  message={<span>当前模型：<Tag color="blue" style={{ marginLeft: 8, fontSize: 14 }}>{config.model_name}</Tag></span>}
                />
              )}
              <Card style={{ marginTop: 16 }}>
                <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
                  <Form.Item label="Ollama 地址" name="ollama_base_url" rules={[{ required: true }]}>
                    <Input placeholder="http://localhost:11434" />
                  </Form.Item>
                  <Form.Item label="模型名称" required>
                    <Select showSearch placeholder="选择或输入模型名" value={selectedModel || undefined}
                      onChange={(v) => setSelectedModel(v)} options={modelOptions}
                      notFoundContent={loading ? '加载中...' : '无可用模型，请启动 Ollama 后点击刷新'}
                      style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="Temperature" name="temperature">
                    <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="Top P" name="top_p">
                    <InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="Max Tokens" name="max_tokens">
                    <InputNumber min={256} max={32768} step={256} style={{ width: '100%' }} />
                  </Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />}>保存配置</Button>
                    <Button onClick={testConnection} loading={loading}>测试连接</Button>
                    <Button onClick={fetchModels} loading={loading}>刷新模型列表</Button>
                  </Space>
                </Form>
              </Card>
              {testResult && (
                <Alert type={testResult.success ? 'success' : 'error'}
                  message={
                    <Space>
                      {testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                      {testResult.success ? `连接成功! 响应时间: ${testResult.response_time_ms}ms` : `连接失败: ${testResult.error}`}
                    </Space>
                  }
                  showIcon={false} style={{ marginTop: 16 }} />
              )}
            </>
          ),
        },
        {
          key: 'scoring',
          label: <span><SettingOutlined /> 评分权重</span>,
          children: (
            <Card style={{ marginTop: 16 }} title="综合评分权重配置" extra={
              <Button type="primary" onClick={saveScoring} loading={scoringLoading} icon={<SettingOutlined />}>保存权重</Button>
            }>
              <Text type="secondary">调整 4 个评分因子的权重比例（总和建议 100%），以及罚款风险缓冲阈值。</Text>
              <div style={{ marginTop: 24 }}>
                <Text strong>💰 总成本（含罚款）：</Text>
                <Slider min={0} max={100} value={scoringWeights.find((w: any) => w.factor_name === 'total_cost')?.weight || 50}
                  onChange={(v) => { const w = scoringWeights.find((x: any) => x.factor_name === 'total_cost'); if (w) updateWeight(w.id, 'weight', v) }}
                  marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} />
              </div>
              {weightFactors.map((wf: any) => (
                <div key={wf.id} style={{ marginTop: 12 }}>
                  <Text strong>{wf.factor_label}：</Text>
                  <Slider min={0} max={100} value={wf.weight}
                    onChange={(v) => updateWeight(wf.id, 'weight', v)}
                    marks={{ 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%' }} />
                </div>
              ))}
              <div style={{ marginTop: 24, display: 'flex', gap: 24 }}>
                <div>
                  <Text strong>低风险缓冲阈值：</Text>
                  <InputNumber min={1} max={30} value={scoringWeights[0]?.low_risk_buffer_days || 7}
                    onChange={(v) => { if (scoringWeights.length > 0) updateWeight(scoringWeights[0].id, 'low_risk_buffer_days', v || 7) }}
                    addonAfter="天" />
                </div>
                <div>
                  <Text strong>中风险缓冲阈值：</Text>
                  <InputNumber min={1} max={30} value={scoringWeights[0]?.medium_risk_buffer_days || 3}
                    onChange={(v) => { if (scoringWeights.length > 0) updateWeight(scoringWeights[0].id, 'medium_risk_buffer_days', v || 3) }}
                    addonAfter="天" />
                </div>
              </div>
            </Card>
          ),
        },
      ]} />
    </div>
  )
}
