import type {
  AuditTrailItem,
  Category,
  DailyAlert,
  DiagnosisItem,
  ShortcutEntry,
  Site,
  Spu,
  Suggestion,
  TargetVsActual,
  TodoCounts,
} from '@/types/decision';

export const mockSites: Site[] = [
  { id: 'site-us', name: '美国站', tier: 'S' },
  { id: 'site-eu', name: '欧洲站', tier: '其他' },
];

export const mockCategories: Category[] = [
  {
    id: 'cat-dress',
    name: '连衣裙',
    majorCategory: '衣服',
    gradient: '第一重点',
    ownerSiteId: 'site-us',
  },
  {
    id: 'cat-coat',
    name: '外套',
    majorCategory: '衣服',
    gradient: '第二重点',
    ownerSiteId: 'site-us',
  },
  {
    id: 'cat-bridal',
    name: '婚纱礼服',
    majorCategory: '衣服',
    gradient: '常规',
    ownerSiteId: 'site-us',
  },
  {
    id: 'cat-sneaker',
    name: '运动鞋',
    majorCategory: '鞋子+ACC',
    gradient: '第一重点',
    ownerSiteId: 'site-us',
  },
  {
    id: 'cat-bag',
    name: '包包',
    majorCategory: '鞋子+ACC',
    gradient: '小品类',
    ownerSiteId: 'site-eu',
  },
];

export const mockSpus: Spu[] = [
  {
    id: 'SPU-1001',
    name: '碎花吊带连衣裙',
    categoryId: 'cat-dress',
    lifecycle: '在售期',
    grade: 'A',
    trend: '下降',
    disposition: '优化',
  },
  {
    id: 'SPU-1002',
    name: '通勤西装外套',
    categoryId: 'cat-coat',
    lifecycle: '在售期',
    grade: 'B',
    trend: '平稳',
    disposition: '保持',
  },
  {
    id: 'SPU-2001',
    name: '厚底运动鞋',
    categoryId: 'cat-sneaker',
    lifecycle: '新品期',
    grade: '—',
    trend: '上升',
    disposition: '保持',
  },
  {
    id: 'SPU-2002',
    name: '迷你斜挎包',
    categoryId: 'cat-bag',
    lifecycle: '在售期',
    grade: 'C',
    trend: '下降',
    disposition: '观察',
  },
];

export const mockSuggestions: Suggestion[] = [
  {
    id: 'sug-swap-1',
    objectType: 'SPU',
    objectId: 'SPU-1001',
    objectName: '碎花吊带连衣裙',
    sourceLabel: '表现驱动',
    evidence: [
      { rule: 'CTR 连续 14 天低于品类中位 20%', data: 'CTR 1.1% vs 品类 1.6%' },
      { rule: '加购率环比下滑', data: '近 7 日 −18%' },
    ],
    action: '换主图',
    params: '目标风格：花园 · 置信度 0.78',
    module: '换图',
  },
  {
    id: 'sug-disp-1',
    objectType: 'SPU',
    objectId: 'SPU-2002',
    objectName: '迷你斜挎包',
    sourceLabel: '治理驱动',
    evidence: [
      { rule: '观察态停留超过上限', data: '已停留 46 天 / 上限 30 天' },
      { rule: '动销走低', data: '近 30 天销量 3' },
    ],
    action: '下架建议',
    params: '终审：运营负责人',
    module: '处置',
  },
  {
    id: 'sug-node-1',
    objectType: '节点',
    objectId: 'node-bfcm',
    objectName: '黑五全站大促 2026',
    sourceLabel: '事件驱动',
    evidence: [
      { rule: '日历型节点待确认', data: '预计拐点 W46 · 触发链尚未排期' },
    ],
    action: '确认节点实例',
    params: '确认后生成触发链初稿',
    module: '节点确认',
  },
];

export const mockDailyAlerts: DailyAlert[] = [
  {
    id: 'alert-guardrail-1',
    kind: '红线触线',
    title: '客诉率触线 · 连衣裙',
    detail: '全站客诉率 1.4%，超过红线 1.2%；连衣裙贡献最大。',
    href: '/decision/cockpit/cat-dress',
  },
  {
    id: 'alert-chain-1',
    kind: '触发链延误',
    title: '黑五素材准备环延误',
    detail: '节点「黑五全站大促 2026」素材准备应于本周触发，当前仍为待排期。',
    href: '/decision/planning/nodes/node-bfcm',
  },
];

