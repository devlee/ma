import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Descriptions, Empty, Input, Modal, Space, Table, Typography, message } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { PromptEditor } from '@/components/PromptEditor';
import { StatusTag } from '@/components/StatusTag';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import { colorMatchDisplay, image1Kind, isFreeBatchSub } from '@/utils/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

export default function SubtaskDetail() {
  const { id } = useParams();
  const { role } = useRole();
  const isDesigner = role === '买家秀设计';
  const store = useBuyerShow();
  const sub = store.findSub(id ?? '');
  const main = sub ? store.findMain(sub.mainTaskId) : undefined;
  const [uploadOpen, setUploadOpen] = useState(false);
  const [remark, setRemark] = useState(sub?.remark ?? '');

  const free = sub ? isFreeBatchSub(sub) : false;

  if (!sub || (!main && !free)) {
    return (
      <div className={shared.page}>
        <Empty description={`未找到子任务 ${id ?? ''}`} />
      </div>
    );
  }

  const act = (fn: () => void, msg: string) => {
    fn();
    message.success(msg);
  };

  const regen = () => {
    store.regenerate(sub.id);
    if (free) window.setTimeout(() => store.completeGen([sub.id]), 800);
  };

  const ops = () => {
    if (!isDesigner) return <span style={{ color: 'rgba(0,0,0,0.45)' }}>当前角色仅可查看</span>;
    const st = sub.status;
    if (st === '待提交审核' || st === '审核失败') {
      return (
        <Space>
          <Button onClick={() => act(regen, '状态已更新为【生图中】')}>重新生成</Button>
          {!free ? <Button onClick={() => act(() => store.markEditing(sub.id), '状态已更新为【修改中】')}>标记修改中</Button> : null}
          {free ? (
            <Button type="primary" onClick={() => message.success('已下载该张结果（演示）')}>
              下载结果
            </Button>
          ) : (
            <Button type="primary" onClick={() => act(() => store.submitSubtask(sub.id), '已提交审核')}>
              提交审核
            </Button>
          )}
        </Space>
      );
    }
    if (st === '修改中') {
      return (
        <Button type="primary" onClick={() => setUploadOpen(true)}>
          上传覆盖
        </Button>
      );
    }
    if (st === '生图失败') {
      return (
        <Space>
          <Button
            type="primary"
            onClick={() =>
              act(() => {
                store.retry(sub.id);
                if (free) window.setTimeout(() => store.completeGen([sub.id]), 800);
              }, '状态已更新为【生图中】')
            }
          >
            重试
          </Button>
          <Button onClick={() => act(regen, '状态已更新为【生图中】')}>重新生成</Button>
        </Space>
      );
    }
    if (st === '生图中') return <span style={{ color: 'rgba(0,0,0,0.45)' }}>生图中，完成后进入【待提交审核】</span>;
    return <span style={{ color: 'rgba(0,0,0,0.45)' }}>当前状态无可执行操作</span>;
  };

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        子任务详情页
      </Typography.Title>
      <Card size="small" className={shared.card}>
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="子任务编号">{sub.id}</Descriptions.Item>
          <Descriptions.Item label="主任务编号">{free ? sub.batchId || '自由批量' : main?.id}</Descriptions.Item>
          <Descriptions.Item label="SPU">{sub.spu || main?.spu}</Descriptions.Item>
          <Descriptions.Item label="颜色">{sub.color}</Descriptions.Item>
          <Descriptions.Item label="色值匹配">
            <StatusTag value={colorMatchDisplay(sub.colorMatchStatus, sub.prompt)} />
          </Descriptions.Item>
          <Descriptions.Item label="角度">{sub.angle}</Descriptions.Item>
          <Descriptions.Item label="标签">{sub.crowdTag}</Descriptions.Item>
          <Descriptions.Item label="制作方式">{free ? '自由批量生图' : main?.produceMode}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag value={sub.status} />
          </Descriptions.Item>
          <Descriptions.Item label="审核轮次">{sub.reviewRound || '—'}</Descriptions.Item>
          <Descriptions.Item label="生成次数">{sub.generateCount}</Descriptions.Item>
          <Descriptions.Item label="制作人">{sub.assignee}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{sub.createdAt}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>{ops()}</div>
      </Card>

      <div className={styles.split}>
        <div>
          <Card size="small" className={shared.card} title={`描述词`} extra={<span>模板版本 {sub.templateVersion}</span>}>
            <PromptEditor value={sub.prompt} />
          </Card>
          <Card size="small" className={shared.card} title="参考图片">
            <div className={shared.refRow}>
              <div className={shared.refItem}>
                <ImagePlaceholder label="图1" kind={image1Kind(sub.image1.source)} size="md" source={sub.image1.source} />
                <div className={shared.cap}>图1 · {free ? '商品图' : sub.image1.source}</div>
              </div>
              <div className={shared.refItem}>
                <ImagePlaceholder label={sub.image2.materialId || (free ? '无参考图' : '无图2')} kind="mat" size="md" />
                <div className={shared.cap}>
                  {free ? '图2 · 参考图' : '图2 · 素材 ID'}
                  <br />
                  {sub.image2.materialId || '—'}
                </div>
              </div>
              <div className={shared.refItem}>
                <ImagePlaceholder label={sub.image3?.url || (free ? '无质检图' : '无图3')} kind={free ? 'qc' : 'mat'} size="md" />
                <div className={shared.cap}>
                  {free ? '图3 · 质检图' : '图3 · 素材 ID'}
                  <br />
                  {sub.image3?.url || sub.image3?.materialId || '—'}
                </div>
              </div>
              {free ? (
                <div className={shared.refItem}>
                  <ImagePlaceholder label={sub.image4?.url || '无其他'} kind="mat" size="md" />
                  <div className={shared.cap}>
                    图4 · 其他
                    <br />
                    {sub.image4?.url || '—'}
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
          <Card size="small" className={shared.card}>
            创建人：<b>{sub.assignee}</b>
          </Card>
          <Card size="small" className={shared.card} title="审核信息">
            {(sub.reviewRecords ?? []).length ? (
              (sub.reviewRecords ?? []).map((r, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  第 {r.round} 轮{' '}
                  <StatusTag value={r.result === '通过' ? '待推送' : r.result === '失败' ? '审核失败' : '废弃'} /> {r.result}{' '}
                  {r.reason || '—'}
                  <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                    {r.operator} · {r.createdAt}
                  </div>
                </div>
              ))
            ) : (
              <span style={{ color: 'rgba(0,0,0,0.45)' }}>暂无审核记录</span>
            )}
          </Card>
          <Card size="small" title="操作日志">
            <Table
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowKey={(_, i) => String(i)}
              dataSource={sub.operationLogs ?? []}
              columns={[
                { title: '操作内容', dataIndex: 'action' },
                { title: '操作人', dataIndex: 'operator' },
                { title: '时间', dataIndex: 'createdAt' },
              ]}
              locale={{ emptyText: '暂无日志' }}
            />
          </Card>
        </div>
        <div>
          <Card size="small" className={shared.card} title="生成结果">
            <ImagePlaceholder
              label={sub.status === '生图中' || sub.status === '生图失败' ? sub.status : `生成结果 · ${sub.angle}`}
              kind="result"
              size="lg"
            />
          </Card>
          <Card size="small" className={shared.card} title="历史版本">
            {(sub.versions ?? []).length ? (
              (sub.versions ?? []).map((v, i) => (
                <div key={i} className={styles.hist}>
                  <ImagePlaceholder label={v.type} kind={v.type === '上传覆盖' ? 'mat' : 'result'} size="thumb" />
                  <div>
                    <div>{v.type}</div>
                    <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                      {v.createdAt} · {v.operator}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <span style={{ color: 'rgba(0,0,0,0.45)' }}>暂无历史版本</span>
            )}
          </Card>
          <Card size="small" title="备注">
            <Input.TextArea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} />
            <Button
              style={{ marginTop: 8 }}
              onClick={() => {
                store.saveRemark(sub.id, remark);
                message.success('备注已保存');
              }}
            >
              保存备注
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        title="上传覆盖"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => {
          store.uploadOverride(sub.id);
          setUploadOpen(false);
          message.success('上传覆盖成功 → 【待提交审核】');
        }}
      >
        <p>设计下载结果图外部处理后上传覆盖。上传成功 → 【待提交审核】，AI 原图留版本。</p>
        <ImagePlaceholder label="点击选择覆盖图" kind="mat" size="fluid" />
      </Modal>
    </div>
  );
}
