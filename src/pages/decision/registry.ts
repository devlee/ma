import type { DecisionBoard, DecisionRole } from '@/types/decision';
import { DECISION_ROLES } from '@/types/decision';
import { SAMPLE_CATEGORY_ID, SAMPLE_NODE_ID, SAMPLE_SPU_ID } from '@/mocks/decision';

export type SectionDemo =
  | 'placeholder'
  | 'target-vs-actual'
  | 'diagnosis'
  | 'audit'
  | 'suggestion'
  | 'portrait-eight';

export interface PageSection {
  title: string;
  reserved?: boolean;
  demo?: SectionDemo;
}

export type DecisionPageKind = 'stub' | 'todo' | 'config';

export interface DecisionPageDef {
  id: string;
  /** 相对 /decision 的路由 path（可含 :param） */
  path: string;
  title: string;
  board: DecisionBoard;
  /** 1.1 双入口：同一页面出现在多个板块 */
  extraMenuBoards?: DecisionBoard[];
  sourceDoc: string;
  roles: DecisionRole[];
  sections: PageSection[];
  kind?: DecisionPageKind;
  /** 侧栏可见；参数页用 navPath 指向示例实例 */
  navVisible?: boolean;
  navPath?: string;
  menuGroup?: string;
}

const VIEW_ROLES: DecisionRole[] = ['管理层', '运营负责人', '站点Owner', '运营'];
const SWAP_ROLES: DecisionRole[] = [...VIEW_ROLES, '风格库负责人'];
const OBJECT_ROLES: DecisionRole[] = [...VIEW_ROLES, '风格库负责人'];
const STYLE_ROLES: DecisionRole[] = ['管理层', '运营负责人', '运营', '风格库负责人'];
const METRIC_ROLES: DecisionRole[] = ['管理层', '运营负责人', '站点Owner', '运营', '管理员'];

