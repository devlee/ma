import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Drawer, Space, Typography, message } from 'antd';
import { ConsistencyTag } from '@/components/ConsistencyTag';
import { QcCoverageTag, QcImageEditor } from '@/components/QcImageEditor';
import { useBuyerShow } from '@/store/buyerShow';
import type { InspectionImages, SpuMaster } from '@/types/buyer-show';
import { canConfirmConsistency, qcImagesChanged } from '@/utils/buyer-show';

interface SpuQcEditDrawerProps {
  open: boolean;
  spu?: SpuMaster;
  onClose: () => void;
  readOnly?: boolean;
  /** 已分发任务打开时提示快照冻结 */
  snapshotFrozen?: boolean;
}

export function SpuQcEditDrawer({ open, spu, onClose, readOnly, snapshotFrozen }: SpuQcEditDrawerProps) {
  const { saveSpuQc, confirmConsistency, revokeConsistency } = useBuyerShow();
  const [draft, setDraft] = useState<InspectionImages>({});

  useEffect(() => {
    if (open && spu) setDraft({ ...spu.qcImages });
  }, [open, spu]);

  const live = open ? spu : undefined;

  return (
    <Drawer
      title={live ? `配置质检图 · ${live.spu}` : '配置质检图'}
      open={open}
      width={820}
      onClose={onClose}
      extra={
        live ? (
          <Link to={`/buyer-show/qc-library?spu=${encodeURIComponent(live.spu)}`}>在质检图库中查看</Link>
        ) : null
      }
      footer={
        readOnly || !live ? null : (
          <Space>
            <Button
              type="primary"
              onClick={() => {
                const changed = qcImagesChanged(live.qcImages, draft);
                saveSpuQc(live.spu, draft);
                onClose();
                message.success(
                  changed && live.consistencyStatus === '已确认'
                    ? '质检图已写入 SPU 主数据，实物一致性已回退为未确认'
                    : '质检图已写入 SPU 主数据',
                );
              }}
            >
              保存
            </Button>
            <Button onClick={onClose}>取消</Button>
          </Space>
        )
      }
    >
      {live ? (
        <>
          {snapshotFrozen ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="本主任务已分发，列表中的质检图 / 一致性为快照。此处编辑写入 SPU 主数据，不影响该任务快照。"
            />
          ) : null}
          <Typography.Paragraph type="secondary">
            按角度配置正面、侧面、背面、半身。允许部分配置；修改任一角度后实物一致性自动回退为未确认。
          </Typography.Paragraph>
          <div style={{ marginBottom: 12 }}>
            <Space wrap>
              <span>
                {live.spu} · {live.spuName}
              </span>
              <QcCoverageTag images={draft} />
              <ConsistencyTag
                status={live.consistencyStatus}
                confirmedBy={live.consistencyConfirmedBy}
                confirmedAt={live.consistencyConfirmedAt}
              />
            </Space>
          </div>
          <QcImageEditor value={draft} onChange={setDraft} readOnly={readOnly} />
          {readOnly ? null : (
            <Space style={{ marginTop: 16 }}>
              {live.consistencyStatus === '已确认' ? (
                <Button
                  onClick={() => {
                    revokeConsistency(live.spu);
                    message.success('已撤销实物一致性确认');
                  }}
                >
                  撤销确认
                </Button>
              ) : (
                <Button
                  disabled={!canConfirmConsistency(draft)}
                  onClick={() => {
                    const ok = confirmConsistency(live.spu, draft);
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
          )}
        </>
      ) : null}
    </Drawer>
  );
}
