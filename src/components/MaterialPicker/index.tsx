import { Select } from 'antd';
import type { CSSProperties } from 'react';
import type { Material } from '@/types/buyer-show';

interface MaterialPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  materials: Material[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  style?: CSSProperties;
}

export function MaterialPicker({
  value,
  onChange,
  materials,
  allowEmpty = true,
  emptyLabel = '从素材库选择',
  style,
}: MaterialPickerProps) {
  const enabled = materials.filter((m) => m.status === '启用');
  return (
    <Select
      value={value || undefined}
      onChange={(v) => onChange?.(v ?? '')}
      allowClear={allowEmpty}
      placeholder={emptyLabel}
      style={{ minWidth: 180, ...style }}
      options={enabled.map((m) => ({
        value: m.id,
        label: `${m.id} · ${m.crowdTag}`,
      }))}
      showSearch
      optionFilterProp="label"
    />
  );
}
