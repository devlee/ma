import { Button, Card, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { Suggestion, SuggestionSource } from '@/types/decision';
import styles from './index.module.css';

const SOURCE_COLOR: Record<SuggestionSource, string> = {
  表现驱动: 'blue',
  判定驱动: 'purple',
  治理驱动: 'gold',
  事件驱动: 'cyan',
  人工提报: 'default',
  结构信号: 'geekblue',
};

function objectHref(suggestion: Suggestion) {
  if (suggestion.objectType === 'SPU') return `/decision/workbench/spu/${suggestion.objectId}`;
  if (suggestion.objectType === '品类') return `/decision/cockpit/${suggestion.objectId}`;
  return `/decision/planning/nodes/${suggestion.objectId}`;
}

export interface SuggestionCardProps {
  suggestion: Suggestion;
  onApprove?: (id: string) => void;
  onRevise?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function SuggestionCard({ suggestion, onApprove, onRevise, onReject }: SuggestionCardProps) {
  return (
    <Card size="small" className={styles.card}>
      <div className={styles.head}>
        <Link className={styles.object} to={objectHref(suggestion)}>
          {suggestion.objectType} · {suggestion.objectName}
          <span className={styles.objectId}>{suggestion.objectId}</span>
        </Link>
        <Tag color={SOURCE_COLOR[suggestion.sourceLabel]}>{suggestion.sourceLabel}</Tag>
      </div>

      <div className={styles.evidence}>
        {suggestion.evidence.map((row) => (
          <div key={`${row.rule}-${row.data}`} className={styles.evidenceRow}>
            <Typography.Text type="secondary">触发规则</Typography.Text>
            <span>{row.rule}</span>
            <Typography.Text type="secondary">关键数据</Typography.Text>
            <span>{row.data}</span>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        <Typography.Text strong>建议：{suggestion.action}</Typography.Text>
        {suggestion.params ? <Typography.Text type="secondary">{suggestion.params}</Typography.Text> : null}
      </div>

      <Space>
        <Button type="primary" size="small" onClick={() => onApprove?.(suggestion.id)}>
          批准
        </Button>
        <Button size="small" onClick={() => onRevise?.(suggestion.id)}>
          改选
        </Button>
        <Button danger size="small" onClick={() => onReject?.(suggestion.id)}>
          驳回
        </Button>
      </Space>
    </Card>
  );
}
