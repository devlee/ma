import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, Form, Input, Select, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ConsistencyTag } from '@/components/ConsistencyTag';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { QcCoverageTag } from '@/components/QcImageEditor';
import { SpuQcEditDrawer } from '@/components/SpuQcEditDrawer';
import { CATEGORIES, CONSISTENCY_STATUSES, HIGH_SALES_THRESHOLD, QC_STATUSES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { SpuMaster } from '@/types/buyer-show';
import { canConfirmConsistency, hasInProgressTask } from '@/utils/buyer-show';
import shared from '../shared.module.css';

interface Filters {
  spu?: string;
  category?: string;
  qc?: string;
  consistency?: string;
  inProgress?: string;
  quick?: 'high-no-qc' | 'high-unconfirmed' | '';
}

export default function QcLibrary() {
  const { role } = useRole();
  const isOps = role === '运营';
  const { spus, mainTasks, confirmConsistency, revokeConsistency } = useBuyerShow();
  const [searchParams] = useSearchParams();
  const presetSpu = searchParams.get('spu') ?? '';
  const [form] = Form.useForm<Filters>();
  const [applied, setApplied] = useState<Filters>({ spu: presetSpu || undefined });
  const [editSpu, setEditSpu] = useState<string>();

  useEffect(() => {
    if (presetSpu) {
      form.setFieldsValue({ spu: presetSpu });
      setApplied((prev) => ({ ...prev, spu: presetSpu }));
    }
  }, [form, presetSpu]);

  const filtered = useMemo(() => {
    return [...spus]
      .filter((s) => {
        if (applied.spu && !s.spu.includes(applied.spu) && !s.spuName.includes(applied.spu)) return false;
        if (applied.category && s.category !== applied.category) return false;
        if (applied.qc && s.qcStatus !== applied.qc) return false;
        if (applied.consistency && s.consistencyStatus !== applied.consistency) return false;
        if (applied.inProgress === 'yes' && !hasInProgressTask(s.spu, mainTasks)) return false;
        if (applied.inProgress === 'no' && hasInProgressTask(s.spu, mainTasks)) return false;
        if (applied.quick === 'high-no-qc' && !(s.sales30d >= HIGH_SALES_THRESHOLD && s.qcStatus === '未配置')) {
          return false;
        }
        if (
          applied.quick === 'high-unconfirmed' &&
          !(s.sales30d >= HIGH_SALES_THRESHOLD && s.consistencyStatus === '未确认')
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.sales30d - a.sales30d);
  }, [spus, mainTasks, applied]);

  const applyQuick = (quick: Filters['quick']) => {
    const next: Filters = { ...applied, quick };
    form.setFieldsValue(next);
    setApplied(next);
  };

  const current = spus.find((s) => s.spu === editSpu);

  const columns: ColumnsType<SpuMaster> = [
    {
      title: 'SPU',
      dataIndex: 'spu',
      width: 200,
      render: (_, s) => (
        <>
          <div>{s.spu}</div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{s.spuName}</div>
        </>
      ),
    },
    {
      title: '首图',
      dataIndex: 'coverImage',
      width: 72,
      render: () => <ImagePlaceholder label="首图" kind="prod" size="thumb" />,
    },
    {
      title: '近 30 天销量',
      dataIndex: 'sales30d',
      width: 120,
      sorter: (a, b) => a.sales30d - b.sales30d,
      defaultSortOrder: 'descend',
      render: (v: number) => v.toLocaleString(),
    },
    { title: '品类', dataIndex: 'category', width: 88 },
    {
      title: '质检图覆盖',
      key: 'qc',
      width: 180,
      render: (_, s) => <QcCoverageTag images={s.qcImages} status={s.qcStatus} />,
    },
    {
      title: '实物一致性',
      key: 'consistency',
      width: 220,
      render: (_, s) => (
        <ConsistencyTag
          status={s.consistencyStatus}
          confirmedBy={s.consistencyConfirmedBy}
          confirmedAt={s.consistencyConfirmedAt}
        />
      ),
    },
    {
      title: '最近更新',
      key: 'updated',
      width: 200,
      render: (_, s) => (
        <>
          <div>{s.updatedAt}</div>
          <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{s.updatedBy}</div>
        </>
      ),
    },
    {
      title: '进行中任务',
      key: 'progress',
      width: 100,
      render: (_, s) => (hasInProgressTask(s.spu, mainTasks) ? '有' : '无'),
    },
    {
      title: '操作',
      key: 'ops',
      width: 220,
      fixed: 'right',
      render: (_, s) =>
        isOps ? (
          <Space size={4} wrap>
            <Button type="link" size="small" onClick={() => setEditSpu(s.spu)}>
              配置质检图
            </Button>
            {s.consistencyStatus === '已确认' ? (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  revokeConsistency(s.spu);
                  message.success('已撤销实物一致性确认');
                }}
              >
                撤销确认
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                disabled={!canConfirmConsistency(s.qcImages)}
                onClick={() => {
                  const ok = confirmConsistency(s.spu);
                  if (!ok) {
                    message.warning('至少已配置 1 张质检图方可确认');
                    return;
                  }
                  message.success('已确认实物一致性');
                }}
              >
                确认一致性
              </Button>
            )}
          </Space>
        ) : (
          <Button type="link" size="small" onClick={() => setEditSpu(s.spu)}>
            查看
          </Button>
        ),
    },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        SPU 质检图库
        <span className={shared.sub}>运营 · 在架 SPU 主数据 · 可早于任务下发配置</span>
      </Typography.Title>

      <Card className={shared.card} size="small">
        <Form form={form} layout="inline" initialValues={{ spu: presetSpu || undefined }} onFinish={(v) => setApplied({ ...v, quick: applied.quick })}>
          <Form.Item name="spu" label="SPU">
            <Input placeholder="编码 / 名称" allowClear style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="category" label="品类">
            <Select allowClear placeholder="全部" style={{ width: 110 }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
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
          <Form.Item name="inProgress" label="进行中任务">
            <Select
              allowClear
              placeholder="全部"
              style={{ width: 110 }}
              options={[
                { value: 'yes', label: '有' },
                { value: 'no', label: '无' },
              ]}
            />
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
              <Button type={applied.quick === 'high-no-qc' ? 'primary' : 'default'} onClick={() => applyQuick(applied.quick === 'high-no-qc' ? '' : 'high-no-qc')}>
                高销未配
              </Button>
              <Button
                type={applied.quick === 'high-unconfirmed' ? 'primary' : 'default'}
                onClick={() => applyQuick(applied.quick === 'high-unconfirmed' ? '' : 'high-unconfirmed')}
              >
                高销未确认
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card size="small" title={`在架 SPU（${filtered.length}）`} extra={<span style={{ color: 'rgba(0,0,0,0.45)' }}>默认按近 30 天销量降序 · 高销阈值 {HIGH_SALES_THRESHOLD}</span>}>
        <Table
          rowKey="spu"
          size="small"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <SpuQcEditDrawer open={Boolean(editSpu)} spu={current} onClose={() => setEditSpu(undefined)} readOnly={!isOps} />
    </div>
  );
}
