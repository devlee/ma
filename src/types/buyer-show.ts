/**
 * 买家秀管理领域类型。
 * 状态对齐需求第 8 节；字段取自第 4.3 / 6.1.3 / 6.4 / 11 节。
 */

/** 主任务状态（第 8.1 节） */
export type MainTaskStatus =
  | '待分发'
  | '待领取'
  | '制作中'
  | '待提交审核'
  | '待审核'
  | '返修中'
  | '返修待审核'
  | '待推送'
  | '推送中'
  | '已推送'
  | '推送失败'
  | '废弃';

/** 子任务状态（第 8.2 节） */
export type SubtaskStatus =
  | '生图中'
  | '生图失败'
  | '待提交审核'
  | '修改中'
  | '待审核'
  | '返修待审核'
  | '审核失败'
  | '待推送'
  | '推送中'
  | '已推送'
  | '推送失败'
  | '废弃';

/** 角度（第 4.4 / 6.1.3 / 11.1 节） */
export type Angle = '正面' | '侧面' | '背面' | '半身';

/** 制作方式（第 4.3 节） */
export type ProduceMode = '批量制作' | '单个制作';

/** 质检图状态（第 4.3 / 4.4 节） */
export type InspectionImageStatus = '未配置' | '部分配置' | '已配置';

/** 图1 来源（第 6.1.3 / 6.4 节） */
export type Image1Source = '质检图' | '商品图兜底' | '手动';

/** 附加标签：单人 / 多人（第 6.1.3 / 11.1 节） */
export type CrowdTag = '单人' | '多人';

/** 色值匹配状态（第 6.1.3 节） */
export type ColorMatchStatus = '匹配成功' | '未匹配';

/** 素材 / 模板启用状态（第 11.1 / 11.2 节） */
export type EnableStatus = '启用' | '停用';

/** 质检图四个角度槽位（第 4.4 节）；有值表示已配置 */
export interface InspectionImages {
  正面?: string;
  侧面?: string;
  背面?: string;
  半身?: string;
}

/** 商品图槽位，用于图1 兜底（第 6.1.3 节） */
export interface ProductImages {
  主图?: boolean;
  正面?: boolean;
  侧面?: boolean;
  背面?: boolean;
  半身?: boolean;
}

/** 主任务（第 4.3 节列表字段，含第 4.4 / 9.1 节补充） */
export interface MainTask {
  /** 任务编号 */
  id: string;
  /** 灵鉴任务 ID */
  lingjianTaskId?: string;
  spu: string;
  /** SPU 名称 */
  spuName: string;
  /** 品类 */
  category: string;
  /** SPU 材质，描述词槽位用 */
  material: string;
  /** 需要数量 */
  requiredCount: number;
  /** 已完成数量（已推送子任务数） */
  completedCount: number;
  /** 运营指定的目标颜色，可为空 */
  color?: string;
  inspectionImageStatus: InspectionImageStatus;
  inspectionImages?: InspectionImages;
  productImages: ProductImages;
  /** 分发前必填；未指定时为空 */
  produceMode?: ProduceMode;
  status: MainTaskStatus;
  /** 制作人，认领后写入 */
  assignee?: string;
  issuedAt: string;
  dispatchedAt?: string;
  claimedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  pushedAt?: string;
  cancelReason?: string;
  pushFailReason?: string;
}

/** 参考图（第 6.1.3 / 6.4 节） */
export interface ReferenceImage {
  url: string;
  /** 图1 来源；图2/图3 为素材 */
  source?: Image1Source;
  materialId?: string;
  /** 素材层级标签等 */
  tags?: string;
}

/** 生成结果历史版本（第 6.4 节） */
export interface ResultVersion {
  url: string;
  type: 'AI 生成' | '上传覆盖';
  createdAt: string;
  operator: string;
}

/** 审核记录（第 6.4 节） */
export interface ReviewRecord {
  round: number;
  result: '通过' | '失败' | '废弃';
  reason?: string;
  operator?: string;
  createdAt?: string;
}

/** 操作日志（第 6.4 节） */
export interface OperationLog {
  action: string;
  operator: string;
  createdAt: string;
}

