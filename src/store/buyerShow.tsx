import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { CURRENT_DESIGNER, CURRENT_OPERATOR } from '@/constants/buyer-show';
import {
  mockCategoryTags,
  mockColorDictionaries,
  mockFreeBatches,
  mockFreeBatchSubs,
  mockMainTasks,
  mockMaterialDictionaries,
  mockMaterials,
  mockPromptTemplates,
  mockSpus,
  mockSubtasks,
  mockUnmatchedRecords,
} from '@/mocks/buyer-show';
import type {
  Angle,
  CategoryTag,
  ColorDictionary,
  CrowdTag,
  EnableStatus,
  FreeBatch,
  InspectionImages,
  MainTask,
  Material,
  MaterialDictionary,
  ProduceMode,
  PromptTemplate,
  SpuMaster,
  Subtask,
  UnmatchedRecord,
} from '@/types/buyer-show';
import {
  canConfirmConsistency,
  categoryHasTag,
  deriveMainAfterRound,
  deriveQcStatus,
  nowLabel,
  qcImagesChanged,
  snapshotFromSpu,
} from '@/utils/buyer-show';

export interface BuyerShowState {
  spus: SpuMaster[];
  mainTasks: MainTask[];
  subtasks: Subtask[];
  freeBatches: FreeBatch[];
  materials: Material[];
  categoryTags: CategoryTag[];
  promptTemplates: PromptTemplate[];
  colorDictionaries: ColorDictionary[];
  materialDictionaries: MaterialDictionary[];
  unmatchedRecords: UnmatchedRecord[];
}

const initialState: BuyerShowState = {
  spus: mockSpus,
  mainTasks: mockMainTasks,
  subtasks: [...mockSubtasks, ...mockFreeBatchSubs],
  freeBatches: mockFreeBatches,
  materials: mockMaterials,
  categoryTags: mockCategoryTags,
  promptTemplates: mockPromptTemplates,
  colorDictionaries: mockColorDictionaries,
  materialDictionaries: mockMaterialDictionaries,
  unmatchedRecords: mockUnmatchedRecords,
};

function patchMain(list: MainTask[], id: string, patch: Partial<MainTask>) {
  return list.map((t) => (t.id === id ? { ...t, ...patch } : t));
}

