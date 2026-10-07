import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { Card, Tag, Typography } from 'antd';
import type { MomDirection, TrafficLight } from '@/types/decision';
import styles from './index.module.css';

const STATUS_COLOR: Record<TrafficLight, string> = {
  绿: 'success',
  黄: 'warning',
  红: 'error',
};

export interface TargetVsActualPanelProps {
  title: string;
  targetValue: string;
  targetVersion: string;
  actualValue: string;
  actualAsOf: string;
  actual口径?: string;
  gap: string;
  achievementRate: number;
  status: TrafficLight;
  momDirection: MomDirection;
  source?: '自动' | '人工填报';
}

function MomArrow({ direction }: { direction: MomDirection }) {
  if (direction === 'up') return <ArrowUpOutlined className={styles.up} />;
  if (direction === 'down') return <ArrowDownOutlined className={styles.down} />;
  return <MinusOutlined className={styles.flat} />;
}

export function TargetVsActualPanel({
  title,
  targetValue,
  targetVersion,
  actualValue,
  actualAsOf,
  actual口径,
  gap,
  achievementRate,
  status,
  momDirection,
  source,
}: TargetVsActualPanelProps) {
  return (
    <Card size="small" title={title} extra={<Tag color={STATUS_COLOR[status]}>{status}</Tag>}>
      <div className={styles.grid}>
        <div>
          <Typography.Text type="secondary">目标</Typography.Text>
          <div className={styles.value}>{targetValue}</div>
          <Typography.Text type="secondary">来源版本：{targetVersion}</Typography.Text>
        </div>
        <div>
          <Typography.Text type="secondary">现状</Typography.Text>
          <div className={styles.value}>{actualValue}</div>
          <Typography.Text type="secondary">
            截至 {actualAsOf}
            {actual口径 ? ` · ${actual口径}` : ''}
          </Typography.Text>
        </div>
      </div>
      <div className={styles.meta}>
        <span>差距 {gap}</span>
        <span>达成率 {achievementRate}%</span>
        <span>
          环比 <MomArrow direction={momDirection} />
        </span>
        {source ? <Tag>{source}</Tag> : null}
      </div>
    </Card>
  );
}
