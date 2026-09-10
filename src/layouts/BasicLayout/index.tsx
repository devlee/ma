import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Segmented, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { APP_ROLES, useRole, type AppRole } from '@/contexts/RoleContext';
import { DEFAULT_SUBTASK_ID } from '@/constants/buyer-show';
import styles from './index.module.css';

const { Header, Sider, Content } = Layout;

const sampleSubtaskId = DEFAULT_SUBTASK_ID;

function buildMenuItems(role: AppRole, isOps: boolean, isLead: boolean): MenuProps['items'] {
  const items: MenuProps['items'] = [];
  if (isOps) {
    items.push({ key: '/buyer-show/qc-library', label: 'SPU 质检图库' });
  }
  items.push(
    { key: '/buyer-show/task-list', label: '任务清单页' },
    { key: '/buyer-show/task-claim', label: '任务领取页' },
    {
      key: 'produce',
      label: '制作页（批量制作 / 单个制作）',
      children: [
        { key: '/buyer-show/produce-batch', label: '批量制作' },
        { key: '/buyer-show/produce-single', label: '单个制作' },
      ],
    },
    { key: '/buyer-show/free-batch', label: '自由批量生图' },
    { key: `/buyer-show/subtask/${sampleSubtaskId}`, label: '子任务详情页' },
  );
  if (isOps) {
    items.push({ key: '/buyer-show/review', label: '审核页' });
  }
  items.push({ key: '/buyer-show/dashboard', label: '面板' });
  if (isLead) {
    items.push({ key: '/buyer-show/config', label: '配置管理' });
  }
  return items;
}

function resolveSelectedKey(pathname: string) {
  if (pathname.startsWith('/buyer-show/subtask/')) {
    return `/buyer-show/subtask/${sampleSubtaskId}`;
  }
  return pathname;
}

export function BasicLayout() {
  const { role, setRole, actor, isOps, isLead } = useRole();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Layout className={styles.shell}>
      <Sider width={232} theme="light" className={styles.sider}>
        <div className={styles.brand}>灵枢 · 买家秀管理</div>
        <Menu
          mode="inline"
          selectedKeys={[resolveSelectedKey(location.pathname)]}
          defaultOpenKeys={['produce']}
          items={buildMenuItems(role, isOps, isLead)}
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <Typography.Text type="secondary">当前角色</Typography.Text>
          <Segmented<AppRole> size="small" value={role} options={APP_ROLES} onChange={setRole} />
          <Typography.Text type="secondary">{actor}</Typography.Text>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
