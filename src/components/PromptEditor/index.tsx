import { Input } from 'antd';
import type { ReactNode } from 'react';
import { splitPromptSlots } from '@/utils/buyer-show';
import styles from './index.module.css';

interface PromptEditorProps {
  value: string;
  onChange?: (value: string) => void;
  editable?: boolean;
  rows?: number;
}

function highlightSlots(text: string): ReactNode[] {
  const parts = splitPromptSlots(text);
  return parts.map((part, i) =>
    part.startsWith('{') && part.endsWith('}') ? (
      <span key={i} className={styles.slot}>
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function PromptEditor({ value, onChange, editable, rows = 6 }: PromptEditorProps) {
  return (
    <div>
      <div className={styles.preview}>{highlightSlots(value) || '—'}</div>
      {editable ? (
        <Input.TextArea
          className={styles.editor}
          rows={rows}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : null}
    </div>
  );
}
