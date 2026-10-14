import { Timeline, Typography } from 'antd';
import type { AuditTrailItem } from '@/types/decision';
import styles from './index.module.css';

export interface AuditTrailProps {
  items: AuditTrailItem[];
}

export function AuditTrail({ items }: AuditTrailProps) {
  if (!items.length) {
    return <Typography.Text type="secondary">暂无留痕</Typography.Text>;
  }

  return (
    <Timeline
      items={items.map((item) => ({
        key: item.id,
        children: (
          <div className={styles.item}>
            <div className={styles.head}>
              <Typography.Text strong>{item.operator}</Typography.Text>
              <Typography.Text type="secondary">{item.time}</Typography.Text>
              <span className={styles.type}>{item.type}</span>
            </div>
            <div>依据：{item.basis}</div>
            <div>
              {item.from} → {item.to}
              {item.version ? <Typography.Text type="secondary"> · {item.version}</Typography.Text> : null}
            </div>
          </div>
        ),
      }))}
    />
  );
}
