import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { CURRENT_DESIGNER, CURRENT_OPERATOR } from '@/constants/buyer-show';
import {
  mockColorDictionaries,
  mockMainTasks,
  mockMaterialDictionaries,
  mockMaterials,
  mockPromptTemplates,
  mockSubtasks,
  mockUnmatchedRecords,
} from '@/mocks/buyer-show';
import type {
  Angle,
  ColorDictionary,
  CrowdTag,
  InspectionImages,
  MainTask,
  Material,
  MaterialDictionary,
  ProduceMode,
  PromptTemplate,
  Subtask,
  UnmatchedRecord,
} from '@/types/buyer-show';
import { deriveMainAfterRound, deriveQcStatus, nowLabel } from '@/utils/buyer-show';

export interface BuyerShowState {
  mainTasks: MainTask[];
  subtasks: Subtask[];
  materials: Material[];
  promptTemplates: PromptTemplate[];
  colorDictionaries: ColorDictionary[];
  materialDictionaries: MaterialDictionary[];
  unmatchedRecords: UnmatchedRecord[];
}

const initialState: BuyerShowState = {
  mainTasks: mockMainTasks,
  subtasks: mockSubtasks,
  materials: mockMaterials,
  promptTemplates: mockPromptTemplates,
  colorDictionaries: mockColorDictionaries,
  materialDictionaries: mockMaterialDictionaries,
  unmatchedRecords: mockUnmatchedRecords,
};