export const mockTodoCounts: TodoCounts = {
  swap: 6,
  disposition: 3,
  nodeConfirm: 2,
};

export const mockShortcuts: ShortcutEntry[] = [
  {
    id: 'sc-cat-dress',
    label: '连衣裙驾驶舱',
    href: '/decision/cockpit/cat-dress',
    hint: '我负责的品类',
  },
  {
    id: 'sc-cat-list',
    label: '美国站品类列表',
    href: '/decision/categories',
    hint: '站点直达',
  },
  {
    id: 'sc-plan',
    label: '品类规划表',
    href: '/decision/planning/table',
    hint: '本季锁定版',
  },
];

export const mockTargetVsActual: TargetVsActual[] = [
  {
    id: 'tva-north-star',
    title: '北极星进度',
    targetValue: 'GMV 1.20 亿 / 利润 0.18 亿',
    targetVersion: '年度规划 v2026',
    actualValue: 'GMV 0.31 亿 / 利润 0.04 亿',
    actualAsOf: '2026-03-31',
    actual口径: 'GMV 含税不含退款（指标树）',
    gap: '进度慢 4.2 pt',
    achievementRate: 26,
    status: '黄',
    momDirection: 'up',
    source: '自动',
  },
  {
    id: 'tva-structure',
    title: '结构',
    targetValue: '美国 55% / 其他 45%',
    targetVersion: '年度规划 v2026 · 结构篇',
    actualValue: '美国 61% / 其他 39%',
    actualAsOf: '2026-03-31',
    gap: '美国超贡献 +6 pt',
    achievementRate: 89,
    status: '红',
    momDirection: 'down',
    source: '自动',
  },
  {
    id: 'tva-guardrail',
    title: '红线总览',
    targetValue: '客诉率红线 1.2%',
    targetVersion: '红线登记 v3',
    actualValue: '客诉率 1.4%',
    actualAsOf: '2026-03-28',
    gap: '超红线 0.2 pt',
    achievementRate: 0,
    status: '红',
    momDirection: 'up',
    source: '自动',
  },
  {
    id: 'tva-leading',
    title: '领先指标',
    targetValue: '新品成功率 40%',
    targetVersion: '季度锁定版 v2026Q1',
    actualValue: '36%',
    actualAsOf: '2026-03-31',
    gap: '−4 pt',
    achievementRate: 90,
    status: '黄',
    momDirection: 'flat',
    source: '自动',
  },
];

export const mockAuditTrail: AuditTrailItem[] = [
  {
    id: 'audit-1',
    operator: '张运营',
    time: '2026-03-28 14:20',
    type: '批准换图',
    basis: 'CTR 失配规则 · 候选 sug-swap-1',
    from: '通勤',
    to: '花园',
    version: '配置 v12',
  },
  {
    id: 'audit-2',
    operator: '李运营负责人',
    time: '2026-03-21 10:05',
    type: '下架终审',
    basis: '观察态超时 + 动销走低',
    from: '观察',
    to: '下架建议中',
    version: '对象层 v4',
  },
  {
    id: 'audit-3',
    operator: '王管理层',
    time: '2026-01-12 16:40',
    type: '锁定年度规划',
    basis: '年会决议',
    from: '草稿',
    to: '已锁定',
    version: '年度规划 v2026',
  },
];

export const mockDiagnoses: DiagnosisItem[] = [
  {
    id: 'diag-result',
    dimension: '经营结果',
    status: '正常',
  },
  {
    id: 'diag-concentration',
    dimension: '等级与集中度',
    status: '提示',
    triggerRule: 'Top1 占比超自身 12 个月 P90',
    evidenceLabel: 'Top1 22%（P90=18%）',
    evidenceHref: '/decision/cockpit/cat-dress',
    actionLabel: '第二梯队培养',
    actionHref: '/decision/workbench/disposition',
  },
  {
    id: 'diag-guardrail',
    dimension: '服务与交付红线',
    status: '预警',
    triggerRule: '客诉率触线',
    evidenceLabel: '1.4% > 红线 1.2%',
    evidenceHref: '/decision/overview',
    actionLabel: '升级处理',
    actionHref: '/decision/workbench',
  },
];

export const SAMPLE_CATEGORY_ID = 'cat-dress';
export const SAMPLE_NODE_ID = 'node-bfcm';
export const SAMPLE_SPU_ID = 'SPU-1001';
