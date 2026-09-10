import { Select } from 'antd';
import type { CSSProperties } from 'react';
import type { Angle, CrowdTag, Material } from '@/types/buyer-show';
import { filterRefLibrary, isUploadedSlot } from '@/utils/buyer-show';

interface MaterialPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  materials: Material[];
  allowEmpty?: boolean;
  emptyLabel?: string;
  style?: CSSProperties;
  category?: string;
  crowdTag?: CrowdTag;
  angle?: Angle;
}

export function MaterialPicker({
  value,
  onChange,
  materials,
  allowEmpty = true,
  emptyLabel = '从参考图库选择',
  style,
  category,
  crowdTag,
  angle,
}: MaterialPickerProps) {
  const scoped = Boolean(category && angle);
  const enabled =
    category && crowdTag && angle
      ? filterRefLibrary(materials, category, crowdTag, angle)
      : scoped
        ? []
        : materials.filter((m) => m.status === '启用');
  const missing = scoped && !crowdTag
    ? '请先选择标签再调库'
    : category && crowdTag && angle
      ? `图库暂无 ${category}-${crowdTag}-${angle}，请到配置管理·图库补充`
      : '暂无参考图';
  return (
    <Select
      value={value || undefined}
      onChange={(v) => onChange?.(v ?? '')}
      allowClear={allowEmpty}
      placeholder={emptyLabel}
      style={{ minWidth: 180, ...style }}
      options={[
        ...(value && isUploadedSlot(value) ? [{ value, label: value }] : []),
        ...enabled.map((m) => ({
          value: m.id,
          label: `${m.id} · ${m.category}/${m.crowdTag}/${m.angle}`,
        })),
      ]}
      showSearch
      optionFilterProp="label"
      notFoundContent={missing}
    />
  );
}