function patchMain(list: MainTask[], id: string, patch: Partial<MainTask>) {
  return list.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function patchSub(list: Subtask[], id: string, patch: Partial<Subtask>) {
  return list.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function appendLog(sub: Subtask, action: string, operator: string): Subtask {
  return {
    ...sub,
    operationLogs: [{ action, operator, createdAt: nowLabel() }, ...(sub.operationLogs ?? [])],
  };
}

type Action =
  | { type: 'SET_COLOR'; id: string; color: string }
  | { type: 'SET_PRODUCE_MODE'; id: string; produceMode: ProduceMode | undefined }
  | { type: 'SAVE_QC'; id: string; images: InspectionImages }
  | { type: 'DISPATCH'; ids: string[]; produceMode: ProduceMode }
  | { type: 'CANCEL'; id: string; reason: string }
  | { type: 'CLAIM'; id: string; designer: string }
  | { type: 'CREATE_SUBTASKS'; items: Subtask[] }
  | { type: 'SUBMIT_SUBTASK'; id: string }
  | { type: 'REGENERATE'; id: string }
  | { type: 'MARK_EDITING'; id: string }
  | { type: 'UPLOAD_OVERRIDE'; id: string }
  | { type: 'RETRY'; id: string }
  | { type: 'BATCH_REGEN'; ids: string[]; crowdTag?: CrowdTag; img2?: string; img3?: string; prompt?: string }
  | { type: 'SUBMIT_MAIN'; id: string }
  | { type: 'REVIEW_PASS'; id: string }
  | { type: 'REVIEW_FAIL'; id: string; reason: string }
  | { type: 'REVIEW_DISCARD'; id: string; reason: string }
  | { type: 'REPUSH'; id: string }
  | { type: 'SAVE_REMARK'; id: string; remark: string }
  | { type: 'TOGGLE_MATERIAL'; id: string }
  | { type: 'ADD_MATERIAL'; item: Material }
  | { type: 'SAVE_TEMPLATE'; angle: Angle; content: string }
  | { type: 'ENABLE_TEMPLATE'; angle: Angle; version: string }
  | { type: 'ADD_COLOR'; item: ColorDictionary };

function reducer(state: BuyerShowState, action: Action): BuyerShowState {
  switch (action.type) {
    case 'SET_COLOR':
      return { ...state, mainTasks: patchMain(state.mainTasks, action.id, { color: action.color }) };
    case 'SET_PRODUCE_MODE':
      return { ...state, mainTasks: patchMain(state.mainTasks, action.id, { produceMode: action.produceMode }) };
    case 'SAVE_QC':
      return {
        ...state,
        mainTasks: patchMain(state.mainTasks, action.id, {
          inspectionImages: action.images,
          inspectionImageStatus: deriveQcStatus(action.images),
        }),
      };
    case 'DISPATCH': {
      const at = nowLabel();
      return {
        ...state,
        mainTasks: state.mainTasks.map((t) =>
          action.ids.includes(t.id) && t.status === '待分发'
            ? { ...t, produceMode: action.produceMode, status: '待领取', dispatchedAt: at }
            : t,
        ),
      };
    }
    case 'CANCEL':
      return {
        ...state,
        mainTasks: patchMain(state.mainTasks, action.id, { status: '废弃', cancelReason: action.reason }),
      };
    case 'CLAIM':
      return {
        ...state,
        mainTasks: patchMain(state.mainTasks, action.id, {
          status: '制作中',
          assignee: action.designer,
          claimedAt: nowLabel(),
        }),
      };
    case 'CREATE_SUBTASKS':
      return { ...state, subtasks: [...state.subtasks, ...action.items] };
    case 'SUBMIT_SUBTASK': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      const main = sub ? state.mainTasks.find((t) => t.id === sub.mainTaskId) : undefined;
      if (!sub || !main) return state;
      const nextStatus = main.status === '返修中' || sub.reviewRound >= 1 ? '返修待审核' : '待审核';
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog({ ...sub, status: nextStatus }, `提交审核，进入${nextStatus}`, sub.assignee),
        }),
      };
    }
    case 'REGENERATE': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      if (!sub) return state;
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog(
            { ...sub, status: '生图中', generateCount: sub.generateCount + 1 },
            '重新生成',
            sub.assignee,
          ),
        }),
      };
    }
    case 'MARK_EDITING': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      if (!sub) return state;
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog({ ...sub, status: '修改中' }, '标记修改中', sub.assignee),
        }),
      };
    }
    case 'UPLOAD_OVERRIDE': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      if (!sub) return state;
      const at = nowLabel();
      const next: Subtask = {
        ...sub,
        status: '待提交审核',
        currentResultUrl: `override-${sub.id}-${at}`,
        versions: [...(sub.versions ?? []), { url: `override-${sub.id}`, type: '上传覆盖', createdAt: at, operator: sub.assignee }],
      };
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog(next, '上传覆盖成功，进入待提交审核', sub.assignee),
        }),
      };
    }
    case 'RETRY': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      if (!sub) return state;
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog({ ...sub, status: '生图中' }, '重试（沿用参数）', sub.assignee),
        }),
      };
    }
    case 'BATCH_REGEN':
      return {
        ...state,
        subtasks: state.subtasks.map((s) => {
          if (!action.ids.includes(s.id)) return s;
          return {
            ...s,
            crowdTag: action.crowdTag || s.crowdTag,
            image2: action.img2 ? { ...s.image2, materialId: action.img2, url: `img2-${action.img2}` } : s.image2,
            image3: action.img3 ? { url: `img3-${action.img3}`, materialId: action.img3 } : s.image3,
            prompt: action.prompt || s.prompt,
            status: '生图中',
            generateCount: s.generateCount + 1,
          };
        }),
      };
    case 'SUBMIT_MAIN': {
      const main = state.mainTasks.find((t) => t.id === action.id);
      if (!main) return state;
      const first = !main.submittedAt;
      const at = nowLabel();
      const nextStatus = first ? '待审核' : '返修待审核';
      return {
        ...state,
        mainTasks: patchMain(state.mainTasks, action.id, { status: nextStatus, submittedAt: at }),
        subtasks: state.subtasks.map((s) =>
          s.mainTaskId === action.id && (s.status === '待审核' || s.status === '返修待审核')
            ? { ...s, reviewRound: first ? 1 : s.reviewRound + 1 }
            : s,
        ),
      };
    }
    case 'REVIEW_PASS':
    case 'REVIEW_FAIL':
    case 'REVIEW_DISCARD': {
      const sub = state.subtasks.find((s) => s.id === action.id);
      const main = sub ? state.mainTasks.find((t) => t.id === sub.mainTaskId) : undefined;
      if (!sub || !main) return state;
      const result = action.type === 'REVIEW_PASS' ? '通过' : action.type === 'REVIEW_FAIL' ? '失败' : '废弃';
      const nextStatus = action.type === 'REVIEW_PASS' ? '待推送' : action.type === 'REVIEW_FAIL' ? '审核失败' : '废弃';
      const reason = action.type === 'REVIEW_PASS' ? undefined : action.reason;
      const at = nowLabel();
      const nextSub: Subtask = {
        ...sub,
        status: nextStatus,
        reviewRecords: [
          ...(sub.reviewRecords ?? []),
          { round: sub.reviewRound || 1, result, reason, operator: CURRENT_OPERATOR, createdAt: at },
        ],
      };
      const logged = appendLog(nextSub, result === '通过' ? '审核通过' : `${result}：${reason ?? ''}`, CURRENT_OPERATOR);
      const nextSubs = patchSub(state.subtasks, action.id, logged);
      const children = nextSubs.filter((s) => s.mainTaskId === main.id);
      const nextMainStatus = deriveMainAfterRound(main, children);
      return {
        ...state,
        subtasks: nextSubs,
        mainTasks: patchMain(state.mainTasks, main.id, {
          status: nextMainStatus,
          reviewedAt: nextMainStatus === '待推送' || nextMainStatus === '返修中' || nextMainStatus === '废弃' ? at : main.reviewedAt,
        }),
      };
    }
    case 'REPUSH':
      return {
        ...state,
        mainTasks: patchMain(state.mainTasks, action.id, { status: '推送中' }),
        subtasks: state.subtasks.map((s) =>
          s.mainTaskId === action.id && s.status === '推送失败' ? { ...s, status: '推送中' } : s,
        ),
      };
    case 'SAVE_REMARK':
      return { ...state, subtasks: patchSub(state.subtasks, action.id, { remark: action.remark }) };
    case 'TOGGLE_MATERIAL':
      return {
        ...state,
        materials: state.materials.map((m) =>
          m.id === action.id ? { ...m, status: m.status === '启用' ? '停用' : '启用' } : m,
        ),
      };
    case 'ADD_MATERIAL':
      return { ...state, materials: [action.item, ...state.materials] };
    case 'SAVE_TEMPLATE': {
      const at = nowLabel();
      return {
        ...state,
        promptTemplates: state.promptTemplates.map((t) => {
          if (t.angle !== action.angle) return t;
          const version = `v${t.versions.length + 1}`;
          return {
            ...t,
            version,
            content: action.content,
            status: '启用',
            versions: [{ version, createdAt: at, operator: CURRENT_OPERATOR, content: action.content }, ...t.versions],
          };
        }),
      };
    }
    case 'ENABLE_TEMPLATE':
      return {
        ...state,
        promptTemplates: state.promptTemplates.map((t) => {
          if (t.angle !== action.angle) return t;
          const ver = t.versions.find((v) => v.version === action.version);
          if (!ver) return t;
          return { ...t, version: ver.version, content: ver.content, status: '启用' };
        }),
      };
    case 'ADD_COLOR':
      return { ...state, colorDictionaries: [...state.colorDictionaries, action.item] };
    default:
      return state;
  }
}

