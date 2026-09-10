import dayjs from 'dayjs';
import { ANGLES } from '@/constants/buyer-show';
import type {
  Angle,
  CategoryTag,
  ColorDictionary,
  ColorMatchStatus,
  ConsistencyStatus,
  CrowdTag,
  Image1Source,
  InspectionImageStatus,
  InspectionImages,
  MainTask,
  MainTaskStatus,
  Material,
  MaterialDictionary,
  PromptTemplate,
  SpuMaster,
  Subtask,
  SubtaskStatus,
} from '@/types/buyer-show';

export function nowLabel() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

export function qcSlotCount(images?: InspectionImages) {
  if (!images) return 0;
  return ANGLES.filter((angle) => Boolean(images[angle])).length;
}

export function deriveQcStatus(images?: InspectionImages): InspectionImageStatus {
  const n = qcSlotCount(images);
  if (n === 0) return '未配置';
  if (n === 4) return '已配置';
  return '部分配置';
}

export function canConfirmConsistency(images?: InspectionImages) {
  return qcSlotCount(images) >= 1;
}

export function qcImagesChanged(a?: InspectionImages, b?: InspectionImages) {
  return ANGLES.some((angle) => (a?.[angle] ?? '') !== (b?.[angle] ?? ''));
}

export function cloneQcImages(images?: InspectionImages): InspectionImages {
  const next: InspectionImages = {};
  ANGLES.forEach((angle) => {
    if (images?.[angle]) next[angle] = images[angle];
  });
  return next;
}

export function isInProgressMainStatus(status: MainTaskStatus) {
  return status !== '已推送' && status !== '废弃';
}

export function hasInProgressTask(spu: string, mains: MainTask[]) {
  return mains.some((t) => t.spu === spu && isInProgressMainStatus(t.status));
}

/** 待分发读 SPU 主数据；已写入快照的主任务读冻结快照（第 4.4 / 14.2 节） */
export interface TaskQcView {
  images: InspectionImages;
  status: InspectionImageStatus;
  consistencyStatus: ConsistencyStatus;
  consistencyConfirmedBy?: string;
  consistencyConfirmedAt?: string;
  source: 'snapshot' | 'spu';
}

export function resolveTaskQcView(task: MainTask, spu?: SpuMaster): TaskQcView {
  if (task.qcImagesSnapshot) {
    return {
      images: task.qcImagesSnapshot.images,
      status: task.qcImagesSnapshot.status,
      consistencyStatus: task.consistencyStatus ?? '未确认',
      consistencyConfirmedBy: task.consistencyConfirmedBy,
      consistencyConfirmedAt: task.consistencyConfirmedAt,
      source: 'snapshot',
    };
  }
  return {
    images: spu?.qcImages ?? task.inspectionImages ?? {},
    status: spu?.qcStatus ?? task.inspectionImageStatus,
    consistencyStatus: spu?.consistencyStatus ?? '未确认',
    consistencyConfirmedBy: spu?.consistencyConfirmedBy,
    consistencyConfirmedAt: spu?.consistencyConfirmedAt,
    source: 'spu',
  };
}

export function snapshotFromSpu(spu: SpuMaster) {
  return {
    qcImagesSnapshot: {
      images: cloneQcImages(spu.qcImages),
      status: spu.qcStatus,
    },
    consistencyStatus: spu.consistencyStatus,
    consistencyConfirmedBy: spu.consistencyConfirmedBy,
    consistencyConfirmedAt: spu.consistencyConfirmedAt,
    inspectionImages: cloneQcImages(spu.qcImages),
    inspectionImageStatus: spu.qcStatus,
  };
}

export function canCancel(status: MainTaskStatus) {
  return status === '待分发' || status === '待领取';
}

export function isEffectiveSubtask(sub: Subtask) {
  return sub.status !== '废弃' && sub.status !== '生图失败';
}

export function subsOf(subtasks: Subtask[], mainId: string) {
  return subtasks.filter((s) => s.mainTaskId === mainId);
}

