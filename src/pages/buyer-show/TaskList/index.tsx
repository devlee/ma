import { useMemo, useState, type Key } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
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
import { ConsistencyTag } from '@/components/ConsistencyTag';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { QcCoverageTag, QcImageEditor } from '@/components/QcImageEditor';
import { ReasonModal } from '@/components/ReasonModal';
import { SpuQcEditDrawer } from '@/components/SpuQcEditDrawer';
import { StatusTag } from '@/components/StatusTag';
import {
  CATEGORIES,
  CONSISTENCY_STATUSES,
  DESIGNERS,
  MAIN_STATUSES,
  PRODUCE_MODES,
  QC_STATUSES,
} from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { MainTask, ProduceMode } from '@/types/buyer-show';
import { canCancel, resolveTaskQcView } from '@/utils/buyer-show';
import shared from '../shared.module.css';

const { RangePicker } = DatePicker;

interface Filters {
  spu?: string;
  id?: string;
  category?: string;
  status?: string;
  qc?: string;
  consistency?: string;
  produceMode?: string;
  assignee?: string;
  issuedRange?: [Dayjs, Dayjs];
}

export default function TaskList() {
  const { role } = useRole();
  const isOps = role === '运营';
  const { mainTasks, spus, findSpu, setColor, setProduceMode, dispatchTasks, cancelTask } = useBuyerShow();
  const [form] = Form.useForm<Filters>();
  const [applied, setApplied] = useState<Filters>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [drawerId, setDrawerId] = useState<string>();
  const [qcSpu, setQcSpu] = useState<string>();
  const [cancelId, setCancelId] = useState<string>();
  const [distOpen, setDistOpen] = useState(false);
  const [distIds, setDistIds] = useState<string[]>([]);
  const [distMode, setDistMode] = useState<ProduceMode>();

  const viewOf = (t: MainTask) => resolveTaskQcView(t, findSpu(t.spu));

  const filtered = useMemo(() => {
    return mainTasks.filter((t) => {
      const view = resolveTaskQcView(t, spus.find((s) => s.spu === t.spu));
      if (applied.spu && !t.spu.includes(applied.spu) && !t.spuName.includes(applied.spu)) return false;
      if (applied.id && !t.id.includes(applied.id)) return false;
      if (applied.category && t.category !== applied.category) return false;
      if (applied.status && t.status !== applied.status) return false;
      if (applied.qc && view.status !== applied.qc) return false;
      if (applied.consistency && view.consistencyStatus !== applied.consistency) return false;
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
  }, [mainTasks, spus, applied]);

  const drawerTask = mainTasks.find((t) => t.id === drawerId);
  const drawerView = drawerTask ? viewOf(drawerTask) : undefined;
  const drawerSpu = drawerTask ? findSpu(drawerTask.spu) : undefined;
  const editSpu = qcSpu ? findSpu(qcSpu) : undefined;
  const editFromTask = mainTasks.find((t) => t.spu === qcSpu && t.status !== '待分发');

  const openQc = (spu: string) => setQcSpu(spu);

  const openDist = (ids: string[]) => {
    const pending = ids.filter((id) => mainTasks.find((t) => t.id === id)?.status === '待分发');
    if (!pending.length) {
      message.warning(ids.length ? '所选主任务均不可分发（仅待分发）' : '请先勾选主任务');
      return;
    }
    setDistIds(pending);
    setDistMode(undefined);
    setDistOpen(true);
  };

  const distStats = useMemo(() => {
    const targets = distIds
      .map((id) => mainTasks.find((t) => t.id === id))
      .filter((t): t is MainTask => Boolean(t));
    const views = targets.map((t) => resolveTaskQcView(t, spus.find((s) => s.spu === t.spu)));
    return {
      noQc: views.filter((v) => v.status === '未配置').length,
      unconfirmed: views.filter((v) => v.consistencyStatus === '未确认').length,
    };
  }, [distIds, mainTasks, spus]);

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
          <Input size="small" value={t.color} onChange={(e) => setColor(t.id, e.target.value)} />
        ) : (
          t.color || '—'
        ),
    },
    {
      title: '质检图状态',
      key: 'qc',
      width: 160,
      render: (_, t) => {
        const view = viewOf(t);
        return <QcCoverageTag images={view.images} status={view.status} />;
      },
    },
    {
      title: '实物一致性',
      key: 'consistency',
      width: 200,
      render: (_, t) => {
        const view = viewOf(t);
        return (
          <ConsistencyTag
            status={view.consistencyStatus}
            confirmedBy={view.consistencyConfirmedBy}
            confirmedAt={view.consistencyConfirmedAt}
          />
        );
      },
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
            <Button type="link" size="small" onClick={() => openQc(t.spu)}>
              配置质检图
            </Button>
          ) : null}
          {isOps && t.status === '待分发' ? (
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
        <Form form={form} layout="inline" onFinish={(v) => setApplied(v)}>
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
          <Form.Item name="consistency" label="实物一致性">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 120 }}
              options={CONSISTENCY_STATUSES.map((c) => ({ value: c, label: c }))}
            />
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
          scroll={{ x: 'max-content' }}
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
            <Button type="primary" onClick={() => openQc(drawerTask.spu)}>
              配置质检图
            </Button>
          ) : null
        }
      >
        {drawerTask && drawerView ? (
          <>
            {drawerView.source === 'snapshot' ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                message="本任务已分发，以下质检图 / 一致性为快照，不随 SPU 主数据事后变更。"
              />
            ) : null}
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
              <Descriptions.Item label="近 30 天销量">{drawerSpu?.sales30d ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="需要数量">{drawerTask.requiredCount}</Descriptions.Item>
              <Descriptions.Item label="颜色">{drawerTask.color || '未指定'}</Descriptions.Item>
              <Descriptions.Item label="质检图库">
                <Link to={`/buyer-show/qc-library?spu=${encodeURIComponent(drawerTask.spu)}`}>查看该 SPU</Link>
              </Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>
              质检图配置 <QcCoverageTag images={drawerView.images} status={drawerView.status} />
            </Typography.Title>
            <div style={{ marginBottom: 12 }}>
              <ConsistencyTag
                status={drawerView.consistencyStatus}
                confirmedBy={drawerView.consistencyConfirmedBy}
                confirmedAt={drawerView.consistencyConfirmedAt}
              />
            </div>
            <QcImageEditor value={drawerView.images} readOnly />
          </>
        ) : null}
      </Drawer>

      <SpuQcEditDrawer
        open={Boolean(qcSpu)}
        spu={editSpu}
        onClose={() => setQcSpu(undefined)}
        readOnly={!isOps}
        snapshotFrozen={Boolean(editFromTask)}
      />

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
          if (distStats.noQc || distStats.unconfirmed) {
            message.warning(
              `将分发 ${distIds.length} 条：其中 ${distStats.noQc} 条未配置质检图、${distStats.unconfirmed} 条未确认实物一致性（不拦截）`,
            );
          }
          dispatchTasks(distIds, distMode);
          setDistOpen(false);
          message.success('已分发，进入【待领取】，已写入质检图 / 一致性快照');
        }}
        okText="确认分发"
      >
        <p style={{ color: 'rgba(0,0,0,0.45)' }}>
          制作方式必填。分发后写入快照并进入【待领取】。质检图与实物一致性不是分发强制前置。
        </p>
        {distStats.noQc || distStats.unconfirmed ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`未配置质检图 ${distStats.noQc} 条 · 未确认实物一致性 ${distStats.unconfirmed} 条，仍可分发`}
          />
        ) : null}
        <div style={{ marginBottom: 12 }}>
          {distIds.map((id) => {
            const t = mainTasks.find((x) => x.id === id);
            if (!t) return null;
            const view = viewOf(t);
            return (
              <div key={id}>
                {t.id} / {t.spu} · 制作方式：{t.produceMode ?? '未指定'} · 质检图 {view.status} · 一致性 {view.consistencyStatus}
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
