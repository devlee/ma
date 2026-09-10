import type { Angle, MainTaskStatus, ProduceMode, SubtaskStatus } from '@/types/buyer-show';

export const ANGLES: Angle[] = ['正面', '侧面', '背面', '半身'];

export const MAIN_STATUSES: MainTaskStatus[] = [
  '待分发',
  '待领取',
  '制作中',
  '待提交审核',
  '待审核',
  '返修中',
  '返修待审核',
  '待推送',
  '推送中',
  '已推送',
  '推送失败',
  '废弃',
];

export const SUB_STATUSES: SubtaskStatus[] = [
  '生图中',
  '生图失败',
  '待提交审核',
  '修改中',
  '待审核',
  '返修待审核',
  '审核失败',
  '待推送',
  '推送中',
  '已推送',
  '推送失败',
  '废弃',
];

export const PRODUCE_MODES: ProduceMode[] = ['批量制作', '单个制作'];

export const QC_STATUSES = ['未配置', '已配置', '部分配置'] as const;

export const CONSISTENCY_STATUSES = ['未确认', '已确认'] as const;

/** 快捷筛「高销」阈值（近 30 天销量，mock 口径） */
export const HIGH_SALES_THRESHOLD = 200;

export const DESIGNERS = ['付新玲', '李梦', '王可'] as const;

export const CATEGORIES = ['连衣裙', '外套', '衬衫', '半身裙', '裤子'] as const;

/** 演示用当前设计账号，对应原型里的「我」 */
export const CURRENT_DESIGNER = '付新玲';

export const CURRENT_OPERATOR = '张运营';

export const DEFAULT_SUBTASK_ID = 'BST-260907-0011-01';
