import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography } from 'antd'
import {
  DatabaseOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'

const { Header, Content, Sider } = Layout
const { Title } = Typography

const menuItems = [
  { key: '/config', icon: <SettingOutlined />, label: 'AI 配置' },
  { key: '/data', icon: <DatabaseOutlined />, label: '数据管理' },
  { key: '/cases/new', icon: <FileTextOutlined />, label: '案例创建' },
  { key: '/rules', icon: <ThunderboltOutlined />, label: '规则管理' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={5} style={{ color: '#fff', margin: 0 }}>
            {collapsed ? 'BC' : 'BC Analyzer'}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #e5e7eb' }}>
          <Title level={4} style={{ margin: '14px 0', color: '#1e3a5f' }}>
            WindOps BC Analyzer
          </Title>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
