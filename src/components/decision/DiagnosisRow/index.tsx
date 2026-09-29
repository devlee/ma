import { Button, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { DiagnosisItem, DiagnosisLevel } from '@/types/decision';
import styles from './index.module.css';

const LEVEL_COLOR: Record<DiagnosisLevel, string> = {
  正常: 'success',
  提示: 'warning',
  预警: 'error',
};

export interface DiagnosisRowProps {
  item?: DiagnosisItem;
  allNormalCount?: number;
}

export function DiagnosisRow({ item, allNormalCount }: DiagnosisRowProps) {
  if (typeof allNormalCount === 'number') {
    return (
      <div className={styles.normalBanner}>
        <Tag color="success">本期正常</Tag>
        <Typography.Text>本期 {allNormalCount} 项诊断维度全部正常</Typography.Text>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className={styles.row}>
      <div className={styles.main}>
        <Typography.Text strong>{item.dimension}</Typography.Text>
        <Tag color={LEVEL_COLOR[item.status]}>{item.status}</Tag>
      </div>
      {item.status === '正常' ? (
        <Typography.Text type="secondary">本期正常</Typography.Text>
      ) : (
        <div className={styles.detail}>
          <span>触发规则：{item.triggerRule}</span>
          {item.evidenceHref ? (
            <Link to={item.evidenceHref}>{item.evidenceLabel ?? '证据'}</Link>
          ) : (
            <span>{item.evidenceLabel}</span>
          )}
          {item.actionHref ? (
            <Link to={item.actionHref}>
              <Button size="small" type="link">
                {item.actionLabel ?? '动作出口'}
              </Button>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