export function reviewPendingCount(subtasks: Subtask[], mainId: string) {
  const list = subsOf(subtasks, mainId);
  const pending = list.filter((s) => s.status === '待审核' || s.status === '返修待审核').length;
  return { x: pending, y: list.length };
}

export interface Image1Resolve {
  source: Image1Source;
  label: string;
}

export function resolveProductImage(spu: Pick<SpuMaster, 'productImages' | 'coverImage'>, angle: Angle): Image1Resolve {
  if (spu.productImages[angle]) {
    return { source: '商品图', label: `商品图·${angle}` };
  }
  if (spu.coverImage || spu.productImages.主图) {
    return { source: '商品图', label: '商品图·首图' };
  }
  return { source: '手动', label: '请上传商品图' };
}

export function resolveQcImageOptional(spu: Pick<SpuMaster, 'qcImages'>, angle: Angle): Image1Resolve | undefined {
  if (spu.qcImages[angle]) {
    return { source: '质检图', label: `质检图·${angle}` };
  }
  return undefined;
}

export function filterRefLibrary(materials: Material[], category: string, tag: CrowdTag, angle: Angle) {
  return materials.filter(
    (m) => m.status === '启用' && m.category === category && m.crowdTag === tag && m.angle === angle,
  );
}

/** 同一品类下标签名完全相同则视为重复（首尾空格忽略） */
export function categoryHasTag(tags: CategoryTag[], category: string, name: string) {
  const n = name.trim();
  return Boolean(n) && tags.some((t) => t.category === category && t.name === n);
}

/** 设计端 / 筛选：优先用品类标签库；否则从图库图片倒推。标签按品类，不按角度。 */
export function libraryTags(
  materials: Material[],
  opts?: { category?: string; angle?: Angle; includeDisabled?: boolean; categoryTags?: CategoryTag[] },
) {
  if (opts?.categoryTags?.length) {
    return [
      ...new Set(
        opts.categoryTags
          .filter(
            (t) =>
              (opts.includeDisabled || t.status === '启用') &&
              (!opts.category || t.category === opts.category),
          )
          .map((t) => t.name)
          .filter(Boolean),
      ),
    ];
  }
  return [
    ...new Set(
      materials
        .filter(
          (m) =>
            (opts?.includeDisabled || m.status === '启用') &&
            (!opts?.category || m.category === opts.category) &&
            (!opts?.angle || m.angle === opts.angle),
        )
        .map((m) => m.crowdTag)
        .filter(Boolean),
    ),
  ];
}

export function isUploadedSlot(value?: string) {
  return Boolean(value && /^(已上传|其他·)/.test(value));
}

export function resolveImage1FromSpu(spu: Pick<SpuMaster, 'qcImages' | 'productImages'>, angle: Angle): Image1Resolve {
  if (spu.qcImages[angle]) {
    return { source: '质检图', label: `质检图·${angle}` };
  }
  if (angle === '正面' && spu.productImages.主图) {
    return { source: '商品图兜底', label: '商品图兜底·主图' };
  }
  if (spu.productImages[angle]) {
    return { source: '商品图兜底', label: `商品图兜底·${angle}` };
  }
  return { source: '手动', label: '请手动选择' };
}

export function resolveImage1(task: MainTask, angle: Angle, spu?: SpuMaster): Image1Resolve {
  const images = resolveTaskQcView(task, spu).images;
  return resolveImage1FromSpu(
    {
      qcImages: images,
      productImages: spu?.productImages ?? task.productImages,
    },
    angle,
  );
}

export function findColorDict(color: string | undefined, dict: ColorDictionary[]) {
  if (!color) return undefined;
  return dict.find((c) => c.name === color || c.aliases.includes(color));
}

/** 仅由颜色词典推导匹配状态，不写死「匹配成功 / 未匹配」。 */
export function deriveColorMatchStatus(color: string | undefined, dict: ColorDictionary[]): ColorMatchStatus {
  return findColorDict(color, dict) ? '匹配成功' : '未匹配';
}

