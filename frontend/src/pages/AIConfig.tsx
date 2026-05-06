import { useEffect, useState, useMemo } from 'react'
import { Card, Form, Input, InputNumber, Button, Select, Alert, Spin, Typography, Space, Tag } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '../stores/aiConfigStore'

const { Title, Text } = Typography

export default function AIConfig() {
  const { config, models, testResult, loading, fetchConfig, updateConfig, fetchModels, testConnection } =
    useAIConfigStore()
  const [form] = Form.useForm()
  const [selectedModel, setSelectedModel] = useState('')

  useEffect(() => {
    fetchConfig()
    fetchModels()
  }, [])

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

  return (
    <div>
      <Title level={4}>AI 模型配置</Title>
      <Text type="secondary">配置 Ollama 本地模型连接参数</Text>

      {config?.model_name && (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message={<span>当前使用模型：<Tag color="blue" style={{ marginLeft: 8, fontSize: 14 }}>{config.model_name}</Tag></span>}
        />
      )}

      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
          <Form.Item label="Ollama 地址" name="ollama_base_url" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:11434" />
          </Form.Item>

          <Form.Item label="模型名称" required>
            <Select
              showSearch
              placeholder="选择或输入模型名"
              value={selectedModel || undefined}
              onChange={(v) => setSelectedModel(v)}
              options={modelOptions}
              notFoundContent={loading ? '加载中...' : '无可用模型，请启动 Ollama 后点击刷新'}
              style={{ width: '100%' }}
            />
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
            <Button type="primary" htmlType="submit" loading={loading} icon={<ThunderboltOutlined />}>
              保存配置
            </Button>
            <Button onClick={testConnection} loading={loading}>
              测试连接
            </Button>
            <Button onClick={fetchModels} loading={loading}>
              刷新模型列表
            </Button>
          </Space>
        </Form>
      </Card>

      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          message={
            <Space>
              {testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {testResult.success
                ? `连接成功! 响应时间: ${testResult.response_time_ms}ms`
                : `连接失败: ${testResult.error}`}
            </Space>
          }
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}
    </div>
  )
}
