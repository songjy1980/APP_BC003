import { useEffect, useState } from 'react'
import {
  Card, Table, Button, Modal, Form, Input, Select, InputNumber, Typography, Space, Tag, Switch, message, Popconfirm,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useRuleStore } from '../stores/rulesStore'
import type { RuleItem } from '../types'

const { Title, Text } = Typography
const { TextArea } = Input

const RULE_TYPES = [
  { label: '倍数 (multiply)', value: 'multiply' },
  { label: '加值 (add)', value: 'add' },
  { label: '上限 (cap)', value: 'cap' },
  { label: '下限 (floor)', value: 'floor' },
]

export default function RulesManagement() {
  const { rules, loading, fetchRules, createRule, updateRule, deleteRule } = useRuleStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RuleItem | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchRules()
  }, [])

  const handleAdd = () => {
    setEditingRule(null)
    form.resetFields()
    form.setFieldsValue({ scope: 'global', rule_type: 'multiply', priority: 0, enabled: 1, rule_value: 1 })
    setModalOpen(true)
  }

  const handleEdit = (rule: RuleItem) => {
    setEditingRule(rule)
    form.setFieldsValue(rule)
    setModalOpen(true)
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    if (editingRule) {
      await updateRule(editingRule.id, values)
    } else {
      await createRule(values)
    }
    setModalOpen(false)
    fetchRules()
  }

  const handleToggle = async (rule: RuleItem) => {
    await updateRule(rule.id, { enabled: rule.enabled ? 0 : 1 })
    fetchRules()
  }

  const columns = [
    { title: '规则名称', dataIndex: 'name', width: 200 },
    {
      title: '范围', dataIndex: 'scope', width: 90,
      render: (v: string) => v === 'global' ? <Tag color="blue">全局</Tag> : <Tag color="orange">客户级</Tag>,
    },
    {
      title: '客户代码', dataIndex: 'customer_code', width: 130,
      render: (v: string | null) => v || '-',
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '类型', dataIndex: 'rule_type', width: 90,
      render: (v: string) => {
        const labels: Record<string, string> = { multiply: '倍数', add: '加值', cap: '上限', floor: '下限' }
        return labels[v] || v
      },
    },
    {
      title: '值', dataIndex: 'rule_value', width: 80, align: 'right' as const,
      render: (v: number) => v?.toFixed(2),
    },
    { title: '优先级', dataIndex: 'priority', width: 70, align: 'center' as const },
    {
      title: '启用', dataIndex: 'enabled', width: 70, align: 'center' as const,
      render: (v: number, record: RuleItem) => (
        <Switch size="small" checked={v === 1} onChange={() => handleToggle(record)} />
      ),
    },
    {
      title: '操作', width: 120,
      render: (_: unknown, record: RuleItem) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确认删除？" onConfirm={() => deleteRule(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>知识与规则管理</Title>
          <Text type="secondary">管理全局和客户级业务规则，AI 分析时将自动引用</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建规则</Button>
      </div>

      <Card style={{ marginTop: 16 }}>
        <Table
          dataSource={rules}
          rowKey="id"
          columns={columns}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="规则名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="如：日本客户时效敏感" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="规则详细说明..." />
          </Form.Item>
          <Form.Item label="适用范围" name="scope" rules={[{ required: true }]}>
            <Select options={[
              { label: '全局 (global)', value: 'global' },
              { label: '客户级 (customer)', value: 'customer' },
            ]} />
          </Form.Item>
          <Form.Item label="客户代码 (客户级规则必填)" name="customer_code">
            <Input placeholder="如：JP-Wind-Phase2" />
          </Form.Item>
          <Form.Item label="关联成本类别" name="cost_category">
            <Select allowClear placeholder="可选" options={[
              { label: '零部件成本', value: '零部件成本' },
              { label: '吊车成本', value: '吊车成本' },
              { label: '运输费用', value: '运输费用' },
              { label: '人力成本', value: '人力成本' },
              { label: '工具费用', value: '工具费用' },
              { label: '其他费用', value: '其他费用' },
            ]} />
          </Form.Item>
          <Form.Item label="规则类型" name="rule_type" rules={[{ required: true }]}>
            <Select options={RULE_TYPES} />
          </Form.Item>
          <Form.Item label="规则值" name="rule_value" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} step={0.01} />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <InputNumber style={{ width: '100%' }} min={0} max={100} />
          </Form.Item>
          <Form.Item label="启用" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
