/**
 * 经营决策系统核心类型。
 * 对齐《全局信息架构与通用规范》《系统结构总览》及各模块需求文档。
 */

/** 决策系统角色（《全局信息架构》2.1；品类负责人为暂不设的禁用态） */
export type DecisionRole =
  | '管理层'
  | '运营负责人'
  | '站点Owner'
  | '运营'
  | '风格库负责人'
  | '板块填报Owner'
  | '管理员'
  | '品类负责人';

export const DECISION_ROLES: DecisionRole[] = [
  '管理层',
  '运营负责人',
  '站点Owner',
  '运营',
  '风格库负责人',
  '板块填报Owner',
  '管理员',
  '品类负责人',
];

export const DISABLED_DECISION_ROLES: ReadonlySet<DecisionRole> = new Set(['品类负责人']);

/** 一级导航六板块（《全局信息架构》1.1） */
export type DecisionBoard = '总盘' | '规划' | '品类' | '工作台' | '资产' | '配置中心';

export const DECISION_BOARDS: DecisionBoard[] = ['总盘', '规划', '品类', '工作台', '资产', '配置中心'];

/** 大类：静态归类（《战略目标层》2 / 5.3） */
export type MajorCategory = '衣服' | '鞋子+ACC';

/** 品类梯度：大类内划分（《战略目标层》5.3） */
export type CategoryGradient = '第一重点' | '第二重点' | '常规' | '小品类';

export type SiteTier = 'S' | '其他';

export type LifecycleStatus = '新品期' | '在售期' | '退场';

/** 处置态四态（《商品对象层》6.1） */
export type DispositionStatus = '保持' | '优化' | '观察' | '下架建议中';

export type TrendTag = '上升' | '平稳' | '下降';

/** 建议卡片来源标签（《全局信息架构》3.1） */
export type SuggestionSource =
  | '表现驱动'
  | '判定驱动'
  | '治理驱动'
  | '事件驱动'
  | '人工提报'
  | '结构信号';

export type SuggestionObjectType = 'SPU' | '品类' | '节点';

export type SuggestionModule = '换图' | '处置' | '节点确认';

/** 目标 vs 现状 红黄绿（《全局信息架构》3.2） */
export type TrafficLight = '红' | '黄' | '绿';

export type MomDirection = 'up' | 'down' | 'flat';

export type MetricSourceKind = '自动' | '人工填报';

/** 诊断结论三级（《全局信息架构》3.4） */
export type DiagnosisLevel = '正常' | '提示' | '预警';

/** 日级预警（《全局信息架构》4） */
export type DailyAlertKind = '红线触线' | '触发链延误';

export interface Site {
  id: string;
  name: string;
  tier: SiteTier;
}

export interface Category {
  id: string;
  name: string;
  majorCategory: MajorCategory;
  gradient: CategoryGradient;
  ownerSiteId: string;
}

export interface Spu {
  id: string;
  name: string;
  categoryId: string;
  lifecycle: LifecycleStatus;
  grade: string;
  trend: TrendTag;
  disposition: DispositionStatus;
}

export interface SuggestionEvidence {
  rule: string;
  data: string;
}

export interface Suggestion {
  id: string;
  objectType: SuggestionObjectType;
  objectId: string;
  objectName: string;
  sourceLabel: SuggestionSource;
  evidence: SuggestionEvidence[];
  action: string;
  params?: string;
  module: SuggestionModule;
}

export interface DailyAlert {
  id: string;
  kind: DailyAlertKind;
  title: string;
  detail: string;
  href: string;
}

export interface TodoCounts {
  swap: number;
  disposition: number;
  nodeConfirm: number;
}

export interface ShortcutEntry {
  id: string;
  label: string;
  href: string;
  hint: string;
}

export interface TargetVsActual {
  id: string;
  title: string;
  targetValue: string;
  targetVersion: string;
  actualValue: string;
  actualAsOf: string;
  actual口径?: string;
  gap: string;
  achievementRate: number;
  status: TrafficLight;
  momDirection: MomDirection;
  source?: MetricSourceKind;
}

export interface AuditTrailItem {
  id: string;
  operator: string;
  time: string;
  type: string;
  basis: string;
  from: string;
  to: string;
  version?: string;
}

export interface DiagnosisItem {
  id: string;
  dimension: string;
  status: DiagnosisLevel;
  triggerRule?: string;
  evidenceLabel?: string;
  evidenceHref?: string;
  actionLabel?: string;
  actionHref?: string;
}