/** 子任务（第 6.1.3 行字段 + 第 6.4 节详情） */
export interface Subtask {
  /** 子任务编号 */
  id: string;
  /** 主任务编号 */
  mainTaskId: string;
  spu: string;
  color: string;
  angle: Angle;
  /** 品类自动带入 */
  category: string;
  /** 单人 / 多人 */
  crowdTag?: CrowdTag;
  /** 场景标签 */
  sceneTag?: string;
  produceMode: ProduceMode;
  status: SubtaskStatus;
  /** 审核轮次 */
  reviewRound: number;
  /** 生成次数 */
  generateCount: number;
  assignee: string;
  createdAt: string;
  /** 图1：质检图 / 商品图兜底 / 手动 */
  image1: ReferenceImage;
  /** 图2：素材库 */
  image2: ReferenceImage;
  /** 图3：选填，多人时默认展开 */
  image3?: ReferenceImage;
  /** 描述词最终文本 */
  prompt: string;
  /** 所用描述词模板版本 */
  templateVersion?: string;
  colorMatchStatus: ColorMatchStatus;
  currentResultUrl?: string;
  versions?: ResultVersion[];
  remark?: string;
  reviewRecords?: ReviewRecord[];
  operationLogs?: OperationLog[];
}

/** 素材库条目（第 11.1 节） */
export interface Material {
  id: string;
  url: string;
  /** 层级：品类 */
  category: string;
  /** 层级：角度 */
  angle: Angle;
  /** 层级：场景 */
  scene: string;
  /** 附加标签 */
  crowdTag: CrowdTag;
  status: EnableStatus;
  /** 使用次数，自动匹配降权依据 */
  usageCount: number;
}

/** 描述词模板版本（第 11.2 节） */
export interface PromptTemplateVersion {
  version: string;
  createdAt: string;
  operator: string;
  content: string;
}

/** 描述词模板（第 11.2 节，按角度一套） */
export interface PromptTemplate {
  id: string;
  angle: Angle;
  /** 含 {色值} {材质} {品类} {场景} 槽位 */
  content: string;
  version: string;
  /** 每个角度有且仅有一个启用版本 */
  status: EnableStatus;
  versions: PromptTemplateVersion[];
}

/** 颜色词典（第 11.3 节） */
export interface ColorDictionary {
  id: string;
  /** 颜色名 */
  name: string;
  /** 别名列表 */
  aliases: string[];
  /** hex 色值 */
  hex: string;
  /** 描述片段 */
  description: string;
}

/** 材质词典（第 11.3 节） */
export interface MaterialDictionary {
  id: string;
  /** 材质名 */
  name: string;
  /** 描述片段 */
  description: string;
}

/** 色值 / 材质未匹配记录（第 11.3 节） */
export interface UnmatchedRecord {
  name: string;
  type: '颜色' | '材质';
  count: number;
  lastAt: string;
}

/** 面板制作人指标（第 10 节） */
export interface DashboardMaker {
  name: string;
  claimed: number;
  doneBatch: number;
  doneSingle: number;
  avgGen: number;
  passOnce: string;
  rework: number;
  psRate: string;
  avgCost: string;
}

/** 面板静态指标（第 10 节，演示用） */
export interface DashboardSnapshot {
  issuedMain: number;
  needImages: number;
  pendingDistribute: number;
  pendingClaim: number;
  pushedMain: number;
  pushedMainRate: string;
  pushedImages: number;
  avgDurations: Record<string, string>;
  statusDist: { name: string; value: number }[];
  timeoutClaim: number;
  timeoutReview: number;
  timeoutN: string;
  genFail: number;
  pushFail: number;
  reworkRate: string;
  discardedSub: number;
  makers: DashboardMaker[];
  qcRate: Record<InspectionImageStatus, number>;
  qcAngle: Record<Angle, string>;
  img1FallbackRate: string;
  noQcDistributed: { id: string; spu: string; at: string }[];
  materialFreq: { id: string; used: number }[];
  templatePass: { angle: Angle; ver: string; passOnce: string }[];
  volumeDates: string[];
  volumeMains: number[];
  volumeImages: number[];
}
