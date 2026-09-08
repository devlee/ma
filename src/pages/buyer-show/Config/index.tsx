import { useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Typography, Upload, message } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { PromptEditor } from '@/components/PromptEditor';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES, CATEGORIES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, CrowdTag, Material } from '@/types/buyer-show';
import { nowLabel } from '@/utils/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

export default function Config() {
  const { role } = useRole();
  const isOps = role === '运营';

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        配置管理
        <span className={shared.sub}>运营</span>
      </Typography.Title>
      <Card size="small">
        <Tabs
          items={[
            { key: 'mat', label: '素材库', children: <MaterialTab isOps={isOps} /> },
            { key: 'tpl', label: '描述词模板', children: <TemplateTab isOps={isOps} /> },
            { key: 'dict', label: '颜色 / 材质色值', children: <DictTab isOps={isOps} /> },
          ]}
        />
      </Card>
    </div>
  );
}

function MaterialTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  const [cat, setCat] = useState('');
  const [angle, setAngle] = useState('');
  const [scene, setScene] = useState('');
  const [extra, setExtra] = useState('');
  const [status, setStatus] = useState('');
  const [used, setUsed] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form] = Form.useForm<{ category: string; angle: Angle; scene: string; crowdTag: CrowdTag }>();

  const cats = useMemo(() => [...new Set(store.materials.map((m) => m.category))], [store.materials]);
  const angles = useMemo(
    () => [...new Set(store.materials.filter((m) => !cat || m.category === cat).map((m) => m.angle))],
    [store.materials, cat],
  );
  const scenes = useMemo(
    () =>
      [...new Set(store.materials.filter((m) => (!cat || m.category === cat) && (!angle || m.angle === angle)).map((m) => m.scene))],
    [store.materials, cat, angle],
  );

  const list = store.materials.filter((m) => {
    if (cat && m.category !== cat) return false;
    if (angle && m.angle !== angle) return false;
    if (scene && m.scene !== scene) return false;
    if (extra && m.crowdTag !== extra) return false;
    if (status && m.status !== status) return false;
    if (used === 'high' && m.usageCount < 30) return false;
    if (used === 'low' && m.usageCount >= 10) return false;
    return true;
  });

  return (
    <>
      <div className={shared.toolbar}>
        <Space wrap>
          <Select
            allowClear
            placeholder="附加标签 全部"
            style={{ width: 140 }}
            value={extra || undefined}
            onChange={(v) => setExtra(v ?? '')}
            options={[
              { value: '单人', label: '单人' },
              { value: '多人', label: '多人' },
            ]}
          />
          <Select
            allowClear
            placeholder="状态 全部"
            style={{ width: 120 }}
            value={status || undefined}
            onChange={(v) => setStatus(v ?? '')}
            options={[
              { value: '启用', label: '启用' },
              { value: '停用', label: '停用' },
            ]}
          />
          <Select
            allowClear
            placeholder="使用次数 全部"
            style={{ width: 180 }}
            value={used || undefined}
            onChange={(v) => setUsed(v ?? '')}
            options={[
              { value: 'high', label: '使用次数高（≥30）' },
              { value: 'low', label: '长尾（<10）' },
            ]}
          />
        </Space>
        {isOps ? (
          <Button type="primary" onClick={() => setUploadOpen(true)}>
            批量上传
          </Button>
        ) : null}
      </div>
      <div className={styles.cascade}>
        <div className={styles.col}>
          <CascadeItem label="全部品类" active={!cat} onClick={() => { setCat(''); setAngle(''); setScene(''); }} />
          {cats.map((c) => (
            <CascadeItem key={c} label={c} active={c === cat} onClick={() => { setCat(c); setAngle(''); setScene(''); }} />
          ))}
        </div>
        <div className={styles.col}>
          <CascadeItem label="全部角度" active={!angle} onClick={() => { setAngle(''); setScene(''); }} />
          {angles.map((a) => (
            <CascadeItem key={a} label={a} active={a === angle} onClick={() => { setAngle(a); setScene(''); }} />
          ))}
        </div>
        <div className={styles.col}>
          <CascadeItem label="全部场景" active={!scene} onClick={() => setScene('')} />
          {scenes.map((s) => (
            <CascadeItem key={s} label={s} active={s === scene} onClick={() => setScene(s)} />
          ))}
        </div>
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={list}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '素材', render: () => <ImagePlaceholder label="素材" kind="mat" size="thumb" /> },
          { title: '素材 ID', dataIndex: 'id' },
          { title: '品类', dataIndex: 'category' },
          { title: '角度', dataIndex: 'angle' },
          { title: '场景', dataIndex: 'scene' },
          { title: '附加标签', dataIndex: 'crowdTag', render: (v: string) => <StatusTag value={v} /> },
          { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} /> },
          { title: '使用次数', dataIndex: 'usageCount' },
          {
            title: '操作',
            render: (_, m: Material) =>
              isOps ? (
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    store.toggleMaterial(m.id);
                    message.success(`已${m.status === '启用' ? '停用' : '启用'}（停用后不再被自动匹配，已创建子任务不受影响）`);
                  }}
                >
                  {m.status === '启用' ? '停用' : '启用'}
                </Button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <Modal
        title="批量上传"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={async () => {
          const values = await form.validateFields();
          const item: Material = {
            id: `MAT-NEW-${Date.now().toString().slice(-4)}`,
            url: 'mat-new',
            category: values.category,
            angle: values.angle,
            scene: values.scene,
            crowdTag: values.crowdTag,
            status: '启用',
            usageCount: 0,
          };
          store.addMaterial(item);
          setUploadOpen(false);
          message.success('已上传（演示）');
        }}
      >
        <p>层级标签三级必填：品类 → 角度 → 场景。附加标签：单人 / 多人。</p>
        <Form form={form} layout="vertical" initialValues={{ category: '连衣裙', angle: '正面', crowdTag: '单人' }}>
          <Form.Item name="category" label="品类" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="angle" label="角度" rules={[{ required: true }]}>
            <Select options={ANGLES.map((a) => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.Item name="scene" label="场景" rules={[{ required: true, message: '场景必填' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="crowdTag" label="附加标签">
            <Select
              options={[
                { value: '单人', label: '单人' },
                { value: '多人', label: '多人' },
              ]}
            />
          </Form.Item>
          <Upload.Dragger disabled>
            <p>选择多张素材图（占位）</p>
          </Upload.Dragger>
        </Form>
      </Modal>
    </>
  );
}

function CascadeItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div className={`${styles.item} ${active ? styles.active : ''}`} onClick={onClick}>
      {label}
    </div>
  );
}

function TemplateTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  const [angle, setAngle] = useState<Angle>('正面');
  const pack = store.promptTemplates.find((t) => t.angle === angle);
  const [draft, setDraft] = useState(pack?.content ?? '');

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        {ANGLES.map((a) => (
          <Button
            key={a}
            type={a === angle ? 'primary' : 'default'}
            onClick={() => {
              setAngle(a);
              const next = store.promptTemplates.find((t) => t.angle === a);
              setDraft(next?.content ?? '');
            }}
          >
            {a}
          </Button>
        ))}
      </Space>
      <p>
        槽位：<code>{'{色值}'}</code> <code>{'{材质}'}</code> <code>{'{品类}'}</code> <code>{'{场景}'}</code>
        。每个角度有且仅有一个启用版本。每次保存生成新版本；修改不影响已创建子任务。
      </p>
      <div className={styles.tplGrid}>
        <div>
          <Typography.Title level={5}>当前文案</Typography.Title>
          <PromptEditor value={draft} editable={isOps} onChange={setDraft} />
          {isOps ? (
            <Button
              type="primary"
              style={{ marginTop: 8 }}
              onClick={() => {
                store.saveTemplate(angle, draft);
                message.success('已保存为新版本并启用');
              }}
            >
              保存为新版本
            </Button>
          ) : null}
        </div>
        <div>
          <Typography.Title level={5}>版本列表</Typography.Title>
          {(pack?.versions ?? []).map((v) => (
            <div key={v.version} className={styles.verItem}>
              <div>
                {angle}-{v.version} {v.version === pack?.version ? <StatusTag value="启用" /> : null}
                <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                  {v.createdAt} · {v.operator}
                </div>
              </div>
              {isOps && v.version !== pack?.version ? (
                <Button
                  size="small"
                  onClick={() => {
                    store.enableTemplate(angle, v.version);
                    setDraft(v.content);
                    message.success('已切换启用版本（每个角度有且仅有一个启用版本）');
                  }}
                >
                  设为启用
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DictTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  return (
    <>
      <Typography.Title level={5}>颜色词典</Typography.Title>
      <p className={styles.muted}>颜色名（含别名列表）、色值（hex）、描述片段。批量创建时按子任务颜色匹配；支持在批量页一键存入。</p>
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowKey="id"
        dataSource={store.colorDictionaries}
        columns={[
          { title: '颜色名', dataIndex: 'name' },
          { title: '别名列表', dataIndex: 'aliases', render: (v: string[]) => v.join(',') },
          {
            title: '色值',
            dataIndex: 'hex',
            render: (hex: string) => (
              <span>
                <span style={{ display: 'inline-block', width: 12, height: 12, background: hex, border: '1px solid #ddd', marginRight: 6, verticalAlign: 'middle' }} />
                {hex}
              </span>
            ),
          },
          { title: '描述片段', dataIndex: 'description' },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 16 }}>
        材质词典
      </Typography.Title>
      <p className={styles.muted}>材质名、描述片段。按 SPU 材质匹配。</p>
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowKey="id"
        dataSource={store.materialDictionaries}
        columns={[
          { title: '材质名', dataIndex: 'name' },
          { title: '描述片段', dataIndex: 'description' },
        ]}
      />
      <Typography.Title level={5} style={{ marginTop: 16 }}>
        未匹配记录
      </Typography.Title>
      <p className={styles.muted}>颜色名 / 材质名、出现次数、最近出现时间。供运营补录。</p>
      <Table
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        rowKey="name"
        dataSource={store.unmatchedRecords}
        columns={[
          { title: '颜色名 / 材质名', dataIndex: 'name' },
          { title: '类型', dataIndex: 'type' },
          { title: '出现次数', dataIndex: 'count' },
          { title: '最近出现时间', dataIndex: 'lastAt' },
          {
            title: '操作',
            render: () => (isOps ? <Button type="link" size="small" onClick={() => message.info(`补录入口（演示 ${nowLabel()}）`)}>补录</Button> : '—'),
          },
        ]}
      />
    </>
  );
}