export const DECISION_PAGES: DecisionPageDef[] = [
  {
    id: 'overview',
    path: 'overview',
    title: '总盘驾驶舱',
    board: '总盘',
    sourceDoc: '战略目标层需求 · 第 8 节',
    roles: ['管理层', '运营负责人', '站点Owner'],
    sections: [
      { title: '北极星进度', demo: 'target-vs-actual' },
      { title: '结构', demo: 'target-vs-actual' },
      { title: '红线总览', demo: 'target-vs-actual' },
      { title: '先行指标', demo: 'target-vs-actual' },
    ],
  },
  {
    id: 'annual-plan',
    path: 'annual-plan',
    title: '年度规划',
    board: '总盘',
    sourceDoc: '战略目标层需求 · 第 5 节',
    roles: ['管理层', '运营负责人', '站点Owner'],
    sections: [{ title: '目标篇' }, { title: '结构篇' }, { title: '策略篇' }, { title: '锁定与版本' }],
  },
  {
    id: 'hypotheses',
    path: 'hypotheses',
    title: '战略假设清单',
    board: '总盘',
    extraMenuBoards: ['资产'],
    sourceDoc: '战略目标层需求 · 第 4 节',
    roles: ['管理层', '运营负责人', '站点Owner'],
    sections: [{ title: '假设登记' }, { title: '季检工作台' }, { title: '证伪回调导航' }],
  },
  {
    id: 'planning-table',
    path: 'planning/table',
    title: '品类规划表',
    board: '规划',
    sourceDoc: '品类规划需求 · 第 4 节',
    roles: VIEW_ROLES,
    sections: [{ title: '站点×品类表格区' }, { title: '锁定与版本区' }],
  },
  {
    id: 'node-calendar',
    path: 'planning/calendar',
    title: '节点日历',
    board: '规划',
    sourceDoc: '品类规划需求 · 第 5 节',
    roles: VIEW_ROLES,
    sections: [{ title: '年视图（52 周 × 品类）' }, { title: '触发链进度' }],
  },
  {
    id: 'node-detail',
    path: 'planning/nodes/:nodeId',
    navPath: `planning/nodes/${SAMPLE_NODE_ID}`,
    title: '节点实例详情',
    board: '规划',
    sourceDoc: '品类规划需求 · 第 5 / 10.3 节',
    roles: VIEW_ROLES,
    sections: [{ title: '曲线证据' }, { title: '触发链状态' }, { title: '叠加包' }, { title: '复盘记录' }],
  },
  {
    id: 'playbooks',
    path: 'planning/playbooks',
    title: '预案库',
    board: '规划',
    extraMenuBoards: ['资产'],
    sourceDoc: '品类规划需求 · 第 6 节',
    roles: VIEW_ROLES,
    sections: [{ title: '模板列表' }, { title: '编辑区' }, { title: '复盘修订记录' }],
  },
  {
    id: 'capacity',
    path: 'planning/capacity',
    title: '产能账',
    board: '规划',
    sourceDoc: '品类规划需求 · 第 8 节',
    roles: VIEW_ROLES,
    sections: [{ title: '三级账视图' }, { title: '对账结论' }, { title: '调剂操作' }],
  },
  {
    id: 'category-list',
    path: 'categories',
    title: '品类列表',
    board: '品类',
    sourceDoc: '品类驾驶舱需求 · 第 9 节',
    roles: VIEW_ROLES,
    sections: [{ title: '按大类分组' }, { title: '梯度排序与站点过滤' }, { title: '健康状态概览' }],
  },
  {
    id: 'category-cockpit',
    path: 'cockpit/:categoryId',
    navPath: `cockpit/${SAMPLE_CATEGORY_ID}`,
    title: '品类驾驶舱',
    board: '品类',
    sourceDoc: '品类驾驶舱需求 · 第 3–6 节',
    roles: VIEW_ROLES,
    sections: [
      { title: '画像区（八个常驻面板）', demo: 'portrait-eight' },
      { title: '诊断结论区', demo: 'diagnosis' },
      { title: '决策区' },
      { title: '规划区', reserved: true },
      { title: '节点区', reserved: true },
    ],
  },
  {
    id: 'snapshots',
    path: 'snapshots',
    title: '月度快照归档',
    board: '品类',
    sourceDoc: '品类驾驶舱需求 · 第 7 节',
    roles: VIEW_ROLES,
    sections: [{ title: '历史快照浏览' }, { title: '快照对比' }, { title: '月会分册导出' }],
  },
  {
    id: 'todo-center',
    path: 'workbench',
    title: '个人待办中心',
    board: '工作台',
    sourceDoc: '灵策总纲 · 10.6 节',
    roles: DECISION_ROLES,
    kind: 'todo',
    sections: [{ title: '预警区' }, { title: '待办区' }, { title: '上次决议区', reserved: true }, { title: '快捷入口区' }],
  },
  {
    id: 'swap-candidates',
    path: 'workbench/swap/candidates',
    title: '换图工作台 · 候选审批',
    board: '工作台',
    sourceDoc: '换图决策需求 · 第 11 节',
    roles: SWAP_ROLES,
    menuGroup: '换图工作台',
    sections: [{ title: '候选名单', demo: 'suggestion' }, { title: '批量操作' }],
  },
  {
    id: 'swap-in-progress',
    path: 'workbench/swap/in-progress',
    title: '换图工作台 · 进行中',
    board: '工作台',
    sourceDoc: '换图决策需求 · 第 11 节',
    roles: SWAP_ROLES,
    menuGroup: '换图工作台',
    sections: [{ title: '执行状态' }, { title: '推送时间戳确认' }],
  },
  {
    id: 'swap-results',
    path: 'workbench/swap/results',
    title: '换图工作台 · 判定结果',
    board: '工作台',
    sourceDoc: '换图决策需求 · 第 7 / 11 节',
    roles: SWAP_ROLES,
    menuGroup: '换图工作台',
    sections: [{ title: '五态列表' }, { title: '回滚待批队列' }, { title: '收投放待批队列' }],
  },
  {
    id: 'judgment-report',
    path: 'workbench/reports',
    title: '判定报告',
    board: '工作台',
    extraMenuBoards: ['资产'],
    sourceDoc: '换图决策需求 · 第 7.5 节',
    roles: SWAP_ROLES,
    sections: [{ title: '起效率拆解' }, { title: '事件时间曲线' }, { title: 'Top 款集中度' }, { title: '建议质量' }],
  },
  {
    id: 'disposition',
    path: 'workbench/disposition',
    title: '处置建议审批',
    board: '工作台',
    sourceDoc: '商品对象层需求 · 第 6 / 8 节',
    roles: VIEW_ROLES,
    sections: [{ title: '周度建议名单', demo: 'suggestion' }, { title: '下架终审队列' }],
  },
  {
    id: 'new-products',
    path: 'workbench/new-products',
    title: '新品里程碑看板',
    board: '工作台',
    sourceDoc: '商品对象层需求 · 第 7 节',
    roles: VIEW_ROLES,
    sections: [{ title: '检查点状态' }, { title: '保护期倒计时' }, { title: '提前毕业与延期操作' }],
  },
  {
    id: 'product-overview',
    path: 'workbench/products',
    title: '商品对象总览',
    board: '工作台',
    sourceDoc: '商品对象层需求 · 第 8 节',
    roles: OBJECT_ROLES,
    sections: [{ title: '分布视图' }, { title: '下钻列表' }, { title: '等级与处置迁移动态' }],
  },
  {
    id: 'spu-360',
    path: 'workbench/spu/:spuId',
    navPath: `workbench/spu/${SAMPLE_SPU_ID}`,
    title: 'SPU 360 详情',
    board: '工作台',
    sourceDoc: '灵策总纲 · 10.6 节',
    roles: OBJECT_ROLES,
    sections: [
      { title: '当前状态' },
      { title: '历史时间线', demo: 'audit' },
      { title: '指标曲线' },
      { title: '素材档案' },
    ],
  },
  {
    id: 'style-library',
    path: 'assets/style-library',
    title: '风格库计分卡',
    board: '资产',
    sourceDoc: '换图决策需求 · 第 9 节',
    roles: STYLE_ROLES,
    sections: [{ title: '计分卡列表' }, { title: '生命周期与迁移待批' }, { title: '缺口预警' }, { title: '验证期进度' }],
  },
  {
    id: 'metric-tree',
    path: 'assets/metrics',
    title: '指标树管理',
    board: '资产',
    sourceDoc: '战略目标层需求 · 第 6 节',
    roles: METRIC_ROLES,
    sections: [{ title: '口径字典' }, { title: '认领登记' }, { title: '分解关系维护' }],
  },
  {
    id: 'leading-report',
    path: 'assets/leading-indicators',
    title: '先行指标填报',
    board: '资产',
    sourceDoc: '战略目标层需求 · 第 6.3 节',
    roles: ['板块填报Owner', '管理层', '管理员'],
    sections: [{ title: '营销填报' }, { title: '供应链填报' }, { title: '客服填报' }],
  },
  {
    id: 'config',
    path: 'config',
    title: '配置中心',
    board: '配置中心',
    sourceDoc: '灵策总纲 · 第 6 节',
    roles: DECISION_ROLES,
    kind: 'config',
    sections: [
      { title: '换图' },
      { title: '对象层' },
      { title: '驾驶舱' },
      { title: '规划' },
      { title: '战略' },
    ],
  },
];

