import { useMemo, useState } from 'react';
import { PlusOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Form, Input, Modal, Segmented, Select, Space, Table, Tabs, Tag, Typography, Upload, message } from 'antd';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { LibraryTagSelect } from '@/components/LibraryTagSelect';
import { PromptEditor } from '@/components/PromptEditor';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES, CATEGORIES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, CrowdTag, Material, PromptTemplate } from '@/types/buyer-show';
import { categoryHasTag, libraryTags, templateDisplayName } from '@/utils/buyer-show';
import shared from '../shared.module.css';
import styles from './index.module.css';

const ANGLE_TAG_COLOR: Record<Angle, string> = {
  正面: 'cyan',
  侧面: 'purple',
  背面: 'green',
  半身: 'orange',
};

export default function Config() {
  const { isLead } = useRole();

  if (!isLead) {
    return (
      <div className={shared.page}>
        <Empty description="配置管理仅设计组长、运营组长可访问" />
      </div>
    );
  }

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        配置管理
        <span className={shared.sub}>标签按品类管理；图库按 品类 / 标签 / 角度 筛选；描述词按 品类-角度</span>
      </Typography.Title>
      <Card size="small">
        <Tabs
          items={[
            { key: 'mat', label: '图库配置', children: <MaterialTab isOps={isLead} /> },
            { key: 'tpl', label: '描述词配置', children: <TemplateTab isOps={isLead} /> },
          ]}
        />
      </Card>
    </div>
  );
}

function MaterialTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  const [tagCat, setTagCat] = useState(CATEGORIES[0]);
  const [tagOpen, setTagOpen] = useState(false);
  const [cat, setCat] = useState('');
  const [tag, setTag] = useState('');
  const [angle, setAngle] = useState('');
  const [status, setStatus] = useState('');
  const [used, setUsed] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form] = Form.useForm<{ category: string; angle: Angle; scene: string; crowdTag: CrowdTag }>();
  const [tagForm] = Form.useForm<{ category: string; name: string }>();
  const uploadCategory = Form.useWatch('category', form);

  const managedTags = useMemo(
    () => store.categoryTags.filter((t) => t.category === tagCat),
    [store.categoryTags, tagCat],
  );

  const filterTags = useMemo(
    () => libraryTags(store.materials, { category: cat || undefined, includeDisabled: true, categoryTags: store.categoryTags }),
    [store.materials, store.categoryTags, cat],
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

  const openCreateTag = () => setTagOpen(true);

  const confirmCreateTag = async () => {
    const values = await tagForm.validateFields();
    const name = values.name.trim();
    const category = values.category;
    if (categoryHasTag(store.categoryTags, category, name)) {
      tagForm.setFields([{ name: 'name', errors: [`「${category}」下已有标签「${name}」，不能重复创建`] }]);
      return;
    }
    const ok = store.addCategoryTag({
      id: `TAG-${Date.now().toString().slice(-6)}`,
      category,
      name,
      status: '启用',
    });
    if (!ok) {
      tagForm.setFields([{ name: 'name', errors: [`「${category}」下已有标签「${name}」，不能重复创建`] }]);
      return;
    }
    setTagCat(category);
    setTagOpen(false);
    tagForm.resetFields();
    message.success(`已在「${category}」下创建标签「${name}」`);
  };

  return (
    <>
      <Card
        size="small"
        className={styles.section}
        title="标签管理"
        extra={
          isOps ? (
            <Button type="primary" onClick={openCreateTag}>
              新建标签
            </Button>
          ) : null
        }
      >
        <p className={styles.muted}>按品类维护标签。设计端只能选该品类下已启用的标签；无图的标签也能先建好，上传或调库时再用。同一品类下标签名不能完全相同。</p>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            style={{ width: 160 }}
            value={tagCat}
            onChange={setTagCat}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </Space>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={managedTags}
          locale={{ emptyText: `「${tagCat}」下还没有标签` }}
          columns={[
            { title: '标签', dataIndex: 'name' },
            { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => <StatusTag value={v} /> },
            {
              title: '关联图片',
              width: 100,
              render: (_, t) =>
                store.materials.filter((m) => m.category === t.category && m.crowdTag === t.name).length,
            },
            {
              title: '操作',
              width: 90,
              render: (_, t) =>
                isOps ? (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      store.toggleCategoryTag(t.id);
                      message.success(`已${t.status === '启用' ? '停用' : '启用'}（停用后设计端不再选到）`);
                    }}
                  >
                    {t.status === '启用' ? '停用' : '启用'}
                  </Button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>

      <Card
        size="small"
        title="参考图"
        extra={
          isOps ? (
            <Button type="primary" onClick={() => setUploadOpen(true)}>
              批量上传
            </Button>
          ) : null
        }
      >
        <p className={styles.muted}>
          按 <b>品类、标签、角度</b> 筛选查看。标签来自上方标签库（无图也能筛到空态）。场景仅作备注。
        </p>
        <div className={shared.toolbar}>
          <Space wrap>
            <Select
              allowClear
              placeholder="品类 全部"
              style={{ width: 140 }}
              value={cat || undefined}
              onChange={(v) => {
                const next = v ?? '';
                setCat(next);
                if (tag && !libraryTags(store.materials, { category: next || undefined, includeDisabled: true, categoryTags: store.categoryTags }).includes(tag)) {
                  setTag('');
                }
              }}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <Select
              allowClear
              placeholder="标签 全部"
              style={{ width: 140 }}
              value={tag || undefined}
              onChange={(v) => setTag(v ?? '')}
              options={filterTags.map((t) => ({ value: t, label: t }))}
            />
            <Select
              allowClear
              placeholder="角度 全部"
              style={{ width: 120 }}
              value={angle || undefined}
              onChange={(v) => setAngle(v ?? '')}
              options={ANGLES.map((a) => ({ value: a, label: a }))}
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
        </div>
        {list.length ? (
          <div className={styles.gallery}>
            {list.map((m) => (
              <div key={m.id} className={styles.card}>
                <ImagePlaceholder label={`${m.crowdTag} · ${m.angle}`} kind="mat" size="gallery" source={m.scene || m.id} />
                <div className={styles.cardMeta}>
                  <div className={styles.cardTitle}>
                    {m.category} · {m.crowdTag} · {m.angle}
                  </div>
                  <div className={styles.cardScene}>{m.scene || '无场景备注'}</div>
                  <div className={styles.cardFoot}>
                    <Space size={4} wrap>
                      <StatusTag value={m.status} />
                      <span className={styles.muted} style={{ margin: 0 }}>
                        {m.usageCount} 次
                      </span>
                    </Space>
                    {isOps ? (
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
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该筛选下暂无参考图，请调整筛选或上传" />
        )}
      </Card>

      <Modal
        title="新建标签"
        open={tagOpen}
        okText="确认"
        cancelText="取消"
        destroyOnClose
        onCancel={() => {
          setTagOpen(false);
          tagForm.resetFields();
        }}
        onOk={confirmCreateTag}
      >
        <p className={styles.muted}>同一品类下不能有两个完全一样的标签名。</p>
        <Form form={tagForm} layout="vertical" preserve={false} initialValues={{ category: tagCat, name: '' }}>
          <Form.Item name="category" label="品类" rules={[{ required: true, message: '请选择品类' }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item
            name="name"
            label="标签名"
            dependencies={['category']}
            rules={[
              { required: true, whitespace: true, message: '请输入标签名' },
              {
                validator: async (_, value) => {
                  const name = String(value ?? '').trim();
                  const category = tagForm.getFieldValue('category');
                  if (!name || !category) return;
                  if (categoryHasTag(store.categoryTags, category, name)) {
                    return Promise.reject(new Error(`「${category}」下已有标签「${name}」，不能重复创建`));
                  }
                },
              },
            ]}
          >
            <Input placeholder="例如：通勤、花园、街拍" maxLength={20} onPressEnter={confirmCreateTag} />
          </Form.Item>
        </Form>
      </Modal>
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
          form.resetFields();
          message.success('已上传，新标签会同步写入该品类标签库');
        }}
      >
        <p>必填：品类、标签、角度。标签从该品类标签库选，也可输入新建。场景可作备注。</p>
        <Form form={form} layout="vertical" initialValues={{ category: '连衣裙', angle: '正面' }}>
          <Form.Item name="category" label="品类" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="crowdTag" label="标签" rules={[{ required: true, message: '请选择或新建标签' }]}>
            <LibraryTagSelect
              materials={store.materials}
              categoryTags={store.categoryTags}
              category={uploadCategory}
              allowCreate
              allowEmpty={false}
            />
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

function TemplateTab({ isOps }: { isOps: boolean }) {
  const store = useBuyerShow();
  const [keyword, setKeyword] = useState('');
  const [angleFilter, setAngleFilter] = useState<Angle | '全部'>('全部');
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [createForm] = Form.useForm<{ category: string; angle: Angle; content: string }>();

  const list = useMemo(() => {
    const q = keyword.trim();
    return store.promptTemplates
      .filter((t) => {
        if (angleFilter !== '全部' && t.angle !== angleFilter) return false;
        if (!q) return true;
        return templateDisplayName(t).includes(q) || t.category.includes(q) || t.content.includes(q);
      })
      .sort((a, b) => a.category.localeCompare(b.category, 'zh') || ANGLES.indexOf(a.angle) - ANGLES.indexOf(b.angle));
  }, [store.promptTemplates, keyword, angleFilter]);

  const openEdit = (t: PromptTemplate) => {
    setEditing(t);
    setDraft(t.content);
  };

  const openCreate = () => {
    createForm.setFieldsValue({ category: CATEGORIES[0], angle: '正面', content: '' });
    setCreateOpen(true);
  };

  return (
    <>
      <div className={styles.tplHead}>
        <p className={styles.muted}>
          管理生成任务描述词。制作时按 SPU <b>品类 + 角度</b> 匹配启用模板，槽位{' '}
          <code>{'{色值}'}</code> <code>{'{材质}'}</code> <code>{'{品类}'}</code> <code>{'{场景}'}</code>
          。每个品类 × 角度有且仅有一套启用模板。
        </p>
        {isOps ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建模板
          </Button>
        ) : null}
      </div>
      <div className={styles.tplToolbar}>
        <Input.Search
          allowClear
          placeholder="搜索模板名称"
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Segmented<Angle | '全部'>
          value={angleFilter}
          onChange={setAngleFilter}
          options={[{ label: '全部', value: '全部' }, ...ANGLES.map((a) => ({ label: a, value: a }))]}
        />
      </div>
      <Table
        size="small"
        rowKey="id"
        dataSource={list}
        pagination={list.length > 10 ? { pageSize: 10, showSizeChanger: false } : false}
        locale={{ emptyText: '没有匹配的模板' }}
        columns={[
          {
            title: '模板名称',
            width: 160,
            render: (_, t) => (
              <Button type="link" className={styles.tplName} onClick={() => openEdit(t)}>
                {templateDisplayName(t)}
              </Button>
            ),
          },
          {
            title: '适用角度',
            width: 100,
            dataIndex: 'angle',
            render: (v: Angle) => <Tag color={ANGLE_TAG_COLOR[v]}>{v}</Tag>,
          },
          { title: '品类', width: 100, dataIndex: 'category' },
          {
            title: '模板正文',
            render: (_, t) => (
              <Typography.Paragraph className={styles.tplBody} ellipsis={{ rows: 1 }}>
                {t.content}
              </Typography.Paragraph>
            ),
          },
          {
            title: '默认',
            width: 70,
            align: 'center',
            render: (_, t) =>
              isOps ? (
                <Button
                  type="text"
                  aria-label={t.status === '启用' ? '当前默认' : '设为默认'}
                  icon={
                    t.status === '启用' ? (
                      <StarFilled className={styles.starOn} />
                    ) : (
                      <StarOutlined />
                    )
                  }
                  onClick={() => {
                    if (t.status === '启用') return;
                    store.setTemplateStatus(t.id, '启用');
                    message.success(`已将「${templateDisplayName(t)}」设为匹配用模板`);
                  }}
                />
              ) : t.status === '启用' ? (
                <StarFilled className={styles.starOn} />
              ) : (
                <StarOutlined />
              ),
          },
          {
            title: '状态',
            width: 80,
            dataIndex: 'status',
            render: (v: string) => <StatusTag value={v} />,
          },
          {
            title: '创建人',
            width: 100,
            render: (_, t) => t.versions[t.versions.length - 1]?.operator ?? '—',
          },
          {
            title: '操作',
            width: 180,
            render: (_, t) =>
              isOps ? (
                <Space>
                  <Button type="link" size="small" onClick={() => openEdit(t)}>
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const next = t.status === '启用' ? '停用' : '启用';
                      store.setTemplateStatus(t.id, next);
                      message.success(
                        next === '停用'
                          ? `已停用「${templateDisplayName(t)}」（制作时不再匹配）`
                          : `已启用「${templateDisplayName(t)}」`,
                      );
                    }}
                  >
                    {t.status === '启用' ? '停用' : '启用'}
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => {
                      Modal.confirm({
                        title: `删除「${templateDisplayName(t)}」？`,
                        content: '删除后该品类 × 角度将没有可匹配模板，已创建子任务不受影响。',
                        okText: '删除',
                        okButtonProps: { danger: true },
                        onOk: () => {
                          store.deleteTemplate(t.id);
                          message.success('已删除');
                        },
                      });
                    }}
                  >
                    删除
                  </Button>
                </Space>
              ) : (
                <Button type="link" size="small" onClick={() => openEdit(t)}>
                  查看
                </Button>
              ),
          },
        ]}
      />

      <Modal
        title={editing ? (isOps ? '编辑模板' : '查看模板') : '新建模板'}
        open={Boolean(editing)}
        width={820}
        destroyOnClose
        onCancel={() => setEditing(null)}
        footer={
          isOps && editing
            ? [
                <Button key="cancel" onClick={() => setEditing(null)}>
                  取消
                </Button>,
                <Button
                  key="save"
                  type="primary"
                  onClick={() => {
                    if (!draft.trim()) {
                      message.warning('请填写模板正文');
                      return;
                    }
                    store.saveTemplate(editing.category, editing.angle, draft);
                    message.success('已保存为新版本并启用');
                    setEditing(null);
                  }}
                >
                  保存为新版本
                </Button>,
              ]
            : [
                <Button key="close" onClick={() => setEditing(null)}>
                  关闭
                </Button>,
              ]
        }
      >
        {editing ? (
          <>
            <p className={styles.muted}>
              {templateDisplayName(editing)} · 当前 {editing.version} · 匹配维度仍是品类 × 角度
            </p>
            <div className={styles.tplGrid}>
              <div>
                <Typography.Title level={5}>模板正文</Typography.Title>
                <PromptEditor value={draft} editable={isOps} onChange={setDraft} rows={8} />
              </div>
              <div>
                <Typography.Title level={5}>版本列表</Typography.Title>
                {editing.versions.map((v) => (
                  <div key={v.version} className={styles.verItem}>
                    <div>
                      {editing.category}-{editing.angle}-{v.version}{' '}
                      {v.version === editing.version ? <StatusTag value="启用" /> : null}
                      <div className={styles.muted} style={{ margin: 0 }}>
                        {v.createdAt} · {v.operator}
                      </div>
                    </div>
                    {isOps && v.version !== editing.version ? (
                      <Button
                        size="small"
                        onClick={() => {
                          store.enableTemplate(editing.category, editing.angle, v.version);
                          setDraft(v.content);
                          setEditing((prev) =>
                            prev
                              ? { ...prev, version: v.version, content: v.content, status: '启用' }
                              : prev,
                          );
                          message.success('已切换启用版本');
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
        ) : null}
      </Modal>

      <Modal
        title="新建模板"
        open={createOpen}
        okText="确认"
        destroyOnClose
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={async () => {
          const values = await createForm.validateFields();
          const exists = store.promptTemplates.some(
            (t) => t.category === values.category && t.angle === values.angle,
          );
          if (exists) {
            createForm.setFields([
              { name: 'angle', errors: [`「${values.category}」×「${values.angle}」已有模板，请直接编辑`] },
            ]);
            return;
          }
          store.saveTemplate(values.category, values.angle, values.content.trim());
          setCreateOpen(false);
          createForm.resetFields();
          message.success(`已创建「${values.category}（${values.angle}）」并启用`);
        }}
      >
        <p className={styles.muted}>同一品类 × 角度只能有一套模板。制作时按这个维度匹配启用项。</p>
        <Form form={createForm} layout="vertical" initialValues={{ category: CATEGORIES[0], angle: '正面' }}>
          <Form.Item name="category" label="品类" rules={[{ required: true, message: '请选择品类' }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="angle" label="适用角度" rules={[{ required: true, message: '请选择角度' }]}>
            <Select options={ANGLES.map((a) => ({ value: a, label: a }))} />
          </Form.Item>
          <Form.Item name="content" label="模板正文" rules={[{ required: true, whitespace: true, message: '请填写模板正文' }]}>
            <Input.TextArea rows={6} placeholder="可使用 {色值} {材质} {品类} {场景}" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