function patchSpu(list: SpuMaster[], spu: string, patch: Partial<SpuMaster>) {
  return list.map((s) => (s.spu === spu ? { ...s, ...patch } : s));
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
  | { type: 'SAVE_SPU_QC'; spu: string; images: InspectionImages; operator: string }
  | { type: 'CONFIRM_CONSISTENCY'; spu: string; operator: string; images?: InspectionImages }
  | { type: 'REVOKE_CONSISTENCY'; spu: string; operator: string }
  | { type: 'DISPATCH'; ids: string[]; produceMode: ProduceMode }
  | { type: 'CANCEL'; id: string; reason: string }
  | { type: 'CLAIM'; id: string; designer: string }
  | { type: 'CREATE_SUBTASKS'; items: Subtask[] }
  | { type: 'CREATE_FREE_BATCH'; batch: FreeBatch; items: Subtask[] }
  | { type: 'COMPLETE_GEN'; ids: string[] }
  | { type: 'SUBMIT_SUBTASK'; id: string }
  | { type: 'REGENERATE'; id: string; patch?: Partial<Subtask> }
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
  | { type: 'ADD_CATEGORY_TAG'; item: CategoryTag }
  | { type: 'TOGGLE_CATEGORY_TAG'; id: string }
  | { type: 'SAVE_TEMPLATE'; category: string; angle: Angle; content: string }
  | { type: 'ENABLE_TEMPLATE'; category: string; angle: Angle; version: string }
  | { type: 'SET_TEMPLATE_STATUS'; id: string; status: EnableStatus }
  | { type: 'DELETE_TEMPLATE'; id: string }
  | { type: 'ADD_COLOR'; item: ColorDictionary };

function reducer(state: BuyerShowState, action: Action): BuyerShowState {
  switch (action.type) {
    case 'SET_COLOR':
      return { ...state, mainTasks: patchMain(state.mainTasks, action.id, { color: action.color }) };
    case 'SET_PRODUCE_MODE':
      return { ...state, mainTasks: patchMain(state.mainTasks, action.id, { produceMode: action.produceMode }) };
    case 'SAVE_SPU_QC': {
      const current = state.spus.find((s) => s.spu === action.spu);
      if (!current) return state;
      const changed = qcImagesChanged(current.qcImages, action.images);
      const qcStatus = deriveQcStatus(action.images);
      const resetConsistency = changed && current.consistencyStatus === '已确认';
      return {
        ...state,
        spus: patchSpu(state.spus, action.spu, {
          qcImages: action.images,
          qcStatus,
          consistencyStatus: resetConsistency ? '未确认' : current.consistencyStatus,
          consistencyConfirmedBy: resetConsistency ? undefined : current.consistencyConfirmedBy,
          consistencyConfirmedAt: resetConsistency ? undefined : current.consistencyConfirmedAt,
          updatedAt: nowLabel(),
          updatedBy: action.operator,
        }),
      };
    }
    case 'CONFIRM_CONSISTENCY': {
      const current = state.spus.find((s) => s.spu === action.spu);
      const images = action.images ?? current?.qcImages;
      if (!current || !canConfirmConsistency(images)) return state;
      const at = nowLabel();
      return {
        ...state,
        spus: patchSpu(state.spus, action.spu, {
          qcImages: images,
          qcStatus: deriveQcStatus(images),
          consistencyStatus: '已确认',
          consistencyConfirmedBy: action.operator,
          consistencyConfirmedAt: at,
          updatedAt: at,
          updatedBy: action.operator,
        }),
      };
    }
    case 'REVOKE_CONSISTENCY': {
      const current = state.spus.find((s) => s.spu === action.spu);
      if (!current) return state;
      return {
        ...state,
        spus: patchSpu(state.spus, action.spu, {
          consistencyStatus: '未确认',
          consistencyConfirmedBy: undefined,
          consistencyConfirmedAt: undefined,
          updatedAt: nowLabel(),
          updatedBy: action.operator,
        }),
      };
    }
    case 'DISPATCH': {
      const at = nowLabel();
      return {
        ...state,
        mainTasks: state.mainTasks.map((t) => {
          if (!action.ids.includes(t.id) || t.status !== '待分发') return t;
          const master = state.spus.find((s) => s.spu === t.spu);
          const snap = master
            ? snapshotFromSpu(master)
            : {
                qcImagesSnapshot: {
                  images: t.inspectionImages ?? {},
                  status: t.inspectionImageStatus,
                },
                consistencyStatus: t.consistencyStatus ?? '未确认',
                consistencyConfirmedBy: t.consistencyConfirmedBy,
                consistencyConfirmedAt: t.consistencyConfirmedAt,
                inspectionImages: t.inspectionImages,
                inspectionImageStatus: t.inspectionImageStatus,
              };
          return {
            ...t,
            ...snap,
            produceMode: action.produceMode,
            status: '待领取' as const,
            dispatchedAt: at,
          };
        }),
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
    case 'CREATE_FREE_BATCH':
      return {
        ...state,
        freeBatches: [action.batch, ...state.freeBatches],
        subtasks: [...state.subtasks, ...action.items],
      };
    case 'COMPLETE_GEN': {
      const pending = state.subtasks.filter((s) => action.ids.includes(s.id) && s.status === '生图中');
      const firstPassFree = pending.filter((s) => s.source === '手动批量' && s.generateCount <= 1);
      const demoFailId = firstPassFree.length >= 2 ? firstPassFree[firstPassFree.length - 1].id : undefined;
      return {
        ...state,
        subtasks: state.subtasks.map((s) => {
          if (!action.ids.includes(s.id) || s.status !== '生图中') return s;
          const at = nowLabel();
          if (s.id === demoFailId) {
            return appendLog({ ...s, status: '生图失败', currentResultUrl: undefined }, 'AI 生图失败，可重跑', 'system');
          }
          return appendLog(
            {
              ...s,
              status: '待提交审核',
              currentResultUrl: `result-${s.id}`,
              versions: [...(s.versions ?? []), { url: `result-${s.id}`, type: 'AI 生成', createdAt: at, operator: 'system' }],
            },
            'AI 生图成功，进入待提交审核',
            'system',
          );
        }),
      };
    }
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
      const merged = { ...sub, ...action.patch };
      return {
        ...state,
        subtasks: patchSub(state.subtasks, action.id, {
          ...appendLog(
            {
              ...merged,
              status: '生图中',
              generateCount: sub.generateCount + 1,
              currentResultUrl: undefined,
            },
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
    case 'ADD_MATERIAL': {
      const exists = categoryHasTag(state.categoryTags, action.item.category, action.item.crowdTag);
      return {
        ...state,
        materials: [action.item, ...state.materials],
        categoryTags: exists
          ? state.categoryTags
          : [
              {
                id: `TAG-${Date.now().toString().slice(-6)}`,
                category: action.item.category,
                name: action.item.crowdTag,
                status: '启用',
              },
              ...state.categoryTags,
            ],
      };
    }
    case 'ADD_CATEGORY_TAG': {
      const name = action.item.name.trim();
      if (!name || categoryHasTag(state.categoryTags, action.item.category, name)) return state;
      return { ...state, categoryTags: [{ ...action.item, name }, ...state.categoryTags] };
    }
    case 'TOGGLE_CATEGORY_TAG':
      return {
        ...state,
        categoryTags: state.categoryTags.map((t) =>
          t.id === action.id ? { ...t, status: t.status === '启用' ? '停用' : '启用' } : t,
        ),
      };
    case 'SAVE_TEMPLATE': {
      const at = nowLabel();
      const hit = state.promptTemplates.some((t) => t.category === action.category && t.angle === action.angle);
      if (!hit) {
        const version = 'v1';
        const item: PromptTemplate = {
          id: `TPL-${action.category}-${action.angle}`,
          category: action.category,
          angle: action.angle,
          version,
          status: '启用',
          content: action.content,
          versions: [{ version, createdAt: at, operator: CURRENT_OPERATOR, content: action.content }],
        };
        return { ...state, promptTemplates: [item, ...state.promptTemplates] };
      }
      return {
        ...state,
        promptTemplates: state.promptTemplates.map((t) => {
          if (t.category !== action.category || t.angle !== action.angle) return t;
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
          if (t.category !== action.category || t.angle !== action.angle) return t;
          const ver = t.versions.find((v) => v.version === action.version);
          if (!ver) return t;
          return { ...t, version: ver.version, content: ver.content, status: '启用' };
        }),
      };
    case 'SET_TEMPLATE_STATUS':
      return {
        ...state,
        promptTemplates: state.promptTemplates.map((t) =>
          t.id === action.id ? { ...t, status: action.status } : t,
        ),
      };
    case 'DELETE_TEMPLATE':
      return { ...state, promptTemplates: state.promptTemplates.filter((t) => t.id !== action.id) };
    case 'ADD_COLOR':
      return { ...state, colorDictionaries: [...state.colorDictionaries, action.item] };
    default:
      return state;
  }
}

interface BuyerShowContextValue extends BuyerShowState {
  currentDesigner: string;
  currentOperator: string;
  findMain: (id: string) => MainTask | undefined;
  findSub: (id: string) => Subtask | undefined;
  findSpu: (spu: string) => SpuMaster | undefined;
  setColor: (id: string, color: string) => void;
  setProduceMode: (id: string, produceMode: ProduceMode | undefined) => void;
  saveSpuQc: (spu: string, images: InspectionImages) => void;
  confirmConsistency: (spu: string, images?: InspectionImages) => boolean;
  revokeConsistency: (spu: string) => void;
  dispatchTasks: (ids: string[], produceMode: ProduceMode) => void;
  cancelTask: (id: string, reason: string) => void;
  claimTask: (id: string, designer?: string) => void;
  createSubtasks: (items: Subtask[]) => void;
  createFreeBatch: (batch: FreeBatch, items: Subtask[]) => void;
  completeGen: (ids: string[]) => void;
  submitSubtask: (id: string) => void;
  regenerate: (id: string, patch?: Partial<Subtask>) => void;
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
  addCategoryTag: (item: CategoryTag) => boolean;
  toggleCategoryTag: (id: string) => void;
  saveTemplate: (category: string, angle: Angle, content: string) => void;
  enableTemplate: (category: string, angle: Angle, version: string) => void;
  setTemplateStatus: (id: string, status: EnableStatus) => void;
  deleteTemplate: (id: string) => void;
  addColor: (item: ColorDictionary) => void;
}

const BuyerShowContext = createContext<BuyerShowContextValue | null>(null);

export function BuyerShowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value = useMemo<BuyerShowContextValue>(
    () => ({
      ...state,
      currentDesigner: CURRENT_DESIGNER,
      currentOperator: CURRENT_OPERATOR,
      findMain: (id) => state.mainTasks.find((t) => t.id === id),
      findSub: (id) => state.subtasks.find((s) => s.id === id),
      findSpu: (spu) => state.spus.find((s) => s.spu === spu),
      setColor: (id, color) => dispatch({ type: 'SET_COLOR', id, color }),
      setProduceMode: (id, produceMode) => dispatch({ type: 'SET_PRODUCE_MODE', id, produceMode }),
      saveSpuQc: (spu, images) => dispatch({ type: 'SAVE_SPU_QC', spu, images, operator: CURRENT_OPERATOR }),
      confirmConsistency: (spu, images) => {
        const master = state.spus.find((s) => s.spu === spu);
        const nextImages = images ?? master?.qcImages;
        if (!master || !canConfirmConsistency(nextImages)) return false;
        dispatch({ type: 'CONFIRM_CONSISTENCY', spu, operator: CURRENT_OPERATOR, images: nextImages });
        return true;
      },
      revokeConsistency: (spu) => dispatch({ type: 'REVOKE_CONSISTENCY', spu, operator: CURRENT_OPERATOR }),
      dispatchTasks: (ids, produceMode) => dispatch({ type: 'DISPATCH', ids, produceMode }),
      cancelTask: (id, reason) => dispatch({ type: 'CANCEL', id, reason }),
      claimTask: (id, designer) => dispatch({ type: 'CLAIM', id, designer: designer ?? CURRENT_DESIGNER }),
      createSubtasks: (items) => dispatch({ type: 'CREATE_SUBTASKS', items }),
      createFreeBatch: (batch, items) => dispatch({ type: 'CREATE_FREE_BATCH', batch, items }),
      completeGen: (ids) => dispatch({ type: 'COMPLETE_GEN', ids }),
      submitSubtask: (id) => dispatch({ type: 'SUBMIT_SUBTASK', id }),
      regenerate: (id, patch) => dispatch({ type: 'REGENERATE', id, patch }),
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
      addCategoryTag: (item) => {
        const name = item.name.trim();
        if (!name || categoryHasTag(state.categoryTags, item.category, name)) return false;
        dispatch({ type: 'ADD_CATEGORY_TAG', item: { ...item, name } });
        return true;
      },
      toggleCategoryTag: (id) => dispatch({ type: 'TOGGLE_CATEGORY_TAG', id }),
      saveTemplate: (category, angle, content) => dispatch({ type: 'SAVE_TEMPLATE', category, angle, content }),
      enableTemplate: (category, angle, version) => dispatch({ type: 'ENABLE_TEMPLATE', category, angle, version }),
      setTemplateStatus: (id, status) => dispatch({ type: 'SET_TEMPLATE_STATUS', id, status }),
      deleteTemplate: (id) => dispatch({ type: 'DELETE_TEMPLATE', id }),
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
