import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Table, Typography, Upload, message } from 'antd';
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
import type { Angle, CrowdTag, Subtask } from '@/types/buyer-show';
import {
  canCreateSingle,
  colorMatchDisplay,
  fillPrompt,
  image1Kind,
  isEffectiveSubtask,
  isUploadedSlot,
  matchColor,
  nextSubtaskId,
  nowLabel,
  resolveImage1,
  resolveTaskQcView,
  subsOf,
} from '@/utils/buyer-show';
import shared from '../shared.module.css';

export default function ProduceSingle() {
  const { role } = useRole();
  const isDesigner = role === '买家秀设计';
  const store = useBuyerShow();
  const { mainTasks, subtasks, materials, promptTemplates, colorDictionaries, currentDesigner } = store;
  const mains = useMemo(
    () => mainTasks.filter((t) => t.produceMode === '单个制作' && (t.status === '制作中' || t.status === '返修中')),
    [mainTasks],
  );
  const prefer = mains.find((t) => t.assignee === currentDesigner) ?? mains[0];
  const [mainId, setMainId] = useState(prefer?.id ?? '');
  const current = mains.find((t) => t.id === mainId) ?? prefer;
  const children = current ? subsOf(subtasks, current.id) : [];
  const qcView = current ? resolveTaskQcView(current, store.findSpu(current.spu)) : undefined;
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ color: string; angle: Angle; tag: CrowdTag; img2: string; img3?: string; prompt: string }>();

  const refreshDerived = (angle?: Angle, color?: string) => {
    if (!current) return;
    const a = angle ?? form.getFieldValue('angle');
    const c = color ?? form.getFieldValue('color');
    const p = fillPrompt(current, a, c, promptTemplates, colorDictionaries);
    form.setFieldsValue({ prompt: p.text });
  };

  const openNew = () => {
    if (!current || !canCreateSingle(current, children)) {
      message.warning('子任务数已达需要数量');
      return;
    }
    const angle = ANGLES[children.length % 4];
    const img1 = resolveImage1(current, angle);
    const p = fillPrompt(current, angle, current.color, promptTemplates, colorDictionaries);
    form.setFieldsValue({
      color: current.color ?? '',
      angle,
      tag: '',
      img2: '',
      img3: '',
      prompt: p.text,
    });
    setOpen(true);
    return img1;
  };

  const angle = Form.useWatch('angle', form) as Angle | undefined;
  const color = Form.useWatch('color', form) as string | undefined;
  const tag = Form.useWatch('tag', form) as CrowdTag | undefined;
  const img1 = current && angle ? resolveImage1(current, angle) : undefined;
  const promptWatch = Form.useWatch('prompt', form) as string | undefined;
  const match = matchColor(color, colorDictionaries);
  const tpl = current && angle ? fillPrompt(current, angle, color, promptTemplates, colorDictionaries) : undefined;

  const columns: ColumnsType<Subtask> = [
    { title: '子任务编号', dataIndex: 'id' },
    { title: '颜色', dataIndex: 'color' },
    { title: '角度', dataIndex: 'angle' },
    { title: '标签', dataIndex: 'crowdTag', render: (v?: string) => <StatusTag value={v} /> },
    { title: '图1 来源', render: (_, s) => <StatusTag value={s.image1.source} /> },
    { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} /> },
    { title: '生成次数', dataIndex: 'generateCount' },
    { title: '审核轮次', dataIndex: 'reviewRound', render: (v: number) => v || '—' },
    {
      title: '操作',
      render: (_, s) => {
        const view = <Link to={`/buyer-show/subtask/${s.id}`}>查看</Link>;
        if (!isDesigner) return view;
        if (s.status === '待提交审核' || s.status === '审核失败') {
          return (
            <Space wrap>
              {view}
              <Button type="link" size="small" onClick={() => { store.submitSubtask(s.id); message.success('已提交审核'); }}>
                提交审核
              </Button>
              <Button type="link" size="small" onClick={() => { store.regenerate(s.id); message.success('重新生成，进入【生图中】'); }}>
                重新生成
              </Button>
              <Button type="link" size="small" onClick={() => { store.markEditing(s.id); message.success('已标记【修改中】'); }}>
                标记修改中
              </Button>
            </Space>
          );
        }
        if (s.status === '修改中') {
          return (
            <Button type="link" size="small" onClick={() => { store.uploadOverride(s.id); message.success('上传覆盖成功 → 【待提交审核】'); }}>
              上传覆盖
            </Button>
          );
        }
        if (s.status === '生图失败') {
          return (
            <Space>
              <Button type="link" size="small" onClick={() => { store.retry(s.id); message.success('重试（沿用参数），进入【生图中】'); }}>
                重试
              </Button>
              <Button type="link" size="small" onClick={() => { store.regenerate(s.id); message.success('重新生成，进入【生图中】'); }}>
                重新生成
              </Button>
            </Space>
          );
        }
        return view;
      },
    },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        单个制作
        <span className={shared.sub}>设计 · 逐条新建子任务</span>
      </Typography.Title>
      <Alert
        className={shared.notice}
        type="info"
        showIcon
        message="主任务制作方式为「单个制作」时，在主任务下逐条【新建子任务】。字段与自动填充规则与批量制作一致。子任务数达到需要数量后不可再新建（返修中补建除外）。"
      />

      <Card className={shared.card} size="small">
        <Space wrap>
          <span>主任务</span>
          <Select
            style={{ width: 420 }}
            value={current?.id}
            onChange={setMainId}
            options={mains.map((t) => ({
              value: t.id,
              label: `${t.id} / ${t.spu} / ${t.spuName} / ${t.assignee ?? ''}`,
            }))}
          />
          {current ? (
            <span>
              需要数量 {current.requiredCount} · 已创建 {children.length} · 有效 {children.filter(isEffectiveSubtask).length}{' '}
              <StatusTag value={current.status} /> <StatusTag value={current.produceMode} />{' '}
              {qcView ? <QcCoverageTag images={qcView.images} status={qcView.status} /> : null}
              {qcView ? <ConsistencyTag status={qcView.consistencyStatus} /> : null}
            </span>
          ) : null}
          {isDesigner ? (
            <Button type="primary" disabled={!current || !canCreateSingle(current, children)} onClick={openNew}>
              新建子任务
            </Button>
          ) : null}
        </Space>
      </Card>

      <Card size="small" title="子任务列表">
        <Table rowKey="id" size="small" columns={columns} dataSource={children} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: '暂无子任务' }} />
      </Card>

      <Modal
        title="新建子任务"
        open={open}
        width={720}
        onCancel={() => setOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          if (!current) return;
          store.createSubtasks([
            {
              id: nextSubtaskId(current.id, children.length),
              mainTaskId: current.id,
              spu: current.spu,
              color: values.color,
              angle: values.angle,
              category: current.category,
              crowdTag: values.tag,
              sceneTag: '默认场景',
              produceMode: '单个制作',
              status: '生图中',
              reviewRound: 0,
              generateCount: 1,
              assignee: currentDesigner,
              createdAt: nowLabel(),
              image1: { url: img1?.label ?? '', source: img1?.source ?? '手动' },
              image2: isUploadedSlot(values.img2)
                ? { url: values.img2, source: '手动' }
                : { url: values.img2, materialId: values.img2, source: '参考图' },
              image3: values.img3
                ? isUploadedSlot(values.img3)
                  ? { url: values.img3, source: '手动' }
                  : { url: values.img3, materialId: values.img3 }
                : undefined,
              prompt: values.prompt,
              templateVersion: tpl?.ver,
              colorMatchStatus: match,
              operationLogs: [{ action: '创建子任务，进入生图中', operator: currentDesigner, createdAt: nowLabel() }],
            },
          ]);
          setOpen(false);
          message.success('已创建子任务，状态【生图中】');
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="SPU / 任务编号">
            <span>
              {current?.spu} / {current?.id}
            </span>
          </Form.Item>
          <Form.Item name="color" label="颜色" rules={[{ required: true, message: '请填写颜色' }]}>
            <Input
              onChange={(e) => refreshDerived(undefined, e.target.value)}
            />
          </Form.Item>
          <Form.Item name="angle" label="角度" rules={[{ required: true }]}>
            <Select
              options={ANGLES.map((a) => ({ value: a, label: a }))}
              onChange={(a) => {
                refreshDerived(a);
                const img2 = form.getFieldValue('img2') as string | undefined;
                form.setFieldsValue({
                  tag: undefined,
                  img2: isUploadedSlot(img2) ? img2 : '',
                  img3: isUploadedSlot(form.getFieldValue('img3')) ? form.getFieldValue('img3') : '',
                });
              }}
            />
          </Form.Item>
          <Form.Item
            name="tag"
            label="标签"
            extra="从库选图2/图3时必选；手传可不选"
            rules={[
              {
                validator: (_, v) => {
                  const img2 = form.getFieldValue('img2') as string | undefined;
                  if (img2 && !isUploadedSlot(img2) && !v) {
                    return Promise.reject(new Error('从库选择图2时请先选标签'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <LibraryTagSelect
              materials={materials}
              category={current?.category}
              angle={angle}
              allowEmpty
            />
          </Form.Item>
          <Form.Item label="图1">
            {img1 ? (
              <>
                <ImagePlaceholder label={img1.label} kind={image1Kind(img1.source)} size="md" source={img1.source} />
                <div style={{ color: 'rgba(0,0,0,0.45)', marginTop: 8 }}>来源：{img1.source}</div>
              </>
            ) : null}
          </Form.Item>
          <Form.Item name="img2" label="图2" rules={[{ required: true, message: '请选择或上传图2' }]}>
            <MaterialPicker
              materials={materials}
              category={current?.category}
              crowdTag={tag}
              angle={angle}
              emptyLabel="从参考图库选择"
            />
          </Form.Item>
          <Upload
            showUploadList={false}
            beforeUpload={() => {
              form.setFieldsValue({ img2: `已上传参考图·${angle ?? ''}` });
              message.success('已上传图2（演示）');
              return false;
            }}
          >
            <Button type="link" size="small" style={{ marginTop: -12, marginBottom: 12 }}>
              上传/替换图2
            </Button>
          </Upload>
          <Form.Item name="img3" label="图3（选填）">
            <MaterialPicker
              materials={materials}
              category={current?.category}
              crowdTag={tag}
              angle={angle}
              emptyLabel="从参考图库选择"
            />
          </Form.Item>
          <Upload
            showUploadList={false}
            beforeUpload={() => {
              form.setFieldsValue({ img3: `已上传图3·${angle ?? ''}` });
              return false;
            }}
          >
            <Button type="link" size="small" style={{ marginTop: -12, marginBottom: 12 }}>
              上传/替换图3
            </Button>
          </Upload>
          <Form.Item name="prompt" label="描述词" rules={[{ required: true, message: '请填写描述词' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>模板版本 {tpl?.ver}</div>
          <Form.Item label="色值匹配状态">
            <StatusTag value={colorMatchDisplay(match, promptWatch ?? '')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
