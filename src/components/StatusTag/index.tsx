import { Tag } from 'antd';

const COLOR_MAP: Record<string, string> = {
  待分发: 'default',
  待领取: 'blue',
  制作中: 'geekblue',
  待提交审核: 'cyan',
  待审核: 'blue',
  返修中: 'orange',
  返修待审核: 'purple',
  待推送: 'gold',
  推送中: 'blue',
  已推送: 'green',
  推送失败: 'red',
  废弃: 'default',
  生图中: 'blue',
  生图失败: 'red',
  修改中: 'orange',
  审核失败: 'red',
  未配置: 'red',
  已配置: 'green',
  部分配置: 'gold',
  未确认: 'gold',
  已确认: 'green',
  匹配成功: 'green',
  未匹配: 'red',
  '未匹配（已人工填写）': 'gold',
  启用: 'green',
  停用: 'default',
  质检图: 'blue',
  商品图: 'cyan',
  商品图兜底: 'gold',
  参考图: 'geekblue',
  其他: 'default',
  手动: 'purple',
  批量制作: 'geekblue',
  单个制作: 'magenta',
  未指定: 'default',
  单人: 'cyan',
  多人: 'purple',
};

interface StatusTagProps {
  value?: string;
}

export function StatusTag({ value }: StatusTagProps) {
  if (!value) return <span>—</span>;
  return <Tag color={COLOR_MAP[value] ?? 'default'}>{value}</Tag>;
}
