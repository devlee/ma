import { useMemo, useState, type Key } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { ReasonModal } from '@/components/ReasonModal';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES, CATEGORIES, DESIGNERS, MAIN_STATUSES, PRODUCE_MODES, QC_STATUSES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, InspectionImages, MainTask, ProduceMode } from '@/types/buyer-show';
import { canCancel } from '@/utils/buyer-show';
import shared from '../shared.module.css';

const { RangePicker } = DatePicker;

interface Filters {
  spu?: string;
  id?: string;
  category?: string;
  status?: string;
  qc?: string;
  produceMode?: string;
  assignee?: string;
  issuedRange?: [Dayjs, Dayjs];
}

export default function TaskList() {
  const { role } = useRole();
  const isOps = role === '运营';
  const { mainTasks, setColor, setProduceMode, saveQc, dispatchTasks, cancelTask } = useBuyerShow();
  const [form] = Form.useForm<Filters>();
  const [applied, setApplied] = useState<Filters>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [drawerId, setDrawerId] = useState<string>();
  const [qcId, setQcId] = useState<string>();
  const [qcDraft, setQcDraft] = useState<InspectionImages>({});
  const [cancelId, setCancelId] = useState<string>();
  const [distOpen, setDistOpen] = useState(false);
  const [distIds, setDistIds] = useState<string[]>([]);
  const [distMode, setDistMode] = useState<ProduceMode>();

  const filtered = useMemo(() => {
    return mainTasks.filter((t) => {
      if (applied.spu && !t.spu.includes(applied.spu) && !t.spuName.includes(applied.spu)) return false;
      if (applied.id && !t.id.includes(applied.id)) return false;
      if (applied.category && t.category !== applied.category) return false;
      if (applied.status && t.status !== applied.status) return false;
      if (applied.qc && t.inspectionImageStatus !== applied.qc) return false;
      if (applied.produceMode === '未指定' && t.produceMode) return false;
      if (applied.produceMode && applied.produceMode !== '未指定' && t.produceMode !== applied.produceMode) return false;
      if (applied.assignee && t.assignee !== applied.assignee) return false;
      if (applied.issuedRange) {
        const day = t.issuedAt.slice(0, 10);
        const from = applied.issuedRange[0].format('YYYY-MM-DD');
        const to = applied.issuedRange[1].format('YYYY-MM-DD');
        if (day < from || day > to) return false;
      }
      return true;
    });
  }, [mainTasks, applied]);

  const drawerTask = mainTasks.find((t) => t.id === drawerId);

  const openQc = (id: string) => {
    const t = mainTasks.find((x) => x.id === id);
    if (!t) return;
    setQcId(id);
    setQcDraft({ ...(t.inspectionImages ?? {}) });
  };

  const openDist = (ids: string[]) => {
    if (!ids.length) {
      message.warning('请先勾选主任务');
      return;
    }
    setDistIds(ids);
    setDistMode(undefined);
    setDistOpen(true);
  };

  const columns: ColumnsType<MainTask> = [
    {
      title: '任务编号',
      dataIndex: 'id',
      width: 170,
      fixed: 'left',
    },
    {
      title: 'SPU',
      dataIndex: 'spu',
      width: 160,
      render: (_, t) => (
        <span className={shared.spuLink} onClick={() => setDrawerId(t.id)}>
          {t.spu}
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{t.spuName}</div>
        </span>
      ),
    },
    { title: '品类', dataIndex: 'category', width: 88 },
    { title: '需要数量', dataIndex: 'requiredCount', width: 88 },
    { title: '已完成数量', dataIndex: 'completedCount', width: 100 },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 110,
      render: (_, t) =>
        isOps ? (
          <Input
            size="small"
            value={t.color}
            onChange={(e) => setColor(t.id, e.target.value)}
          />
        ) : (
          t.color || '—'
        ),
    },
    {
      title: '质检图状态',
      dataIndex: 'inspectionImageStatus',
      width: 110,
      render: (v: string) => <StatusTag value={v} />,
    },
    {
      title: '制作方式',
      dataIndex: 'produceMode',
      width: 130,
      render: (_, t) =>
        isOps ? (
          <Select
            size="small"
            style={{ width: 112 }}
            value={t.produceMode}
            disabled={t.status !== '待分发'}
            allowClear
            placeholder="未指定"
            options={PRODUCE_MODES.map((m) => ({ value: m, label: m }))}
            onChange={(v) => setProduceMode(t.id, v)}
          />
        ) : (
          <StatusTag value={t.produceMode ?? '未指定'} />
        ),
    },
    {
      title: '主任务状态',
      dataIndex: 'status',
      width: 120,
      render: (v: string) => <StatusTag value={v} />,
    },
    { title: '制作人', dataIndex: 'assignee', width: 88, render: (v?: string) => v || '—' },
    { title: '下发时间', dataIndex: 'issuedAt', width: 160 },
    { title: '分发时间', dataIndex: 'dispatchedAt', width: 160, render: (v?: string) => v || '—' },
    { title: '认领时间', dataIndex: 'claimedAt', width: 160, render: (v?: string) => v || '—' },
    { title: '提交时间', dataIndex: 'submittedAt', width: 160, render: (v?: string) => v || '—' },
    { title: '审核完成时间', dataIndex: 'reviewedAt', width: 160, render: (v?: string) => v || '—' },
    { title: '推送时间', dataIndex: 'pushedAt', width: 160, render: (v?: string) => v || '—' },
    {
      title: '操作',
      key: 'ops',
      width: 220,
      fixed: 'right',
      render: (_, t) => (
        <Space size={4} wrap>
          {isOps ? (
            <Button type="link" size="small" onClick={() => openQc(t.id)}>
              配置质检图
            </Button>
          ) : null}
          {isOps ? (
            <Button type="link" size="small" onClick={() => openDist([t.id])}>
              分发
            </Button>
          ) : null}
          {isOps && canCancel(t.status) ? (
            <Button type="link" size="small" danger onClick={() => setCancelId(t.id)}>
              取消
            </Button>
          ) : null}
          <Button type="link" size="small" onClick={() => setDrawerId(t.id)}>
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        任务清单页
        <span className={shared.sub}>运营 · 承接灵鉴主任务</span>
      </Typography.Title>

      <Card className={shared.card} size="small">
        <Form
          form={form}
          layout="inline"
          onFinish={(v) => setApplied(v)}
        >
          <Form.Item name="spu" label="SPU">
            <Input placeholder="文本" allowClear style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="id" label="任务编号">
            <Input placeholder="主任务编号" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Select allowClear placeholder="全部" style={{ width: 110 }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="status" label="主任务状态">
            <Select allowClear placeholder="全部" style={{ width: 130 }} options={MAIN_STATUSES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="qc" label="质检图状态">
            <Select allowClear placeholder="全部" style={{ width: 120 }} options={QC_STATUSES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="produceMode" label="制作方式">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 120 }}
              options={[{ value: '未指定', label: '未指定' }, ...PRODUCE_MODES.map((c) => ({ value: c, label: c }))]}
            />
          </Form.Item>
          <Form.Item name="assignee" label="制作人">
            <Select allowClear placeholder="全部" style={{ width: 110 }} options={DESIGNERS.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="issuedRange" label="时间范围">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                查询
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  setApplied({});
                }}
              >
                重置
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card
        size="small"
        title="主任务列表"
        extra={
          isOps ? (
            <Space>
              <Button type="primary" onClick={() => openDist(selectedRowKeys.map(String))}>
                分发
              </Button>
              <Button
                onClick={() => {
                  message.success(
                    selectedRowKeys.length
                      ? `导出勾选的 ${selectedRowKeys.length} 条（沿用调色任务规则）`
                      : '未勾选，按筛选条件全量导出',
                  );
                }}
              >
                导出
              </Button>
            </Space>
          ) : null
        }
      >
        <Table
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 2400 }}
          pagination={{ pageSize: 10 }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        />
      </Card>

      <Drawer
        title={drawerTask ? `${drawerTask.spu} · ${drawerTask.spuName}` : 'SPU 详情'}
        open={Boolean(drawerId)}
        width={480}
        onClose={() => setDrawerId(undefined)}
        extra={
          isOps && drawerTask ? (
            <Button type="primary" onClick={() => openQc(drawerTask.id)}>
              配置质检图
            </Button>
          ) : null
        }
      >
        {drawerTask ? (
          <>
            <Typography.Title level={5}>商品图</Typography.Title>
            <div className={shared.refRow} style={{ marginBottom: 16 }}>
              {Object.entries(drawerTask.productImages)
                .filter(([, v]) => v)
                .map(([k]) => (
                  <ImagePlaceholder key={k} label={`商品图·${k}`} kind="prod" size="sm" />
                ))}
            </div>
            <Typography.Title level={5}>SPU 基础信息</Typography.Title>
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="SPU">{drawerTask.spu}</Descriptions.Item>
              <Descriptions.Item label="品类">{drawerTask.category}</Descriptions.Item>
              <Descriptions.Item label="材质">{drawerTask.material}</Descriptions.Item>
              <Descriptions.Item label="需要数量">{drawerTask.requiredCount}</Descriptions.Item>
              <Descriptions.Item label="颜色">{drawerTask.color || '未指定'}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>
              质检图配置 <StatusTag value={drawerTask.inspectionImageStatus} />
            </Typography.Title>
            <div className={shared.slots}>
              {ANGLES.map((a) => (
                <div key={a} className={`${shared.slot} ${drawerTask.inspectionImages?.[a] ? shared.slotFilled : ''}`}>
                  <ImagePlaceholder
                    label={drawerTask.inspectionImages?.[a] ? `质检图·${a}` : `未配置·${a}`}
                    kind={drawerTask.inspectionImages?.[a] ? 'qc' : ''}
                    size="fluid"
                  />
                  <div>{a}</div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </Drawer>

      <Modal
        title="配置质检图"
        open={Boolean(qcId)}
        width={820}
        onCancel={() => setQcId(undefined)}
        onOk={() => {
          if (!qcId) return;
          saveQc(qcId, qcDraft);
          setQcId(undefined);
          message.success(`质检图已保存，状态：${deriveLabel(qcDraft)}`);
        }}
      >
        <p style={{ color: 'rgba(0,0,0,0.45)' }}>
          按角度配置：正面、侧面、背面、半身。允许部分配置；未配置的角度在制作时按兜底规则取商品图。0 个槽位 = 未配置；4 个 = 已配置；其余 = 部分配置。
        </p>
        <p>
          当前主任务：<b>{qcId}</b>
        </p>
        <div className={shared.slots}>
          {ANGLES.map((a) => {
            const filled = Boolean(qcDraft[a]);
            return (
              <div key={a} className={`${shared.slot} ${filled ? shared.slotFilled : ''}`}>
                <ImagePlaceholder label={filled ? `已上传·${a}` : '点击上传/选择'} kind={filled ? 'qc' : ''} size="fluid" />
                <div style={{ margin: '8px 0' }}>
                  <b>{a}</b>
                </div>
                <Button
                  size="small"
                  onClick={() =>
                    setQcDraft((prev) => {
                      const next = { ...prev };
                      if (next[a]) delete next[a];
                      else next[a] = `qc-${a}`;
                      return next;
                    })
                  }
                >
                  {filled ? '移除' : '上传/选择'}
                </Button>
              </div>
            );
          })}
        </div>
      </Modal>

      <ReasonModal
        open={Boolean(cancelId)}
        title="取消"
        hint="仅【待分发】【待领取】可取消。取消后主任务进入【废弃】并回传灵鉴。"
        danger
        okText="确认取消"
        onCancel={() => setCancelId(undefined)}
        onOk={(reason) => {
          if (cancelId) cancelTask(cancelId, reason);
          setCancelId(undefined);
          message.success('已取消，主任务进入【废弃】');
        }}
      />

      <Modal
        title="分发"
        open={distOpen}
        onCancel={() => setDistOpen(false)}
        onOk={() => {
          if (!distMode) {
            message.error('制作方式必填');
            return;
          }
          dispatchTasks(distIds, distMode);
          setDistOpen(false);
          message.success('已分发，进入【待领取】');
        }}
        okText="确认分发"
      >
        <p style={{ color: 'rgba(0,0,0,0.45)' }}>
          制作方式必填。分发后主任务进入【待领取】，状态回传灵鉴。配置质检图不是分发的强制前置。
        </p>
        <div style={{ marginBottom: 12 }}>
          {distIds.map((id) => {
            const t = mainTasks.find((x) => x.id === id);
            return (
              <div key={id}>
                {t?.id} / {t?.spu} 制作方式：{t?.produceMode ?? '未指定'}
              </div>
            );
          })}
        </div>
        <div>
          <span style={{ marginRight: 8 }}>制作方式</span>
          <Select
            style={{ width: 180 }}
            placeholder="请选择"
            value={distMode}
            options={PRODUCE_MODES.map((m) => ({ value: m, label: m }))}
            onChange={setDistMode}
          />
        </div>
      </Modal>
    </div>
  );
}

function deriveLabel(images: InspectionImages) {
  const n = ANGLES.filter((a) => images[a as Angle]).length;
  if (n === 0) return '未配置';
  if (n === 4) return '已配置';
  return '部分配置';
}
