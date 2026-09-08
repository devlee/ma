import dayjs from 'dayjs';
import { ANGLES } from '@/constants/buyer-show';
import type {
  Angle,
  ColorDictionary,
  ColorMatchStatus,
  CrowdTag,
  Image1Source,
  InspectionImageStatus,
  InspectionImages,
  MainTask,
  MainTaskStatus,
  Material,
  PromptTemplate,
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

export function resolveImage1(task: MainTask, angle: Angle): Image1Resolve {
  if (task.inspectionImages?.[angle]) {
    return { source: '质检图', label: `质检图·${angle}` };
  }
  if (angle === '正面' && task.productImages.主图) {
    return { source: '商品图兜底', label: '商品图兜底·主图' };
  }
  if (task.productImages[angle]) {
    return { source: '商品图兜底', label: `商品图兜底·${angle}` };
  }
  return { source: '手动', label: '请手动选择' };
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

export function enabledTemplate(templates: PromptTemplate[], angle: Angle) {
  return templates.find((t) => t.angle === angle && t.status === '启用');
}

export function fillPrompt(task: MainTask, angle: Angle, color: string | undefined, templates: PromptTemplate[], dict: ColorDictionary[]) {
  const pack = enabledTemplate(templates, angle);
  if (!pack) {
    return { text: '', ver: `${angle}-` };
  }
  const hex = colorHex(color, dict);
  const text = pack.content
    .replace('{色值}', formatColorSlot(hex))
    .replace('{材质}', `{材质:${task.material}}`)
    .replace('{品类}', `{品类:${task.category}}`)
    .replace('{场景}', '{场景:默认场景}');
  return { text, ver: `${angle}-${pack.version}` };
}

export function matchMaterial(
  materials: Material[],
  task: MainTask,
  angle: Angle,
  crowdTag: CrowdTag,
  usedIds: string[],
) {
  const list = materials
    .filter(
      (m) =>
        m.status === '启用' &&
        m.category === task.category &&
        m.angle === angle &&
        m.crowdTag === crowdTag &&
        !usedIds.includes(m.id),
    )
    .sort((a, b) => a.usageCount - b.usageCount);
  return list[0]?.id ?? '';
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
  if (source === '手动') return 'mat';
  return 'prod';
}

export function splitPromptSlots(text: string) {
  return String(text ?? '').split(/(\{[^}]+\})/g);
}
