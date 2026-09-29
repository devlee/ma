import { Card, Tabs, Typography } from 'antd';
import { DecisionPageHeader } from '@/components/decision/PageHeader';
import { AuditTrail } from '@/components/decision/AuditTrail';
import { mockAuditTrail } from '@/mocks/decision';
import { getDecisionPage } from '../registry';

const MODULES = [
  {
    key: 'swap',
    label: '换图',
    cards: ['参数配置（全局 + 品类覆盖）', '版本历史'],
  },
  {
    key: 'object',
    label: '对象层',
    cards: ['等级防抖', '趋势参数', '观察检视与停留上限', '新品配置包（全局 + 品类覆盖）'],
  },
  {
    key: 'cockpit',
    label: '驾驶舱',
    cards: ['诊断阈值', '集中度分位参数', '快照日', '素材目标（v1 静态）'],
  },
  {
    key: 'planning',
    label: '规划',
    cards: ['节点拐点识别与提前量', '月度调整窗口 / 目标变更审批', '产能池预留比 / 站点单独账门槛', '预案升级条件'],
  },
  {
    key: 'strategy',
    label: '战略',
    cards: ['品类梯度档位枚举', '梯度策略包', '营销占比上限红线', '假设检验周期', '护栏红线值'],
  },
] as const;

export default function ConfigCenter() {
  const page = getDecisionPage('config');
  if (!page) return null;

  return (
    <div style={{ paddingBottom: 24 }}>
      <DecisionPageHeader title={page.title} board={page.board} sourceDoc={page.sourceDoc} />
      <Card size="small">
        <Tabs
          items={MODULES.map((mod) => ({
            key: mod.key,
            label: mod.label,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {mod.cards.map((title) => (
                  <Card key={title} size="small" title={title}>
                    <Typography.Text type="secondary">待实现</Typography.Text>
                  </Card>
                ))}
                {mod.key === 'swap' ? (
                  <Card size="small" title="变更留痕（组件示例）">
                    <AuditTrail items={mockAuditTrail} />
                  </Card>
                ) : null}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
}