interface BuyerShowContextValue extends BuyerShowState {
  currentDesigner: string;
  findMain: (id: string) => MainTask | undefined;
  findSub: (id: string) => Subtask | undefined;
  setColor: (id: string, color: string) => void;
  setProduceMode: (id: string, produceMode: ProduceMode | undefined) => void;
  saveQc: (id: string, images: InspectionImages) => void;
  dispatchTasks: (ids: string[], produceMode: ProduceMode) => void;
  cancelTask: (id: string, reason: string) => void;
  claimTask: (id: string) => void;
  createSubtasks: (items: Subtask[]) => void;
  submitSubtask: (id: string) => void;
  regenerate: (id: string) => void;
  markEditing: (id: string) => void;
  uploadOverride: (id: string) => void;
  retry: (id: string) => void;
  batchRegen: (ids: string[], patch: { crowdTag?: CrowdTag; img2?: string; img3?: string; prompt?: string }) => void;
  submitMain: (id: string) => void;
  reviewPass: (id: string) => void;
  reviewFail: (id: string, reason: string) => void;
  reviewDiscard: (id: string, reason: string) => void;
  repush: (id: string) => void;
  saveRemark: (id: string, remark: string) => void;
  toggleMaterial: (id: string) => void;
  addMaterial: (item: Material) => void;
  saveTemplate: (angle: Angle, content: string) => void;
  enableTemplate: (angle: Angle, version: string) => void;
  addColor: (item: ColorDictionary) => void;
}

