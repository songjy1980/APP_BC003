import { useEffect } from 'react'
import { Card, Form, Input, InputNumber, Button, Select, Alert, Spin, Typography, Space } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAIConfigStore } from '../stores/aiConfigStore'

const { Title, Text } = Typography

export default function AIConfig() {
  const { config, models, testResult, loading, fetchConfig, updateConfig, fetchModels, testConnection } =
    useAIConfigStore()
  const [form] = Form.useForm()

  useEffect(() => {
    fetchConfig()
    fetchModels()
  }, [])

  useEffect(() => {
    if (config) {
      form.setFieldsValue(config)
    }
  }, [config, form])

  const handleSave = async (values: Record<string, unknown>) => {
    await updateConfig(values)
  }

  return (
    <div>
      <Title level={4}>AI 模型配置</Title>
      <Text type="secondary">配置 Ollama 本地模型连接参数</Text>

      <Card style={{ marginTop: 16, marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 600 }}>
          <Form.Item label="Ollama 地址" name="ollama_base_url" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:11434" />
          </Form.Item>
          <Form.Item label="模型名称" name="model_name" rules={[{ required: true }]}>
            <Form.Item noStyle>
              <Select
                showSearch
                placeholder="选择或输入模型名"
                options={models.map((m) => ({ label: m, value: m }))}
                allowClear={false}
              />
            </Form.Item>
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

      {loading && <Spin tip="加载中..." style={{ display: 'block', marginTop: 24 }} />}
    </div>
  )
}
