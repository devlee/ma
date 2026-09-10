import { Button, Space } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES } from '@/constants/buyer-show';
import type { InspectionImageStatus, InspectionImages } from '@/types/buyer-show';
import { deriveQcStatus, qcSlotCount } from '@/utils/buyer-show';
import styles from './index.module.css';

interface QcImageEditorProps {
  value: InspectionImages;
  onChange?: (next: InspectionImages) => void;
  readOnly?: boolean;
}

export function QcImageEditor({ value, onChange, readOnly }: QcImageEditorProps) {
  const toggle = (angle: (typeof ANGLES)[number]) => {
    if (readOnly || !onChange) return;
    const next = { ...value };
    if (next[angle]) delete next[angle];
    else next[angle] = `qc-${angle}`;
    onChange(next);
  };

  return (
    <div className={styles.slots}>
      {ANGLES.map((angle) => {
        const filled = Boolean(value[angle]);
        return (
          <div key={angle} className={`${styles.slot} ${filled ? styles.slotFilled : ''}`}>
            <ImagePlaceholder
              label={filled ? `已上传·${angle}` : readOnly ? `未配置·${angle}` : '点击上传/选择'}
              kind={filled ? 'qc' : ''}
              size="fluid"
            />
            <div style={{ margin: '8px 0' }}>
              <b>{angle}</b>
            </div>
            {readOnly ? null : (
              <Button size="small" onClick={() => toggle(angle)}>
                {filled ? '移除' : '上传/选择'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function QcCoverageTag({ images, status }: { images?: InspectionImages; status?: InspectionImageStatus }) {
  const derived = status ?? deriveQcStatus(images);
  const n = qcSlotCount(images);
  return (
    <Space size={6}>
      <StatusTag value={derived} />
      <span>
        {n}/4
        <span className={styles.dots} style={{ marginLeft: 6 }}>
          {ANGLES.map((angle) => (
            <span
              key={angle}
              title={angle}
              className={`${styles.dot} ${images?.[angle] ? styles.dotOn : ''}`}
            />
          ))}
        </span>
      </span>
    </Space>
  );
}
