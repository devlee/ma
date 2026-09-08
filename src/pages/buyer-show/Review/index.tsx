import { useMemo, useState } from 'react';
import { Button, Card, Collapse, Empty, Space, Typography, message } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { PromptEditor } from '@/components/PromptEditor';
import { ReasonModal } from '@/components/ReasonModal';
import { StatusTag } from '@/components/StatusTag';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import { colorHex, colorMatchDisplay, extractPromptColorSlot, image1Kind, reviewPendingCount, subsOf } from '@/utils/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

export default function Review() {
  const { role } = useRole();
  const isOps = role === '运营';
  const store = useBuyerShow();
  const reviewMains = useMemo(
    () => store.mainTasks.filter((t) => t.status === '待审核' || t.status === '返修待审核' || t.status === '推送失败'),
    [store.mainTasks],
  );
  const firstSub = reviewMains.length ? (subsOf(store.subtasks, reviewMains[0].id).find((s) => s.status === '待审核' || s.status === '返修待审核') ?? subsOf(store.subtasks, reviewMains[0].id)[0]) : undefined;
  const [currentSubId, setCurrentSubId] = useState(firstSub?.id ?? '');
  const [failOpen, setFailOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const sub = store.findSub(currentSubId);
  const main = sub ? store.findMain(sub.mainTaskId) : undefined;
  const reviewing = sub && (sub.status === '待审核' || sub.status === '返修待审核');

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        审核页
        <span className={shared.sub}>运营 · 单一审核维度，无 AI 评分</span>
      </Typography.Title>
      <div className={styles.split}>
        <Card size="small" title="任务列表" className={styles.tree}>
          {reviewMains.length ? (
            reviewMains.map((t) => {
              const pc = reviewPendingCount(store.subtasks, t.id);
              const children = subsOf(store.subtasks, t.id);
              return (
                <div key={t.id} className={styles.card}>
                  <div className={styles.mainRow}>
                    <div>
                      <b>{t.id}</b> <StatusTag value={t.status} />
                    </div>
                    <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                      {t.spu} · {t.category}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <span>
                        <StatusTag value={t.produceMode} /> {t.assignee}
                      </span>
                      <span className={styles.pending}>
                        待审核 {pc.x}/{pc.y}
                      </span>
                    </div>
                    {t.status === '推送失败' && isOps ? (
                      <Button
                        type="primary"
                        size="small"
                        style={{ marginTop: 8 }}
                        onClick={() => {
                          store.repush(t.id);
                          message.success('已重新推送（主任务整体幂等）');
                        }}
                      >
                        重新推送
                      </Button>
                    ) : null}
                  </div>
                  {children.map((s) => (
                    <div
                      key={s.id}
                      className={`${styles.subRow} ${s.id === currentSubId ? styles.active : ''}`}
                      onClick={() => setCurrentSubId(s.id)}
                    >
                      <div>
                        {s.id}
                        <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                          {s.angle} · {s.color}
                        </div>
                      </div>
                      <StatusTag value={s.status} />
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <Empty description="暂无【待审核】【返修待审核】【推送失败】主任务" />
          )}
        </Card>

        <Card size="small" title={sub ? `图片对比 · ${sub.id}` : '图片对比'}>
          {sub && main ? (
            <>
              <Space wrap style={{ marginBottom: 12 }}>
                <StatusTag value={sub.angle} />
                <StatusTag value={sub.color} />
                <StatusTag value={`色值 ${colorHex(sub.color, store.colorDictionaries) || extractPromptColorSlot(sub.prompt) || '—'}`} />
                <StatusTag value={colorMatchDisplay(sub.colorMatchStatus, sub.prompt)} />
                <StatusTag value={`审核轮次 ${sub.reviewRound || '—'}`} />
              </Space>
              <div className={styles.compare}>
                <div>
                  <div className={styles.name}>质检图（图1）</div>
                  <ImagePlaceholder label={`图1 · ${sub.image1.source}`} kind={image1Kind(sub.image1.source)} size="lg" />
                </div>
                <div>
                  <div className={styles.name}>商品图</div>
                  <ImagePlaceholder label={`商品图 · ${main.spu}`} kind="prod" size="lg" />
                </div>
                <div>
                  <div className={styles.name}>生成结果</div>
                  <ImagePlaceholder label={`生成结果 · ${sub.angle}`} kind="result" size="lg" />
                </div>
              </div>
              <Collapse
                items={[
                  {
                    key: 'mat',
                    label: '素材图（图2 / 图3）展开查看',
                    children: (
                      <div className={shared.refRow}>
                        <div className={shared.refItem}>
                          <ImagePlaceholder label={sub.image2.materialId || '无图2'} kind="mat" size="md" />
                          <div className={shared.cap}>图2 · {sub.image2.materialId || '—'}</div>
                        </div>
                        <div className={shared.refItem}>
                          <ImagePlaceholder label={sub.image3?.materialId || '无图3'} kind="mat" size="md" />
                          <div className={shared.cap}>图3 · {sub.image3?.materialId || '—'}</div>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
              <div style={{ margin: '12px 0 8px' }}>
                <b>描述词</b>
              </div>
              <PromptEditor value={sub.prompt} />
            </>
          ) : (
            <Empty description="请选择左侧子任务" />
          )}
        </Card>

        <Card size="small" title="审核操作">
          {!sub ? (
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>请选择子任务</span>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                当前子任务 <StatusTag value={sub.status} />
              </div>
              {!reviewing ? (
                <div>
                  已审核
                  {sub.reviewRecords?.length
                    ? `：${sub.reviewRecords[sub.reviewRecords.length - 1].result}${
                        sub.reviewRecords[sub.reviewRecords.length - 1].reason
                          ? ` · ${sub.reviewRecords[sub.reviewRecords.length - 1].reason}`
                          : ''
                      }`
                    : ''}
                </div>
              ) : isOps ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    block
                    onClick={() => {
                      store.reviewPass(sub.id);
                      message.success('子任务 → 【待推送】');
                    }}
                  >
                    通过
                  </Button>
                  <Button danger block onClick={() => setFailOpen(true)}>
                    失败
                  </Button>
                  <Button block onClick={() => setDiscardOpen(true)}>
                    废弃
                  </Button>
                </Space>
              ) : (
                <span style={{ color: 'rgba(0,0,0,0.45)' }}>仅运营可审核</span>
              )}
            </>
          )}
        </Card>
      </div>

      <ReasonModal
        open={failOpen}
        title="失败"
        label="失败原因"
        danger
        okText="确认失败"
        onCancel={() => setFailOpen(false)}
        onOk={(reason) => {
          if (sub) store.reviewFail(sub.id, reason);
          setFailOpen(false);
          message.success('子任务 → 【审核失败】');
        }}
      />
      <ReasonModal
        open={discardOpen}
        title="废弃"
        hint="子任务进入【废弃】，退出有效子任务，不计入制作人绩效。仅审核页可操作。"
        label="废弃原因"
        danger
        okText="确认废弃"
        onCancel={() => setDiscardOpen(false)}
        onOk={(reason) => {
          if (sub) store.reviewDiscard(sub.id, reason);
          setDiscardOpen(false);
          message.success('子任务 → 【废弃】');
        }}
      />
    </div>
  );
}
