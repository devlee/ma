import { useState, type CSSProperties } from 'react';
import { Layout, Menu, Select, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SystemSwitcher } from '@/components/SystemSwitcher';
import { useDecisionRole } from '@/contexts/DecisionRoleContext';
import { DECISION_PAGES, MENU_BY_BOARD, decisionHref, getDecisionPage, type DecisionPageDef } from '@/pages/decision/registry';
import { DISABLED_DECISION_ROLES, DECISION_BOARDS, DECISION_ROLES, type DecisionBoard, type DecisionRole } from '@/types/decision';
import styles from './index.module.css';

const { Header, Sider, Content } = Layout;

const HEADER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  height: 56,
  lineHeight: '32px',
  padding: '0 24px',
  background: '#fff',
  overflow: 'visible',
  flexWrap: 'nowrap',
  flexShrink: 0,
  position: 'relative',
  zIndex: 20,
};

const BOARD_OPEN_KEYS = DECISION_BOARDS.map((board) => `board::${board}`);

function menuKey(href: string, board: DecisionBoard) {
  return `${board}::${href}`;
}

function hrefFromMenuKey(key: string) {
  const sep = key.indexOf('::');
  return sep >= 0 ? key.slice(sep + 2) : key;
}

function buildMenuItems(): MenuProps['items'] {
  return DECISION_BOARDS.map((board) => {
    const pages = MENU_BY_BOARD[board]
      .map((id) => getDecisionPage(id))
      .filter((page): page is DecisionPageDef => {
        if (!page) return false;
        return page.navVisible ?? true;
      });

    const onlyPage = pages[0];
    if (pages.length === 1 && onlyPage && onlyPage.title === board) {
      return {
        key: menuKey(decisionHref(onlyPage), board),
        label: board,
      };
    }

    return {
      key: `board::${board}`,
      label: board,
      children: pages.map((page) => ({
        key: menuKey(decisionHref(page), board),
        label: page.title,
      })),
    };
  });
}

function selectedKeys(pathname: string) {
  const keys: string[] = [];
  DECISION_PAGES.forEach((page) => {
    const href = decisionHref(page);
    const pattern = page.path.includes(':')
      ? new RegExp(`^/decision/${page.path.split('/:')[0]}/[^/]+$`)
      : new RegExp(`^${href}$`);
    if (!pattern.test(pathname)) return;
    keys.push(menuKey(href, page.board));
    page.extraMenuBoards?.forEach((board) => {
      keys.push(menuKey(href, board));
    });
  });
  return keys;
}

const ROLE_OPTIONS = DECISION_ROLES.map((role) => ({
  value: role,
  label: role === '品类负责人' ? '品类负责人（暂不设）' : role,
  disabled: DISABLED_DECISION_ROLES.has(role),
}));

export function DecisionLayout() {
  const { role, setRole, actor } = useDecisionRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = useState<string[]>(BOARD_OPEN_KEYS);

  return (
    <Layout className={styles.shell}>
      <Sider width={248} theme="light" className={styles.sider}>
        <div className={styles.brand}>经营决策系统</div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys(location.pathname)}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          items={buildMenuItems()}
          onClick={({ key }) => {
            if (key.includes('/decision/')) {
              navigate(hrefFromMenuKey(key));
            }
          }}
        />
      </Sider>
      <Layout>
        <Header className={styles.header} style={HEADER_STYLE}>
          <div className={styles.headerLeft}>
            <SystemSwitcher current="decision" />
          </div>
          <div className={styles.headerRight}>
            <Typography.Text type="secondary">当前角色</Typography.Text>
            <Select<DecisionRole>
              size="small"
              className={styles.roleSelect}
              value={role}
              options={ROLE_OPTIONS}
              onChange={setRole}
              popupMatchSelectWidth={false}
              getPopupContainer={() => document.body}
              style={{ width: 180, minWidth: 180, flexShrink: 0 }}
            />
            <Typography.Text type="secondary">{actor}</Typography.Text>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