const BuyerShowContext = createContext<BuyerShowContextValue | null>(null);

export function BuyerShowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<BuyerShowContextValue>(
    () => ({
      ...state,
      currentDesigner: CURRENT_DESIGNER,
      findMain: (id) => state.mainTasks.find((t) => t.id === id),
      findSub: (id) => state.subtasks.find((s) => s.id === id),
      setColor: (id, color) => dispatch({ type: 'SET_COLOR', id, color }),
      setProduceMode: (id, produceMode) => dispatch({ type: 'SET_PRODUCE_MODE', id, produceMode }),
      saveQc: (id, images) => dispatch({ type: 'SAVE_QC', id, images }),
      dispatchTasks: (ids, produceMode) => dispatch({ type: 'DISPATCH', ids, produceMode }),
      cancelTask: (id, reason) => dispatch({ type: 'CANCEL', id, reason }),
      claimTask: (id) => dispatch({ type: 'CLAIM', id, designer: CURRENT_DESIGNER }),
      createSubtasks: (items) => dispatch({ type: 'CREATE_SUBTASKS', items }),
      submitSubtask: (id) => dispatch({ type: 'SUBMIT_SUBTASK', id }),
      regenerate: (id) => dispatch({ type: 'REGENERATE', id }),
      markEditing: (id) => dispatch({ type: 'MARK_EDITING', id }),
      uploadOverride: (id) => dispatch({ type: 'UPLOAD_OVERRIDE', id }),
      retry: (id) => dispatch({ type: 'RETRY', id }),
      batchRegen: (ids, patch) => dispatch({ type: 'BATCH_REGEN', ids, ...patch }),
      submitMain: (id) => dispatch({ type: 'SUBMIT_MAIN', id }),
      reviewPass: (id) => dispatch({ type: 'REVIEW_PASS', id }),
      reviewFail: (id, reason) => dispatch({ type: 'REVIEW_FAIL', id, reason }),
      reviewDiscard: (id, reason) => dispatch({ type: 'REVIEW_DISCARD', id, reason }),
      repush: (id) => dispatch({ type: 'REPUSH', id }),
      saveRemark: (id, remark) => dispatch({ type: 'SAVE_REMARK', id, remark }),
      toggleMaterial: (id) => dispatch({ type: 'TOGGLE_MATERIAL', id }),
      addMaterial: (item) => dispatch({ type: 'ADD_MATERIAL', item }),
      saveTemplate: (angle, content) => dispatch({ type: 'SAVE_TEMPLATE', angle, content }),
      enableTemplate: (angle, version) => dispatch({ type: 'ENABLE_TEMPLATE', angle, version }),
      addColor: (item) => dispatch({ type: 'ADD_COLOR', item }),
    }),
    [state],
  );

  return <BuyerShowContext.Provider value={value}>{children}</BuyerShowContext.Provider>;
}

export function useBuyerShow() {
  const ctx = useContext(BuyerShowContext);
  if (!ctx) {
    throw new Error('useBuyerShow 必须在 BuyerShowProvider 内使用');
  }
  return ctx;
}
