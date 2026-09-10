import { Alert, Button, Card, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ConsistencyTag } from '@/components/ConsistencyTag';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { QcCoverageTag } from '@/components/QcImageEditor';
import { StatusTag } from '@/components/StatusTag';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { MainTask } from '@/types/buyer-show';
import { resolveTaskQcView } from '@/utils/buyer-show';
import shared from '../shared.module.css';

export default function TaskClaim() {
  const { isDesigner: canClaim, actor } = useRole();
  const { mainTasks, findSpu, claimTask } = useBuyerShow();

  const list = mainTasks.filter((t) => {
    if (t.status === '待领取') return true;
    if ((t.status === '制作中' || t.status === '返修中') && t.assignee === actor) return true;
    return false;
  });

  const columns: ColumnsType<MainTask> = [
    { title: '任务编号', dataIndex: 'id', width: 170 },
    {
      title: 'SPU',
      dataIndex: 'spu',
      width: 220,
      render: (_, t) => (
        <Space>
          <ImagePlaceholder label="SPU" kind="prod" size="thumb" />
          <div>
            <div>{t.spu}</div>
            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{t.spuName}</div>
          </div>
        </Space>
      ),
    },
    { title: '品类', dataIndex: 'category', width: 88 },
    { title: '需要数量', dataIndex: 'requiredCount', width: 88 },
    { title: '颜色', dataIndex: 'color', width: 88, render: (v?: string) => v || '—' },
    {
      title: '制作方式',
      dataIndex: 'produceMode',
      width: 110,
      render: (v?: string) => <StatusTag value={v ?? '未指定'} />,
    },
    {
      title: '质检图状态',
      key: 'qc',
      width: 160,
      render: (_, t) => {
        const view = resolveTaskQcView(t, findSpu(t.spu));
        return <QcCoverageTag images={view.images} status={view.status} />;
      },
    },
    {
      title: '实物一致性',
      key: 'consistency',
      width: 180,
      render: (_, t) => {
        const view = resolveTaskQcView(t, findSpu(t.spu));
        return (
          <ConsistencyTag
            status={view.consistencyStatus}
            confirmedBy={view.consistencyConfirmedBy}
            confirmedAt={view.consistencyConfirmedAt}
          />
        );
      },
    },
    { title: '下发时间', dataIndex: 'issuedAt', width: 160 },
    { title: '分发时间', dataIndex: 'dispatchedAt', width: 160, render: (v?: string) => v || '—' },
    { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag value={v} /> },
    {
      title: '操作',
      key: 'ops',
      width: 100,
      render: (_, t) =>
        t.status === '待领取' ? (
          canClaim ? (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                claimTask(t.id, actor);
                message.success('已认领，主任务进入【制作中】');
              }}
            >
              认领
            </Button>
          ) : (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>仅设计可认领</span>
          )
        ) : (
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>已认领</span>
        ),
    },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        任务领取页
        <span className={shared.sub}>买家秀设计 · 不设组长指派</span>
      </Typography.Title>
      <Alert
        className={shared.notice}
        type="info"
        showIcon
        message="展示【待领取】及「自身制作中 / 返修中」的主任务。认领后主任务进入【制作中】，制作人写入。"
      />
      <Card size="small">
        <Table rowKey="id" size="small" columns={columns} dataSource={list} pagination={false} scroll={{ x: 'max-content' }} />
      </Card>
    </div>
  );
}