/** 侧栏顺序：1.1 六板块 + 1.2 补入页面（先行指标填报、年度规划、节点实例、SPU 360） */
export const MENU_BY_BOARD: Record<DecisionBoard, string[]> = {
  总盘: ['overview', 'annual-plan', 'hypotheses'],
  规划: ['planning-table', 'node-calendar', 'node-detail', 'playbooks', 'capacity'],
  品类: ['category-list', 'category-cockpit', 'snapshots'],
  工作台: [
    'todo-center',
    'swap-candidates',
    'swap-in-progress',
    'swap-results',
    'judgment-report',
    'disposition',
    'new-products',
    'product-overview',
    'spu-360',
  ],
  资产: ['style-library', 'playbooks', 'hypotheses', 'metric-tree', 'judgment-report', 'leading-report'],
  配置中心: ['config'],
};

export const ROLE_HOME: Record<DecisionRole, string> = {
  管理层: '/decision/overview',
  运营负责人: '/decision/workbench',
  站点Owner: '/decision/categories',
  运营: '/decision/workbench',
  风格库负责人: '/decision/assets/style-library',
  板块填报Owner: '/decision/workbench',
  管理员: '/decision/workbench',
  品类负责人: '/decision/workbench',
};

export function getDecisionPage(id: string) {
  return DECISION_PAGES.find((page) => page.id === id);
}

export function decisionHref(page: DecisionPageDef) {
  return `/decision/${page.navPath ?? page.path}`;
}
