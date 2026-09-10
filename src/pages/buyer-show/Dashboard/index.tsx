import { useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Select, Space, Statistic, Table, Typography, message } from 'antd';
import ReactECharts from 'echarts-for-react';
import { ANGLES, CATEGORIES, DESIGNERS, PRODUCE_MODES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { mockDashboard } from '@/mocks/buyer-show';
import { useBuyerShow } from '@/store/buyerShow';
import type { MainTask, SpuMaster, Subtask } from '@/types/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

export default function Dashboard() {
  const { role } = useRole();
  const { currentDesigner, spus, mainTasks, subtasks } = useBuyerShow();
  const isDesigner = role === '买家秀设计';
  const D = mockDashboard;
  const [maker, setMaker] = useState(isDesigner ? currentDesigner : '');

  const makers = useMemo(
    () => (isDesigner ? D.makers.filter((m) => m.name === currentDesigner) : D.makers.filter((m) => !maker || m.name === maker)),
    [D.makers, isDesigner, currentDesigner, maker],
  );

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        面板
        <span className={shared.sub}>{isDesigner ? '买家秀设计 · 仅可见自己的数据' : '运营 · 全量数据'}</span>
      </Typography.Title>

      <Card size="small" className={shared.card}>
        <Space wrap>
          <span>时间范围</span>
          <DatePicker />
          <span>至</span>
          <DatePicker />
          <span>品类</span>
          <Select allowClear placeholder="全部" style={{ width: 110 }} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <span>制作人</span>
          <Select
            allowClear={!isDesigner}
            disabled={isDesigner}
            value={isDesigner ? currentDesigner : maker || undefined}
            placeholder="全部"
            style={{ width: 110 }}
            options={DESIGNERS.map((c) => ({ value: c, label: c }))}
            onChange={(v) => setMaker(v ?? '')}
          />
          <span>制作方式</span>
          <Select allowClear placeholder="全部" style={{ width: 120 }} options={PRODUCE_MODES.map((c) => ({ value: c, label: c }))} />
          <Button type="primary" onClick={() => message.success('筛选已应用（演示数据为静态 mock）')}>
            查询
          </Button>
        </Space>
      </Card>

      <Card size="small" className={shared.card} title="任务量">
        <div className={styles.statGrid}>
          <Card size="small">
            <Statistic title="灵鉴下发主任务数" value={D.issuedMain} />
          </Card>
          <Card size="small">
            <Statistic title="需要图数" value={D.needImages} />
          </Card>
          <Card size="small">
            <Statistic title="待分发积压" value={D.pendingDistribute} />
          </Card>
          <Card size="small">
            <Statistic title="待领取积压" value={D.pendingClaim} />
          </Card>
        </div>
        <ReactECharts
          style={{ height: 260 }}
          option={{
            tooltip: { trigger: 'axis' },
            legend: { data: ['下发主任务', '需要图数'] },
            grid: { left: 40, right: 20, top: 40, bottom: 30 },
            xAxis: { type: 'category', data: D.volumeDates },
            yAxis: { type: 'value' },
            series: [
              { name: '下发主任务', type: 'bar', data: D.volumeMains, itemStyle: { color: '#1677ff' } },
              { name: '需要图数', type: 'line', data: D.volumeImages, itemStyle: { color: '#52c41a' } },
            ],
          }}
        />
      </Card>

      <div className={styles.dashGrid}>
        <Card size="small" title="完成情况">
          <div className={styles.statGrid3}>
            <Statistic title="已推送主任务数" value={D.pushedMain} />
            <Statistic title="已推送主任务占比" value={D.pushedMainRate} />
            <Statistic title="已推送图数" value={D.pushedImages} />
          </div>
          <Table
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            style={{ marginTop: 12 }}
            rowKey="k"
            dataSource={Object.entries(D.avgDurations).map(([k, v]) => ({ k, v }))}
            columns={[
              { title: '环节', dataIndex: 'k' },
              { title: '平均时长', dataIndex: 'v' },
            ]}
          />
        </Card>
        <Card size="small" title="进度与卡点">
          <ReactECharts
            style={{ height: 240 }}
            option={{
              tooltip: { trigger: 'item' },
              series: [{ type: 'pie', radius: ['36%', '62%'], data: D.statusDist }],
            }}
          />
          <Alert
            type="info"
            showIcon
            message={
              <span>
                超时任务（待领取、待审核超 <b>{D.timeoutN}</b> 天）：待领取 <b>{D.timeoutClaim}</b> · 待审核 <b>{D.timeoutReview}</b>
                {' '}生图失败数 <b>{D.genFail}</b> 推送失败数 <b>{D.pushFail}</b> 返修率 <b>{D.reworkRate}</b> 废弃子任务数 <b>{D.discardedSub}</b>
              </span>
            }
          />
        </Card>
      </div>

      <Card size="small" className={shared.card} title="制作人">
        <Table
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="name"
          dataSource={makers}
          columns={[
            { title: '制作人', dataIndex: 'name' },
            { title: '认领主任务数', dataIndex: 'claimed' },
            { title: '完成子任务数（批量）', dataIndex: 'doneBatch' },
            { title: '完成子任务数（单个）', dataIndex: 'doneSingle' },
            { title: '平均生成次数/张', dataIndex: 'avgGen' },
            { title: '一次通过率', dataIndex: 'passOnce' },
            { title: '返修次数', dataIndex: 'rework' },
            { title: '上传覆盖（PS 修改）占比', dataIndex: 'psRate' },
            { title: '平均制作耗时', dataIndex: 'avgCost' },
          ]}
        />
      </Card>

      <div className={styles.dashGrid}>
        <Card size="small" title="质检图与一致性">
          <QcConsistencyPanel spus={spus} mainTasks={mainTasks} subtasks={subtasks} />
        </Card>
        <Card size="small" title="配置健康度">
          <ReactECharts
            style={{ height: 220 }}
            option={{
              tooltip: {},
              title: { text: '素材使用频次（Top / 长尾）', textStyle: { fontSize: 13 } },
              xAxis: {
                type: 'category',
                data: D.materialFreq.map((x) => x.id.replace('MAT-', '')),
                axisLabel: { rotate: 20, fontSize: 10 },
              },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: D.materialFreq.map((x) => x.used), itemStyle: { color: '#722ed1' } }],
            }}
          />
          <Typography.Title level={5}>描述词模板对应子任务的一次通过率</Typography.Title>
          <Table
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowKey="angle"
            dataSource={D.templatePass}
            columns={[
              { title: '角度', dataIndex: 'angle' },
              { title: '启用版本', dataIndex: 'ver' },
              { title: '一次通过率', dataIndex: 'passOnce' },
            ]}
          />
          <Typography.Title level={5}>色值未匹配次数与颜色名清单</Typography.Title>
          <UnmatchedTable />
        </Card>
      </div>
    </div>
  );
}

