import { useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tabs, Typography, Upload, message } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { LibraryTagSelect } from '@/components/LibraryTagSelect';
import { PromptEditor } from '@/components/PromptEditor';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES, CATEGORIES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, CrowdTag, Material } from '@/types/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

export default function Config() {
  const { role } = useRole();
  const isOps = role === '运营';

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        配置管理
        <span className={shared.sub}>图库按 品类-标签-角度 打标；描述词按 品类-角度</span>
      </Typography.Title>
      <Card size="small">
        <Tabs
          items={[
            { key: 'mat', label: '图库配置', children: <MaterialTab isOps={isOps} /> },
            { key: 'tpl', label: '描述词配置', children: <TemplateTab isOps={isOps} /> },
          ]}
        />
      </Card>
    </div>
  );
}

function MaterialTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [angle, setAngle] = useState('');
  const [status, setStatus] = useState('');
  const [used, setUsed] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form] = Form.useForm<{ category: string; angle: Angle; scene: string; crowdTag: CrowdTag }>();

  const cats = useMemo(() => [...new Set(store.materials.map((m) => m.category))], [store.materials]);
  const tags = useMemo(
    () => [...new Set(store.materials.filter((m) => !cat || m.category === cat).map((m) => m.crowdTag))],
    [store.materials, cat],
  );
  const angles = useMemo(
    () =>
      [
        ...new Set(
          store.materials
            .filter((m) => (!cat || m.category === cat) && (!tag || m.crowdTag === tag))
            .map((m) => m.angle),
        ),
      ],
    [store.materials, cat, tag],
  );

  const list = store.materials.filter((m) => {
    if (cat && m.category !== cat) return false;
    if (tag && m.crowdTag !== tag) return false;
    if (angle && m.angle !== angle) return false;
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
      <p style={{ color: 'rgba(0,0,0,0.45)' }}>参考图按 <b>品类 → 标签 → 角度</b> 归档。标签由上传时打标，设计按这三维调库；也可手传图2/图3/图4。</p>
      <div className={styles.cascade}>
        <div className={styles.col}>
          <CascadeItem label="全部品类" active={!cat} onClick={() => { setCat(''); setTag(''); setAngle(''); }} />
          {cats.map((c) => (
            <CascadeItem key={c} label={c} active={c === cat} onClick={() => { setCat(c); setTag(''); setAngle(''); }} />
          ))}
        </div>
        <div className={styles.col}>
          <CascadeItem label="全部标签" active={!tag} onClick={() => { setTag(''); setAngle(''); }} />
          {tags.map((t) => (
            <CascadeItem key={t} label={t} active={t === tag} onClick={() => { setTag(t); setAngle(''); }} />
          ))}
        </div>
        <div className={styles.col}>
          <CascadeItem label="全部角度" active={!angle} onClick={() => setAngle('')} />
          {angles.map((a) => (
            <CascadeItem key={a} label={a} active={a === angle} onClick={() => setAngle(a)} />
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
          { title: '参考图', render: () => <ImagePlaceholder label="参考图" kind="mat" size="thumb" /> },
          { title: '图库 ID', dataIndex: 'id' },
          { title: '品类', dataIndex: 'category' },
          { title: '标签', dataIndex: 'crowdTag', render: (v: string) => <StatusTag value={v} /> },
          { title: '角度', dataIndex: 'angle' },
          { title: '场景（备注）', dataIndex: 'scene' },
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
                    message.success(`已${m.status === '启用' ? '停用' : '启用'}（停用后设计端不再调出）`);
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
            scene: values.scene || '',
            crowdTag: values.crowdTag,
            status: '启用',
            usageCount: 0,
          };
          store.addMaterial(item);
          setUploadOpen(false);
          message.success('已上传（演示）');
        }}
      >
        <p>必填：品类、标签、角度。标签选已有或输入新建。场景可作备注。上传后设计即可按这三维手选参考图，也可手传。</p>
        <Form form={form} layout="vertical" initialValues={{ category: '连衣裙', angle: '正面' }}>
          <Form.Item name="category" label="品类" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="crowdTag" label="标签" rules={[{ required: true, message: '请选择或新建标签' }]}>
            <LibraryTagSelect materials={store.materials} allowCreate allowEmpty={false} />
          </Form.Item>
          <Form.Item name="angle" label="角度" rules={[{ required: true }]}>
            <Select options={ANGLES.map((a) => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.Item name="scene" label="场景（备注，选填）">
            <Input />
          </Form.Item>
          <Upload.Dragger disabled>
            <p>选择多张参考图（占位）</p>
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
  const [cat, setCat] = useState<string>(CATEGORIES[0]);
  const [angle, setAngle] = useState<Angle>('正面');
  const pack = store.promptTemplates.find((t) => t.category === cat && t.angle === angle);
  const [draft, setDraft] = useState(pack?.content ?? '');

  const load = (nextCat: string, nextAngle: Angle) => {
    const next = store.promptTemplates.find((t) => t.category === nextCat && t.angle === nextAngle);
    setDraft(next?.content ?? '');
  };

  return (
    <>
      <p style={{ color: 'rgba(0,0,0,0.45)' }}>描述词按 <b>品类 → 角度</b> 分层。制作时按 SPU 品类 + 行角度匹配启用模板。</p>
      <div className={styles.cascade2}>
        <div className={styles.col}>
          {CATEGORIES.map((c) => (
            <CascadeItem
              key={c}
              label={c}
              active={c === cat}
              onClick={() => {
                setCat(c);
                load(c, angle);
              }}
            />
          ))}
        </div>
        <div className={styles.col}>
          {ANGLES.map((a) => (
            <CascadeItem
              key={a}
              label={a}
              active={a === angle}
              onClick={() => {
                setAngle(a);
                load(cat, a);
              }}
            />
          ))}
        </div>
      </div>
      <p>
        当前：<b>{cat}</b> · <b>{angle}</b>。槽位：<code>{'{色值}'}</code> <code>{'{材质}'}</code>{' '}
        <code>{'{品类}'}</code> <code>{'{场景}'}</code>
        。每个品类 × 角度有且仅有一个启用版本。色值按材质 + 颜色从灵枢【AI颜色图配置】填入。每次保存生成新版本；修改不影响已创建子任务。
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
                store.saveTemplate(cat, angle, draft);
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
                {cat}-{angle}-{v.version} {v.version === pack?.version ? <StatusTag value="启用" /> : null}
                <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                  {v.createdAt} · {v.operator}
                </div>
              </div>
              {isOps && v.version !== pack?.version ? (
                <Button
                  size="small"
                  onClick={() => {
                    store.enableTemplate(cat, angle, v.version);
                    setDraft(v.content);
                    message.success('已切换启用版本（每个品类 × 角度有且仅有一个启用版本）');
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