export function matchColor(color: string | undefined, dict: ColorDictionary[]): ColorMatchStatus {
  return deriveColorMatchStatus(color, dict);
}

export function colorHex(color: string | undefined, dict: ColorDictionary[]) {
  return findColorDict(color, dict)?.hex ?? '';
}

export function extractPromptColorSlot(prompt: string) {
  const m = String(prompt ?? '').match(/\{色值[:：]([^}]+)\}/);
  return m?.[1]?.trim() ?? '';
}

/** 未匹配且描述词色值槽位已填 → 语义为「人工填写」，不新增枚举。 */
export function isColorManuallyFilled(status: ColorMatchStatus, prompt: string) {
  return status === '未匹配' && promptHasColorSlotFilled(prompt);
}

export function colorMatchDisplay(status: ColorMatchStatus, prompt: string) {
  return isColorManuallyFilled(status, prompt) ? '未匹配（已人工填写）' : status;
}

export function enabledTemplate(templates: PromptTemplate[], category: string, angle: Angle) {
  return templates.find((t) => t.category === category && t.angle === angle && t.status === '启用');
}

export function templateDisplayName(t: Pick<PromptTemplate, 'category' | 'angle'>) {
  return `${t.category}（${t.angle}）`;
}

export function fillPromptFromSpu(
  spu: Pick<SpuMaster, 'material' | 'category'>,
  angle: Angle,
  color: string | undefined,
  templates: PromptTemplate[],
  dict: ColorDictionary[],
) {
  const pack = enabledTemplate(templates, spu.category, angle);
  if (!pack) {
    return { text: '', ver: `${spu.category}-${angle}-` };
  }
  const hex = colorHex(color, dict);
  const text = pack.content
    .replace('{色值}', formatColorSlot(hex))
    .replace('{材质}', `{材质:${spu.material}}`)
    .replace('{品类}', `{品类:${spu.category}}`)
    .replace('{场景}', '{场景:默认场景}');
  return { text, ver: `${spu.category}-${angle}-${pack.version}` };
}

export function fillPrompt(task: MainTask, angle: Angle, color: string | undefined, templates: PromptTemplate[], dict: ColorDictionary[]) {
  return fillPromptFromSpu(task, angle, color, templates, dict);
}

export function matchMaterialByCategory(
  materials: Material[],
  category: string,
  angle: Angle,
  crowdTag: CrowdTag,
  usedIds: string[],
) {
  const list = materials
    .filter(
      (m) =>
        m.status === '启用' &&
        m.category === category &&
        m.angle === angle &&
        m.crowdTag === crowdTag &&
        !usedIds.includes(m.id),
    )
    .sort((a, b) => a.usageCount - b.usageCount);
  return list[0]?.id ?? '';
}

export function matchMaterial(
  materials: Material[],
  task: MainTask,
  angle: Angle,
  crowdTag: CrowdTag,
  usedIds: string[],
) {
  return matchMaterialByCategory(materials, task.category, angle, crowdTag, usedIds);
}

/** 从 SCM/SPU 主数据带出的材质名，对照材质词典 */
export function matchScmMaterial(name: string | undefined, dict: MaterialDictionary[]) {
  const n = name?.trim();
  if (!n) return { name: '', matched: false as const };
  const hit = dict.find((d) => d.name === n);
  return { name: n, description: hit?.description, matched: Boolean(hit) };
}

export function parseSpuTokens(raw: string) {
  return [...new Set(raw.split(/[\s,，;；]+/).map((s) => s.trim()).filter(Boolean))];
}

export interface SpuImportRow {
  spu: string;
  count: number;
}

function splitTableLine(line: string) {
  return line.split(/[,，\t;；]/).map((s) => s.trim());
}

