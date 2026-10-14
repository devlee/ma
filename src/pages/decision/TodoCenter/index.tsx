import { Alert, Card, Statistic, Typography } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { DecisionPageHeader } from '@/components/decision/PageHeader';
import { SuggestionCard } from '@/components/decision/SuggestionCard';
import { useDecisionRole } from '@/contexts/DecisionRoleContext';
import { mockDailyAlerts, mockShortcuts, mockSuggestions, mockTodoCounts } from '@/mocks/decision';
import { getDecisionPage } from '../registry';
import styles from './index.module.css';

const TODO_CARDS = [
  { key: 'swap', title: '换图', href: '/decision/workbench/swap/candidates', count: mockTodoCounts.swap },
  { key: 'disposition', title: '处置', href: '/decision/workbench/disposition', count: mockTodoCounts.disposition },
  { key: 'node', title: '节点确认', href: '/decision/planning/calendar', count: mockTodoCounts.nodeConfirm },
] as const;

export default function TodoCenter() {
  const { role, actor } = useDecisionRole();
  const navigate = useNavigate();
  const page = getDecisionPage('todo-center');

  if (!page) return null;

  return (
    <div className={styles.page}>
      <DecisionPageHeader title={page.title} board={page.board} sourceDoc={page.sourceDoc} />
      <Typography.Paragraph type="secondary">
        {actor}（{role}）的工作台首页。日级预警置顶，周度待办按模块聚合。
      </Typography.Paragraph>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {mockDailyAlerts.map((alert) => (
          <Alert
            key={alert.id}
            type="error"
            showIcon
            message={
              <Link to={alert.href} style={{ color: 'inherit' }}>
                {alert.kind} · {alert.title}
              </Link>
            }
            description={alert.detail}
          />
        ))}
      </div>

      <Card size="small" title="待办区" style={{ marginBottom: 12 }}>
        <div className={styles.todoGrid}>
          {TODO_CARDS.map((item) => (
            <Card
              key={item.key}
              size="small"
              hoverable
              className={styles.todoCard}
              onClick={() => navigate(item.href)}
            >
              <Statistic title={`${item.title}待办`} value={item.count} suffix="条" />
            </Card>
          ))}
        </div>
        <Typography.Text type="secondary">待填报项、待确认任务：待实现</Typography.Text>
      </Card>

      <Card size="small" title="上次决议区（留位）" style={{ marginBottom: 12 }}>
        <Typography.Paragraph className={styles.reserved} style={{ marginBottom: 0 }}>
          决议登记机制后置（《全局信息架构》第 5 节）。三会材料与决议跟踪上线前此处留位，不展示空列表。
        </Typography.Paragraph>
      </Card>

      <Card size="small" title="快捷入口" style={{ marginBottom: 12 }}>
        {mockShortcuts.map((item) => (
          <div key={item.id} className={styles.shortcut}>
            <div>
              <Link to={item.href}>{item.label}</Link>
              <div>
                <Typography.Text type="secondary">{item.hint}</Typography.Text>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card size="small" title="待审批建议（示例）">
        {mockSuggestions.map((item) => (
          <SuggestionCard key={item.id} suggestion={item} />
        ))}
      </Card>
    </div>
  );
}
