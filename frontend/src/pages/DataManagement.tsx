import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Upload, Table, Tabs, Button, Tag, Space, Typography, message, Select, Modal, Descriptions, Statistic, Row, Col, Form, InputNumber, Alert
} from 'antd'
import {
  UploadOutlined, BarChartOutlined, ThunderboltOutlined, ReloadOutlined, FileTextOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useDataStore } from '../stores/dataStore'
import type { RawRecord, CostGroupMapping } from '../types'

const { Title, Text } = Typography
const { Dragger } = Upload

const BUSINESS_CATEGORIES = [
  '零部件成本', '吊车成本', '运输费用', '人力成本', '工具费用', '其他费用', '总成本合计'
]

export default function DataManagement() {
  const navigate = useNavigate()
  const { summary, mappings, records, loading, fetchSummary, fetchMappings, fetchRecords, uploadFile, updateMappings } =
    useDataStore()
  const [activeTab, setActiveTab] = useState('summary')
  const [mappingModal, setMappingModal] = useState(false)
  const [editingMappings, setEditingMappings] = useState<Record<string, string>>({})
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchSummary()
    fetchMappings()
  }, [])

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords({ page, page_size: 100 })
    }
  }, [activeTab, page])

  const handleUpload = async (file: File) => {
    try {
      const result = await uploadFile(file)
      message.success(`上传成功! ${result.row_count} 行数据已加载`)
      fetchSummary()
      fetchMappings()
    } catch {
      message.error('上传失败')
    }
    return false
  }

  const handleGenerateMapping = () => {
    if (!summary?.cost_groups) {
      message.warning('请先上传数据')
      return
    }
    const cg = summary.cost_groups
    const init: Record<string, string> = {}
    cg.forEach((g) => {
      const lower = g.value.toLowerCase()
      if (lower.includes('part') || lower.includes('spare')) init[g.value] = '零部件成本'
      else if (lower.includes('crane')) init[g.value] = '吊车成本'
      else if (lower.includes('freight') || lower.includes('transport')) init[g.value] = '运输费用'
      else if (lower.includes('labour') || lower.includes('labor')) init[g.value] = '人力成本'
      else if (lower.includes('tool')) init[g.value] = '工具费用'
      else init[g.value] = '其他费用'
    })
    setEditingMappings({ ...init })
    setMappingModal(true)
  }

  const handleSaveMappings = async () => {
    const mappingList = Object.entries(editingMappings).map(([key, value]) => ({
      cost_group_value: key,
      business_cost_category: value,
    }))
    await updateMappings(mappingList)
    message.success('映射已保存')
    setMappingModal(false)
  }

  const columns: ColumnsType<RawRecord> = [
    { title: 'Platform', dataIndex: 'platform', width: 130, ellipsis: true },
    { title: 'Component', dataIndex: 'component', width: 120, ellipsis: true },
    { title: 'SiteName', dataIndex: 'site_name', width: 150, ellipsis: true },
    {
      title: 'CostGroup', dataIndex: 'cost_group', width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: 'CostTypeDescription', dataIndex: 'cost_type_description', width: 180, ellipsis: true },
    {
      title: 'CostPerUnit', dataIndex: 'cost_per_unit', width: 110, align: 'right',
      render: (v: number | null) => v?.toFixed(2) ?? '-',
    },
    { title: 'Currency', dataIndex: 'currency', width: 90 },
    {
      title: 'ExchangeRateEUR', dataIndex: 'exchange_rate_eur', width: 120, align: 'right',
      render: (v: number | null) => v?.toFixed(4) ?? '-',
    },
  ]

  return (
    <div>
      <Title level={4}>历史数据管理</Title>
      <Text type="secondary">上传和管理风电运维成本历史数据</Text>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 16 }} items={[
        {
          key: 'summary',
          label: <span><BarChartOutlined />数据概览</span>,
          children: (
            <div>
              <Card style={{ marginBottom: 16 }}>
                <Dragger
                  accept=".csv,.xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={(file) => { handleUpload(file); return false }}
                  disabled={loading}
                >
                  <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 36, color: '#2563eb' }} /></p>
                  <p className="ant-upload-text">点击或拖拽 CSV/Excel 文件到此区域上传</p>
                  <p className="ant-upload-hint">支持 .csv .xlsx .xls 格式，新上传将替换现有数据</p>
                </Dragger>
              </Card>

              {summary && (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Card size="small"><Statistic title="总记录数" value={summary.total_rows} /></Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small"><Statistic title="CostGroup 种类" value={summary.cost_groups.length} /></Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small"><Statistic title="风场数" value={summary.site_names.length} /></Card>
                    </Col>
                    <Col span={6}>
                      <Card size="small"><Statistic title="平台数" value={summary.platforms.length} /></Card>
                    </Col>
                  </Row>

                  <Card title="CostGroup 分布" style={{ marginBottom: 16 }}>
                    <Space wrap>
                      {summary.cost_groups.map((g) => (
                        <Tag key={g.value} color="blue">{g.value}: {g.count}</Tag>
                      ))}
                    </Space>
                  </Card>

                  <Card title="数据分布">
                    <Descriptions column={3} size="small">
                      <Descriptions.Item label="币种">
                        {summary.currencies.map((c) => <Tag key={c.value}>{c.value || '(空)'}: {c.count}</Tag>)}
                      </Descriptions.Item>
                      <Descriptions.Item label="平台">
                        {summary.platforms.slice(0, 5).map((p) => <Tag key={p.value}>{p.value || '(空)'}: {p.count}</Tag>)}
                      </Descriptions.Item>
                      <Descriptions.Item label="故障部件">
                        {summary.components.slice(0, 5).map((c) => <Tag key={c.value} color="green">{c.value || '(空)'}: {c.count}</Tag>)}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </>
              )}
            </div>
          ),
        },
        {
          key: 'mappings',
          label: <span><ThunderboltOutlined />CostGroup 映射</span>,
          children: (
            <div>
              <Space style={{ marginBottom: 16 }}>
                <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleGenerateMapping}>
                  AI 分析 CostGroup 分类
                </Button>
                <Button onClick={fetchMappings} icon={<ReloadOutlined />}>刷新</Button>
              </Space>
              <Alert
                message="CostGroup 映射定义了原始数据中的成本大类到 7 类业务成本的对应关系"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Table
                dataSource={mappings}
                rowKey="id"
                pagination={false}
                columns={[
                  { title: 'CostGroup 原始值', dataIndex: 'cost_group_value', width: 200 },
                  {
                    title: '业务成本分类', dataIndex: 'business_cost_category',
                    render: (v: string) => <Tag color={v === '总成本合计' ? 'red' : 'green'}>{v}</Tag>,
                  },
                  {
                    title: '来源', dataIndex: 'is_user_defined',
                    render: (v: number) => v ? <Tag color="orange">用户定义</Tag> : <Tag>系统默认</Tag>,
                  },
                ]}
              />
            </div>
          ),
        },
        {
          key: 'records',
          label: <span><FileTextOutlined />数据预览</span>,
          children: (
            <Table
              dataSource={records?.records || []}
              rowKey="id"
              columns={columns}
              loading={loading}
              scroll={{ x: 1100 }}
              pagination={{
                current: page,
                total: records?.total || 0,
                pageSize: 100,
                onChange: setPage,
                showTotal: (t) => `共 ${t} 条`,
                showSizeChanger: false,
              }}
              size="small"
            />
          ),
        },
      ]} />

      <Modal
        title="CostGroup → 业务成本映射"
        open={mappingModal}
        onOk={handleSaveMappings}
        onCancel={() => setMappingModal(false)}
        width={600}
        okText="保存映射"
        cancelText="取消"
      >
        <Alert
          message="请确认每个 CostGroup 对应的业务成本分类，可以手动调整映射关系"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        {Object.entries(editingMappings).map(([key, value]) => (
          <Form.Item key={key} label={key} style={{ marginBottom: 8 }}>
            <Select
              value={value}
              onChange={(v) => setEditingMappings((prev) => ({ ...prev, [key]: v }))}
              options={BUSINESS_CATEGORIES.map((c) => ({ label: c, value: c }))}
              style={{ width: 200 }}
            />
          </Form.Item>
        ))}
      </Modal>
    </div>
  )
}