/** 解析「SPU / 个数 / 颜色」表。首行可以是表头；个数空则默认 4。 */
export function parseSpuTable(raw: string): { rows: SpuImportRow[]; errors: string[] } {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errors: string[] = [];
  const rows: SpuImportRow[] = [];
  if (!lines.length) return { rows, errors: ['表格为空'] };

  const header = splitTableLine(lines[0]).map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => /spu|个数|数量|张数/.test(h));
  let iSpu = 0;
  let iCount = 1;
  let start = 0;
  if (hasHeader) {
    start = 1;
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    iSpu = idx(/spu/);
    iCount = idx(/个数|数量|张数|count/);
    if (iSpu < 0) iSpu = 0;
    if (iCount < 0) iCount = 1;
  }

  lines.slice(start).forEach((line, i) => {
    const cols = splitTableLine(line);
    const spu = (cols[iSpu] ?? '').trim();
    if (!spu) {
      errors.push(`第 ${start + i + 1} 行缺少 SPU`);
      return;
    }
    const rawCount = (cols[iCount] ?? '').trim();
    const parsed = rawCount ? Number(rawCount) : 4;
    const count = Number.isFinite(parsed) && parsed >= 1 ? Math.min(16, Math.floor(parsed)) : 4;
    rows.push({ spu, count });
  });
  return { rows, errors };
}

export const SPU_TABLE_TEMPLATE = 'SPU,个数\nSPU-1008640,4\nSPU-1008611,4\n';

export function nextFreeBatchId(existCount: number) {
  return `FB-${nowLabel().slice(0, 10).replace(/-/g, '')}-${String(existCount + 1).padStart(4, '0')}`;
}

export function canRerunFreeBatch(status: SubtaskStatus) {
  return status !== '生图中';
}

export function isFreeBatchSub(sub: Subtask) {
  return sub.source === '手动批量';
}

export function promptHasColorSlotFilled(prompt: string) {
  return /\{色值[:：][^}]+\}/.test(prompt) || /#[0-9A-Fa-f]{3,8}/.test(prompt);
}

/** 词典命中写 `{色值:#hex}`；人工填写写 `{色值:人工填写 #hex}`。 */
export function formatColorSlot(hex: string, source: 'dict' | 'manual' = 'dict') {
  if (!hex) return '{色值}';
  return source === 'manual' ? `{色值:人工填写 ${hex}}` : `{色值:${hex}}`;
}

export function nextSubtaskId(mainId: string, existCount: number) {
  return `BST-NEW-${mainId.slice(-4)}-${String(existCount + 1).padStart(2, '0')}`;
}

export function canCreateSingle(task: MainTask, children: Subtask[]) {
  const valid = children.filter(isEffectiveSubtask).length;
  if (task.status === '返修中' && valid < task.requiredCount) return true;
  return children.length < task.requiredCount;
}

const REVIEWING: SubtaskStatus[] = ['待审核', '返修待审核'];

export function deriveMainAfterRound(main: MainTask, children: Subtask[]): MainTaskStatus {
  const pending = children.filter((s) => REVIEWING.includes(s.status));
  if (pending.length) return main.status;
  const valid = children.filter(isEffectiveSubtask);
  if (!valid.length) return '废弃';
  if (children.some((s) => s.status === '审核失败')) return '返修中';
  if (valid.every((s) => s.status === '待推送')) return '待推送';
  return main.status;
}

export function shouldShowMainSubmit(main: MainTask, children: Subtask[]) {
  if (main.status !== '待提交审核') return false;
  const valid = children.filter(isEffectiveSubtask);
  if (valid.length !== main.requiredCount) return false;
  return valid.every((s) => s.status === '待审核');
}

export function image1Kind(source?: Image1Source): 'qc' | 'prod' | 'mat' {
  if (source === '质检图') return 'qc';
  if (source === '参考图' || source === '其他' || source === '手动') return 'mat';
  return 'prod';
}

export function splitPromptSlots(text: string) {
  return String(text ?? '').split(/(\{[^}]+\})/g);
}
