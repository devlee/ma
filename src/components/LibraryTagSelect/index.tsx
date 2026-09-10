import { AutoComplete, Select } from 'antd';
import type { CSSProperties } from 'react';
import type { Angle, Material } from '@/types/buyer-show';
import { libraryTags } from '@/utils/buyer-show';

interface LibraryTagSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  materials: Material[];
  category?: string;
  angle?: Angle;
  allowCreate?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  style?: CSSProperties;
}

export function LibraryTagSelect({
  value,
  onChange,
  materials,
  category,
  angle,
  allowCreate = false,
  allowEmpty = true,
  emptyLabel,
  style,
}: LibraryTagSelectProps) {
  const tags = libraryTags(materials, {
    category,
    angle,
    includeDisabled: allowCreate,
  });
  const options = tags.map((t) => ({ value: t, label: t }));
  const placeholder =
    emptyLabel ??
    (tags.length
      ? allowCreate
        ? '选已有或输入新建'
        : '选择标签'
      : category || angle
        ? '该品类/角度暂无标签，请到配置管理·图库补充'
        : '选择标签');

  if (allowCreate) {
    return (
      <AutoComplete
        value={value || undefined}
        options={options}
        onChange={(v) => onChange?.(v ?? '')}
        filterOption={(input, option) => String(option?.value ?? '').includes(input)}
        placeholder={placeholder}
        style={{ minWidth: 140, ...style }}
        allowClear={allowEmpty}
      />
    );
  }

  return (
    <Select
      value={value || undefined}
      options={options}
      onChange={(v) => onChange?.(v ?? '')}
      allowClear={allowEmpty}
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      style={{ minWidth: 120, ...style }}
      notFoundContent={placeholder}
    />
  );
}
