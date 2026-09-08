import { Typography } from 'antd';
import styles from './index.module.css';

interface PagePlaceholderProps {
  title: string;
  description: string;
  section: string;
}

export function PagePlaceholder({ title, description, section }: PagePlaceholderProps) {
  return (
    <div className={styles.page}>
      <Typography.Title level={4} className={styles.title}>
        {title}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      <Typography.Text type="secondary">需求文档：第 {section} 节</Typography.Text>
    </div>
  );
}
