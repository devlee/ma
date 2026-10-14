import { Tag, Typography } from 'antd';
import type { DecisionBoard } from '@/types/decision';
import styles from './index.module.css';

const BOARD_TAG_COLOR: Record<DecisionBoard, string> = {
  总盘: 'geekblue',
  蓝图: 'cyan',
  商品: 'purple',
  工作台: 'blue',
  资产: 'gold',
  配置中心: 'default',
};

interface DecisionPageHeaderProps {
  title: string;
  board: DecisionBoard;
  sourceDoc: string;
}

export function DecisionPageHeader({ title, board, sourceDoc }: DecisionPageHeaderProps) {
  return (
    <div className={styles.head}>
      <div className={styles.titleRow}>
        <Typography.Title level={4} className={styles.title}>
          {title}
        </Typography.Title>
        <Tag color={BOARD_TAG_COLOR[board]}>{board}</Tag>
      </div>
      <Typography.Text type="secondary">来源文档：{sourceDoc}</Typography.Text>
    </div>
  );
}