function pct(n: number, d: number) {
  if (!d) return '0%';
  return `${Math.round((n / d) * 1000) / 10}%`;
}

function QcConsistencyPanel({
  spus,
  mainTasks,
  subtasks,
}: {
  spus: SpuMaster[];
  mainTasks: MainTask[];
  subtasks: Subtask[];
}) {
  const spuTotal = spus.length;
  const qcConfigured = spus.filter((s) => s.qcStatus === '已配置').length;
  const qcPartial = spus.filter((s) => s.qcStatus === '部分配置').length;
  const qcNone = spus.filter((s) => s.qcStatus === '未配置').length;
  const consConfirmed = spus.filter((s) => s.consistencyStatus === '已确认').length;
  const angleCover = Object.fromEntries(
    ANGLES.map((angle) => [angle, pct(spus.filter((s) => Boolean(s.qcImages[angle])).length, spuTotal)]),
  ) as Record<(typeof ANGLES)[number], string>;

  const dispatched = mainTasks.filter((t) => Boolean(t.dispatchedAt) || Boolean(t.qcImagesSnapshot));
  const taskQcConfigured = dispatched.filter((t) => (t.qcImagesSnapshot?.status ?? t.inspectionImageStatus) === '已配置').length;
  const noQcDistributed = dispatched.filter((t) => (t.qcImagesSnapshot?.status ?? t.inspectionImageStatus) === '未配置');
  const noConsDistributed = dispatched.filter((t) => (t.consistencyStatus ?? '未确认') === '未确认');
  const fallbackSubs = subtasks.filter((s) => s.image1.source === '商品图兜底');

  return (
    <>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        在架 SPU
      </Typography.Title>
      <div className={styles.statGrid3}>
        <Statistic title="质检图覆盖率（已配置）" value={pct(qcConfigured, spuTotal)} />
        <Statistic title="一致性确认率" value={pct(consConfirmed, spuTotal)} />
        <Statistic title="在架 SPU 数" value={spuTotal} />
      </div>
      <ReactECharts
        style={{ height: 200 }}
        option={{
          tooltip: {},
          xAxis: { type: 'category', data: ['已配置', '部分配置', '未配置'] },
          yAxis: { type: 'value' },
          series: [{ type: 'bar', data: [qcConfigured, qcPartial, qcNone], itemStyle: { color: '#1677ff' } }],
        }}
      />
      <div style={{ marginTop: 8 }}>
        按角度覆盖率：
        {ANGLES.map((angle) => `${angle} ${angleCover[angle]}`).join(' / ')}
      </div>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        任务侧
      </Typography.Title>
      <div className={styles.statGrid3}>
        <Statistic title="主任务质检图配置率" value={pct(taskQcConfigured, dispatched.length)} />
        <Statistic title="未配置即分发" value={pct(noQcDistributed.length, dispatched.length)} />
        <Statistic title="未确认即分发" value={pct(noConsDistributed.length, dispatched.length)} />
      </div>
      <div style={{ marginTop: 8 }}>
        图1 商品图兜底占比：<b>{pct(fallbackSubs.length, subtasks.length)}</b>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>（{fallbackSubs.length}/{subtasks.length}）</span>
      </div>
      <Typography.Title level={5} style={{ marginTop: 12 }}>
        未配置即分发的主任务
      </Typography.Title>
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowKey="id"
        dataSource={noQcDistributed.map((t) => ({ id: t.id, spu: t.spu, at: t.dispatchedAt ?? '—' }))}
        columns={[
          { title: '任务编号', dataIndex: 'id' },
          { title: 'SPU', dataIndex: 'spu' },
          { title: '分发时间', dataIndex: 'at' },
        ]}
      />
    </>
  );
}

function UnmatchedTable() {
  const { unmatchedRecords } = useBuyerShow();
  return (
    <Table
      size="small"
      pagination={false}
      scroll={{ x: 'max-content' }}
      rowKey="name"
      dataSource={unmatchedRecords}
      columns={[
        { title: '名称', dataIndex: 'name' },
        { title: '类型', dataIndex: 'type' },
        { title: '出现次数', dataIndex: 'count' },
        { title: '最近出现时间', dataIndex: 'lastAt' },
      ]}
    />
  );
}
