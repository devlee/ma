import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Table, Typography, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { LibraryTagSelect } from '@/components/LibraryTagSelect';
import { MaterialPicker } from '@/components/MaterialPicker';
import { ConsistencyTag } from '@/components/ConsistencyTag';
import { QcCoverageTag } from '@/components/QcImageEditor';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, CrowdTag, Image1Source, MainTask, Subtask } from '@/types/buyer-show';
import {
  colorHex,
  fillPrompt,
  image1Kind,
  colorMatchDisplay,
  isUploadedSlot,
  matchColor,
  nextSubtaskId,
  nowLabel,
  resolveImage1,
  resolveTaskQcView,
  shouldShowMainSubmit,
  subsOf,
} from '@/utils/buyer-show';
import shared from '../shared.module.css';

interface DraftRow {
  key: string;
  mainId: string;
  idx: number;
  color: string;
  angle: Angle;
  tag: CrowdTag;
  img1Source: Image1Source;
  img1Label: string;
  img2: string;
  img3: string;
  prompt: string;
  ver: string;
  match: '匹配成功' | '未匹配';
  error: boolean;
  promptOpen: boolean;
}

export default function ProduceBatch() {
  const { isDesigner, actor } = useRole();
  const store = useBuyerShow();
  const { mainTasks, subtasks, materials, categoryTags, promptTemplates, colorDictionaries } = store;
  const [selectedMains, setSelectedMains] = useState<string[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [adjKeys, setAdjKeys] = useState<string[]>([]);
  const [adjTag, setAdjTag] = useState<CrowdTag | ''>('');
  const [adjImg2, setAdjImg2] = useState('');
  const [adjImg3, setAdjImg3] = useState('');
  const [adjPrompt, setAdjPrompt] = useState('');

  const myMains = useMemo(
    () =>
      mainTasks.filter(
        (t) => t.status === '制作中' && t.assignee === actor && t.produceMode === '批量制作',
      ),
    [mainTasks, actor],
  );

  const createdCount = (id: string) => subsOf(subtasks, id).length;
  const remain = (t: MainTask) => Math.max(0, t.requiredCount - createdCount(t.id));

  const expand = (ids = selectedMains) => {
    if (!ids.length) {
      message.warning('请先勾选主任务');
      return;
    }
    const next: DraftRow[] = [];
    ids.forEach((id) => {
      const t = mainTasks.find((x) => x.id === id);
      if (!t) return;
      const exist = createdCount(id);
      const n = remain(t);
      for (let i = 0; i < n; i += 1) {
        const angle = ANGLES[(exist + i) % 4];
        const img1 = resolveImage1(t, angle);
        const p = fillPrompt(t, angle, t.color, promptTemplates, colorDictionaries);
        next.push({
          key: `${id}-${exist + i + 1}`,
          mainId: id,
          idx: exist + i + 1,
          color: t.color ?? '',
          angle,
          tag: '',
          img1Source: img1.source,
          img1Label: img1.label,
          img2: '',
          img3: '',
          prompt: p.text,
          ver: p.ver,
          match: matchColor(t.color, colorDictionaries),
          error: false,
          promptOpen: false,
        });
      }
    });
    if (!next.length) message.info('所选主任务已无剩余可创建数量');
    setRows(next);
  };

  useEffect(() => {
    const first = myMains[0];
    if (first && !selectedMains.length) {
      setSelectedMains([first.id]);
      expand([first.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏自动展开
  }, [myMains.length]);

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const t = mainTasks.find((x) => x.id === next.mainId);
        if (t && (patch.angle || patch.color !== undefined)) {
          const img1 = resolveImage1(t, next.angle);
          next.img1Source = img1.source;
          next.img1Label = img1.label;
          next.match = matchColor(next.color, colorDictionaries);
          const p = fillPrompt(t, next.angle, next.color, promptTemplates, colorDictionaries);
          next.prompt = p.text;
          next.ver = p.ver;
        } else if (patch.color !== undefined) {
          next.match = matchColor(next.color, colorDictionaries);
        }
        if ((patch.tag || patch.angle) && !isUploadedSlot(next.img2)) next.img2 = '';
        return next;
      }),
    );
  };

  const create = () => {
    const checked = rows.map((r) => {
      const error =
        !r.color ||
        !r.angle ||
        !r.img2 ||
        (!isUploadedSlot(r.img2) && !r.tag) ||
        !r.prompt ||
        (r.img1Source === '手动' && r.img1Label.includes('请手动'));
      return { ...r, error };
    });
    setRows(checked);
    if (checked.some((r) => r.error)) {
      message.error('存在未通过校验的行，已标红');
      return;
    }
    const items: Subtask[] = checked.map((r) => {
      const t = mainTasks.find((x) => x.id === r.mainId)!;
      return {
        id: nextSubtaskId(r.mainId, r.idx - 1),
        mainTaskId: r.mainId,
        spu: t.spu,
        color: r.color,
        angle: r.angle,
        category: t.category,
        crowdTag: r.tag,
        sceneTag: '默认场景',
        produceMode: '批量制作',
        status: '生图中',
        reviewRound: 0,
        generateCount: 1,
        assignee: actor,
        createdAt: nowLabel(),
        image1: { url: r.img1Label, source: r.img1Source },
        image2: isUploadedSlot(r.img2)
          ? { url: r.img2, source: '手动' }
          : { url: r.img2, materialId: r.img2, source: '参考图' },
        image3: r.img3
          ? isUploadedSlot(r.img3)
            ? { url: r.img3, source: '手动' }
            : { url: r.img3, materialId: r.img3 }
          : undefined,
        prompt: r.prompt,
        templateVersion: r.ver,
        colorMatchStatus: r.match,
        operationLogs: [{ action: '创建子任务，进入生图中', operator: actor, createdAt: nowLabel() }],
      };
    });
    store.createSubtasks(items);
    setRows([]);
    message.success('创建成功，每行生成一条子任务，状态【生图中】');
  };

  const adjList = subtasks.filter((s) => {
    const main = mainTasks.find((t) => t.id === s.mainTaskId);
    return main?.assignee === actor && (s.status === '待提交审核' || s.status === '审核失败');
  });

  const waitMains = mainTasks.filter((t) => t.assignee === actor && shouldShowMainSubmit(t, subsOf(subtasks, t.id)));

  const mainCols: ColumnsType<MainTask> = [
    { title: '任务编号', dataIndex: 'id' },
    {
      title: 'SPU',
      dataIndex: 'spu',
      render: (_, t) => (
        <>
          {t.spu}
          <div style={{ color: 'rgba(0,0,0,0.45)' }}>{t.spuName}</div>
        </>
      ),
    },
    { title: '品类', dataIndex: 'category' },
    { title: '需要数量', dataIndex: 'requiredCount' },
    { title: '已创建子任务', render: (_, t) => createdCount(t.id) },
    { title: '剩余可展开', render: (_, t) => remain(t) },
    { title: '颜色', dataIndex: 'color', render: (v?: string) => v || '—' },
    {
      title: '质检图状态',
      render: (_, t) => {
        const view = resolveTaskQcView(t, store.findSpu(t.spu));
        return <QcCoverageTag images={view.images} status={view.status} />;
      },
    },
    {
      title: '实物一致性',
      render: (_, t) => {
        const view = resolveTaskQcView(t, store.findSpu(t.spu));
        return <ConsistencyTag status={view.consistencyStatus} />;
      },
    },
    { title: '主任务状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} /> },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        批量制作
        <span className={shared.sub}>设计 · 按需要数量展开行</span>
      </Typography.Title>
      <Alert
        className={shared.notice}
        type="info"
        showIcon
        message="在自己【制作中】的主任务中勾选一个或多个。每个主任务按需要数量展开为等量的行；已存在子任务的，仅展开尚未创建的剩余数量。"
      />

      <Card
        className={shared.card}
        size="small"
        title="我的制作中主任务"
        extra={
          isDesigner ? (
            <Button type="primary" onClick={() => expand()}>
              批量制作
            </Button>
          ) : null
        }
      >
        <Table
          rowKey="id"
          size="small"
          columns={mainCols}
          dataSource={myMains}
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '暂无自己【制作中】且制作方式为批量制作的主任务' }}
          rowSelection={{
            selectedRowKeys: selectedMains,
            onChange: (keys) => setSelectedMains(keys.map(String)),
          }}
        />
      </Card>

      <Card
        className={shared.card}
        size="small"
        title="待创建子任务（行展开）"
        extra={<span style={{ color: 'rgba(0,0,0,0.45)' }}>必填：颜色、角度、图1、图2、描述词。图2 先选标签再调库，或手传；图3 选填，可调库或手传。</span>}
      >
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={rows}
          locale={{ emptyText: '勾选上方主任务后点击【批量制作】展开' }}
          rowClassName={(r) => (r.error ? shared.rowError : r.match === '未匹配' ? shared.unmatch : '')}
          columns={[
            {
              title: 'SPU / 任务编号',
              width: 150,
              render: (_, r) => {
                const t = mainTasks.find((x) => x.id === r.mainId);
                return (
                  <>
                    {t?.spu}
                    <div style={{ color: 'rgba(0,0,0,0.45)' }}>{t?.id}</div>
                  </>
                );
              },
            },
            {
              title: '颜色',
              width: 110,
              render: (_, r) => <Input value={r.color} onChange={(e) => patchRow(r.key, { color: e.target.value })} />,
            },
            {
              title: '角度',
              width: 110,
              render: (_, r) => (
                <Select
                  value={r.angle}
                  style={{ width: 90 }}
                  options={ANGLES.map((a) => ({ value: a, label: a }))}
                  onChange={(angle) => patchRow(r.key, { angle })}
                />
              ),
            },
            {
              title: '标签',
              width: 140,
              render: (_, r) => {
                const t = mainTasks.find((x) => x.id === r.mainId);
                return (
                  <LibraryTagSelect
                    value={r.tag}
                    materials={materials}
                    categoryTags={categoryTags}
                    category={t?.category}
                    style={{ width: 120 }}
                    onChange={(tag) => patchRow(r.key, { tag })}
                  />
                );
              },
            },
            {
              title: '图1',
              width: 130,
              render: (_, r) => (
                <div>
                  <ImagePlaceholder label={r.img1Label} kind={image1Kind(r.img1Source)} size="md" source={r.img1Source} />
                  <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>来源：{r.img1Source}</div>
                </div>
              ),
            },
            {
              title: '图2',
              width: 200,
              render: (_, r) => {
                const t = mainTasks.find((x) => x.id === r.mainId);
                return (
                  <div>
                    <ImagePlaceholder label={r.img2 || '请选择或上传'} kind={r.img2 ? 'mat' : ''} size="md" />
                    <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>
                      {r.tag ? `图库：${t?.category}-${r.tag}-${r.angle}` : '先选标签再调库，或直接上传'}
                    </div>
                    <MaterialPicker
                      value={isUploadedSlot(r.img2) ? undefined : r.img2}
                      materials={materials}
                      category={t?.category}
                      crowdTag={r.tag}
                      angle={r.angle}
                      emptyLabel="从参考图库选择"
                      onChange={(img2) => patchRow(r.key, { img2 })}
                      style={{ marginTop: 8, width: '100%' }}
                    />
                    <Upload
                      showUploadList={false}
                      beforeUpload={() => {
                        patchRow(r.key, { img2: `已上传参考图·${r.angle}` });
                        message.success('已上传图2（演示）');
                        return false;
                      }}
                    >
                      <Button type="link" size="small">
                        上传/替换
                      </Button>
                    </Upload>
                  </div>
                );
              },
            },
            {
              title: '图3',
              width: 200,
              render: (_, r) => {
                const t = mainTasks.find((x) => x.id === r.mainId);
                return (
                  <div>
                    <ImagePlaceholder label={r.img3 || '图3 选填'} kind={r.img3 ? 'mat' : ''} size="md" />
                    <MaterialPicker
                      value={isUploadedSlot(r.img3) ? undefined : r.img3}
                      materials={materials}
                      category={t?.category}
                      crowdTag={r.tag}
                      angle={r.angle}
                      emptyLabel="从参考图库选择"
                      onChange={(img3) => patchRow(r.key, { img3 })}
                      style={{ marginTop: 8, width: '100%' }}
                    />
                    <Upload
                      showUploadList={false}
                      beforeUpload={() => {
                        patchRow(r.key, { img3: `已上传图3·${r.angle}` });
                        return false;
                      }}
                    >
                      <Button type="link" size="small">
                        上传/替换
                      </Button>
                    </Upload>
                  </div>
                );
              },
            },
            {
              title: '描述词',
              width: 280,
              render: (_, r) => (
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                    模板 {r.ver}{' '}
                    <Button type="link" size="small" onClick={() => patchRow(r.key, { promptOpen: !r.promptOpen })}>
                      {r.promptOpen ? '收起' : '展开编辑'}
                    </Button>
                  </div>
                  {r.promptOpen ? (
                    <Input.TextArea rows={4} value={r.prompt} onChange={(e) => patchRow(r.key, { prompt: e.target.value })} />
                  ) : null}
                  {r.match === '未匹配' ? (
                    <Button
                      size="small"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const hex = colorHex(r.color, colorDictionaries) || '#CCCCCC';
                        store.addColor({
                          id: `CLR-${Date.now()}`,
                          name: r.color,
                          aliases: [],
                          hex,
                          description: '批量制作页存入',
                        });
                        message.success(`已将颜色「${r.color}」存入词典`);
                      }}
                    >
                      存入词典
                    </Button>
                  ) : null}
                </div>
              ),
            },
            { title: '色值匹配状态', width: 140, render: (_, r) => <StatusTag value={colorMatchDisplay(r.match, r.prompt)} /> },
          ]}
        />
        <div className={shared.toolbar} style={{ marginTop: 12 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>
            色值未匹配不拦截，可在描述词色值槽手填后继续创建。可一键【存入词典】。
          </span>
          {isDesigner ? (
            <Button type="primary" onClick={create} disabled={!rows.length}>
              批量创建任务
            </Button>
          ) : null}
        </div>
      </Card>

      <Card
        className={shared.card}
        size="small"
        title="批量调整"
        extra={<span style={{ color: 'rgba(0,0,0,0.45)' }}>勾选【待提交审核】或【审核失败】，不改变颜色与角度。</span>}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={adjList}
          rowSelection={{ selectedRowKeys: adjKeys, onChange: (keys) => setAdjKeys(keys.map(String)) }}
          columns={[
            { title: '子任务编号', dataIndex: 'id' },
            {
              title: '主任务 / SPU',
              render: (_, s) => {
                const t = mainTasks.find((x) => x.id === s.mainTaskId);
                return (
                  <>
                    {t?.id}
                    <div style={{ color: 'rgba(0,0,0,0.45)' }}>{t?.spu}</div>
                  </>
                );
              },
            },
            { title: '颜色', dataIndex: 'color' },
            { title: '角度', dataIndex: 'angle' },
            { title: '标签', dataIndex: 'crowdTag', render: (v?: string) => <StatusTag value={v} /> },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} /> },
            { title: '图2', render: (_, s) => s.image2.materialId || '—' },
            { title: '图3', render: (_, s) => s.image3?.materialId || '—' },
          ]}
        />
        <Space wrap style={{ marginTop: 12 }}>
          <span>批量改 标签</span>
          <LibraryTagSelect
            value={adjTag}
            materials={materials}
            categoryTags={categoryTags}
            allowEmpty
            emptyLabel="不修改"
            style={{ width: 140 }}
            onChange={setAdjTag}
          />
          <span>图2</span>
          <MaterialPicker value={adjImg2} materials={materials} emptyLabel="不修改" onChange={setAdjImg2} />
          <span>图3</span>
          <MaterialPicker value={adjImg3} materials={materials} emptyLabel="不修改" onChange={setAdjImg3} />
        </Space>
        <Input.TextArea
          style={{ marginTop: 12 }}
          rows={3}
          placeholder="留空则不修改描述词"
          value={adjPrompt}
          onChange={(e) => setAdjPrompt(e.target.value)}
        />
        {isDesigner ? (
          <Button
            type="primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              if (!adjKeys.length) {
                message.warning('请勾选子任务');
                return;
              }
              store.batchRegen(adjKeys, {
                crowdTag: adjTag || undefined,
                img2: adjImg2 || undefined,
                img3: adjImg3 || undefined,
                prompt: adjPrompt.trim() || undefined,
              });
              setAdjKeys([]);
              message.success('已批量重新生成，子任务进入【生图中】；颜色与角度未改');
            }}
          >
            批量重新生成
          </Button>
        ) : null}
      </Card>

      {waitMains.map((t) => (
        <Card key={t.id} size="small" className={shared.card}>
          <div className={shared.toolbar}>
            <div>
              主任务 <b>{t.id}</b> 全部有效子任务处于【待审核】且子任务数 = 需要数量，当前【待提交审核】。
            </div>
            {isDesigner ? (
              <Button
                type="primary"
                onClick={() => {
                  store.submitMain(t.id);
                  message.success(
                    t.submittedAt ? '非首轮提交，主任务进入【返修待审核】' : '首轮提交，主任务进入【待审核】，审核轮次 +1',
                  );
                }}
              >
                提交审核
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
