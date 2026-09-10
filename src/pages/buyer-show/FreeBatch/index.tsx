import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ImagePlaceholder } from '@/components/ImagePlaceholder';
import { LibraryTagSelect } from '@/components/LibraryTagSelect';
import { MaterialPicker } from '@/components/MaterialPicker';
import { QcCoverageTag } from '@/components/QcImageEditor';
import { StatusTag } from '@/components/StatusTag';
import { ANGLES } from '@/constants/buyer-show';
import { useRole } from '@/contexts/RoleContext';
import { useBuyerShow } from '@/store/buyerShow';
import type { Angle, CrowdTag, FreeBatch, Image1Source, SpuMaster, Subtask } from '@/types/buyer-show';
import {
  colorHex,
  colorMatchDisplay,
  fillPromptFromSpu,
  image1Kind,
  isFreeBatchSub,
  isUploadedSlot,
  matchColor,
  matchScmMaterial,
  resolveProductImage,
  resolveQcImageOptional,
  nextFreeBatchId,
  nowLabel,
  parseSpuTable,
  parseSpuTokens,
  promptHasColorSlotFilled,
  SPU_TABLE_TEMPLATE,
  type SpuImportRow,
} from '@/utils/buyer-show';
import { downloadFreeBatchResults } from '@/utils/zip-download';
import shared from '../shared.module.css';

interface SpuCard {
  key: string;
  spu: string;
  count: number;
}

interface DraftRow {
  key: string;
  cardKey: string;
  spu: string;
  idx: number;
  color: string;
  angle: Angle;
  tag: CrowdTag;
  category: string;
  img1Source: Image1Source;
  img1Label: string;
  img2: string;
  img3Source?: Image1Source;
  img3Label: string;
  img4Label: string;
  prompt: string;
  ver: string;
  match: '匹配成功' | '未匹配';
  error: boolean;
  promptOpen: boolean;
}

function buildRows(
  cards: SpuCard[],
  spus: SpuMaster[],
  promptTemplates: ReturnType<typeof useBuyerShow>['promptTemplates'],
  colorDictionaries: ReturnType<typeof useBuyerShow>['colorDictionaries'],
  prevRows: DraftRow[] = [],
): DraftRow[] {
  const next: DraftRow[] = [];
  cards.forEach((card) => {
    const master = spus.find((s) => s.spu === card.spu);
    if (!master) return;
    const n = Math.max(1, card.count);
    for (let i = 0; i < n; i += 1) {
      const prev = prevRows.find((p) => p.cardKey === card.key && p.idx === i + 1);
      const angle = prev?.angle ?? ANGLES[i % 4];
      const tag = prev?.tag ?? '';
      const color = prev?.color ?? '';
      const img1 = resolveProductImage(master, angle);
      const qc = prev?.img3Label
        ? { source: prev.img3Source, label: prev.img3Label }
        : resolveQcImageOptional(master, angle);
      const p =
        prev && prev.color === color && prev.angle === angle
          ? { text: prev.prompt, ver: prev.ver }
          : fillPromptFromSpu(master, angle, color, promptTemplates, colorDictionaries);
      next.push({
        key: `${card.key}-${i + 1}`,
        cardKey: card.key,
        spu: card.spu,
        idx: i + 1,
        color,
        angle,
        tag,
        category: master.category,
        img1Source: img1.source,
        img1Label: img1.label,
        img2: prev?.img2 ?? '',
        img3Source: qc?.source,
        img3Label: qc?.label ?? '',
        img4Label: prev?.img4Label ?? '',
        prompt: p.text,
        ver: p.ver,
        match: matchColor(color, colorDictionaries),
        error: false,
        promptOpen: prev?.promptOpen ?? false,
      });
    }
  });
  return next;
}

export default function FreeBatchPage() {
  const { role } = useRole();
  const isDesigner = role === '买家秀设计';
  const store = useBuyerShow();
  const { spus, subtasks, freeBatches, materials, promptTemplates, colorDictionaries, materialDictionaries, currentDesigner } =
    store;

  const [search, setSearch] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(SPU_TABLE_TEMPLATE);
  const [cards, setCards] = useState<SpuCard[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [unifiedColor, setUnifiedColor] = useState('');
  const [activeBatchId, setActiveBatchId] = useState<string>();
  const [downloading, setDownloading] = useState(false);

  const allSpuOptions = useMemo(
    () => spus.map((s) => ({ value: s.spu, label: `${s.spu} ${s.spuName}` })),
    [spus],
  );

  const options = useMemo(
    () =>
      spus
        .filter((s) => !search || s.spu.includes(search) || s.spuName.includes(search))
        .slice(0, 12)
        .map((s) => ({ value: s.spu, label: `${s.spu} ${s.spuName}` })),
    [spus, search],
  );

  const addBlankRow = () => {
    setCards((prev) => [
      ...prev,
      { key: `new-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, spu: '', count: 4 },
    ]);
  };

  const addSpu = (code: string) => {
    const token = code.trim();
    const master = spus.find((s) => s.spu === token);
    if (!master) {
      message.warning(`未命中 ${token || '该 SPU'}`);
      return;
    }
    const key = `${master.spu}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setCards((prev) => [...prev, { key, spu: master.spu, count: 4 }]);
    setSearch('');
  };

  const colorOptions = useMemo(
    () => colorDictionaries.map((c) => ({ value: c.name, label: `${c.name} ${c.hex}` })),
    [colorDictionaries],
  );

  const addMany = (tokens: string[]) => {
    const hits: SpuCard[] = [];
    const miss: string[] = [];
    tokens.forEach((token) => {
      const master = spus.find((s) => s.spu === token);
      if (!master) {
        miss.push(token);
        return;
      }
      hits.push({
        key: `${master.spu}-${Date.now()}-${hits.length}`,
        spu: master.spu,
        count: 4,
      });
    });
    if (hits.length) setCards((prev) => [...prev, ...hits]);
    if (miss.length) message.warning(`未命中：${miss.join('、')}`);
    if (hits.length) message.success(`已加入 ${hits.length} 个 SPU`);
  };

  const addTableRows = (imported: SpuImportRow[]) => {
    const hits: SpuCard[] = [];
    const miss: string[] = [];
    imported.forEach((row, i) => {
      const master = spus.find((s) => s.spu === row.spu);
      if (!master) {
        miss.push(row.spu);
        return;
      }
      hits.push({
        key: `${master.spu}-${Date.now()}-${i}`,
        spu: master.spu,
        count: row.count || 4,
      });
    });
    if (hits.length) setCards((prev) => [...prev, ...hits]);
    if (miss.length) message.warning(`未命中：${[...new Set(miss)].join('、')}`);
    if (hits.length) message.success(`已导入 ${hits.length} 行（SPU / 个数）`);
  };

  const applyImportText = (raw: string) => {
    const { rows: imported, errors } = parseSpuTable(raw);
    if (errors.length && !imported.length) {
      message.error(errors[0]);
      return false;
    }
    if (!imported.length) {
      message.warning('没有可导入的行');
      return false;
    }
    if (errors.length) message.warning(errors.slice(0, 3).join('；'));
    addTableRows(imported);
    return true;
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${SPU_TABLE_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '自由批量生图表格模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const patchCard = (key: string, patch: Partial<SpuCard>) => {
    setCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  };

  const expand = (nextCards = cards) => {
    setRows((prev) => buildRows(nextCards, spus, promptTemplates, colorDictionaries, prev));
  };

  useEffect(() => {
    if (cards.length) expand(cards);
    else setRows([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 卡变更时重展
  }, [cards]);

  const patchRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const master = spus.find((s) => s.spu === next.spu);
        if (master && (patch.angle || patch.color !== undefined || patch.tag)) {
          const img1 = resolveProductImage(master, next.angle);
          next.img1Source = img1.source;
          next.img1Label = img1.label;
          if (patch.angle && !next.img3Label.startsWith('已上传')) {
            const qc = resolveQcImageOptional(master, next.angle);
            next.img3Source = qc?.source;
            next.img3Label = qc?.label ?? '';
          }
          if ((patch.tag || patch.angle) && !isUploadedSlot(next.img2)) next.img2 = '';
          next.match = matchColor(next.color, colorDictionaries);
          const p = fillPromptFromSpu(master, next.angle, next.color, promptTemplates, colorDictionaries);
          next.prompt = p.text;
          next.ver = p.ver;
        } else if (patch.color !== undefined) {
          next.match = matchColor(next.color, colorDictionaries);
        }
        return next;
      }),
    );
  };

  const create = () => {
    const checked = rows.map((r) => {
      const hexFilled = promptHasColorSlotFilled(r.prompt);
      const error =
        !r.color ||
        !r.angle ||
        !r.prompt ||
        r.img1Label.includes('请上传') ||
        (r.match === '未匹配' && !hexFilled);
      return { ...r, error };
    });
    setRows(checked);
    const ok = checked.filter((r) => !r.error);
    const bad = checked.filter((r) => r.error);
    if (!ok.length) {
      message.error('全部行未通过校验，已标红');
      return;
    }
    if (bad.length) message.warning(`已拦截 ${bad.length} 行红格，其余 ${ok.length} 行继续创建`);

    const batchId = nextFreeBatchId(freeBatches.length);
    const items: Subtask[] = ok.map((r, i) => ({
      id: `FBS-${batchId.slice(-8)}-${String(i + 1).padStart(2, '0')}`,
      mainTaskId: batchId,
      source: '手动批量',
      batchId,
      spu: r.spu,
      color: r.color,
      angle: r.angle,
      category: spus.find((s) => s.spu === r.spu)?.category ?? '',
      crowdTag: r.tag,
      sceneTag: '默认场景',
      produceMode: '批量制作',
      status: '生图中',
      reviewRound: 0,
      generateCount: 1,
      assignee: currentDesigner,
      createdAt: nowLabel(),
      image1: { url: r.img1Label, source: r.img1Source || '商品图' },
      image2: r.img2
        ? isUploadedSlot(r.img2)
          ? { url: r.img2, source: '手动' }
          : { url: r.img2, materialId: r.img2, source: '参考图' }
        : { url: '', source: '参考图' },
      image3: r.img3Label ? { url: r.img3Label, source: r.img3Source || '质检图' } : undefined,
      image4: r.img4Label ? { url: r.img4Label, source: '其他' } : undefined,
      prompt: r.prompt,
      templateVersion: r.ver,
      colorMatchStatus: r.match,
      operationLogs: [{ action: '自由批量创建，进入生图中', operator: currentDesigner, createdAt: nowLabel() }],
    }));
    const batch: FreeBatch = {
      id: batchId,
      createdAt: items[0].createdAt,
      operator: currentDesigner,
      spus: [...new Set(ok.map((r) => r.spu))],
      imageCount: items.length,
    };
    store.createFreeBatch(batch, items);
    setActiveBatchId(batchId);
    setRows(checked.filter((r) => r.error));
    message.success(`已创建批次 ${batchId}，${items.length} 张进入【生图中】`);
    window.setTimeout(() => store.completeGen(items.map((s) => s.id)), 800);
  };

  const batchSubs = subtasks.filter((s) => isFreeBatchSub(s) && (!activeBatchId || s.batchId === activeBatchId));
  const readySubs = batchSubs.filter((s) => Boolean(s.currentResultUrl));
  const readyCount = readySubs.length;

  const downloadReady = async () => {
    if (!readySubs.length) {
      message.warning('本批暂无成功结果图');
      return;
    }
    setDownloading(true);
    try {
      await downloadFreeBatchResults(readySubs, `${activeBatchId ?? '本批'}-结果图.zip`);
      message.success(`已下载 ${readySubs.length} 张，文件夹按 SPU 命名`);
    } catch {
      message.error('打包下载失败');
    } finally {
      setDownloading(false);
    }
  };

  const rerunOne = (id: string) => {
    const sub = batchSubs.find((s) => s.id === id);
    if (sub?.status !== '生图失败') return;
    store.regenerate(id);
    window.setTimeout(() => store.completeGen([id]), 800);
    message.success('已重跑，沿用原参数');
  };

  const cardCols: ColumnsType<SpuCard> = [
    {
      title: 'SPU',
      width: 280,
      render: (_, c) => {
        const m = spus.find((s) => s.spu === c.spu);
        return (
          <Space align="start">
            <ImagePlaceholder label={m?.coverImage ? '首图' : '无首图'} kind="prod" size="thumb" />
            <div>
              <AutoComplete
                style={{ width: 200 }}
                options={allSpuOptions}
                value={c.spu}
                onChange={(spu) => patchCard(c.key, { spu })}
                onSelect={(spu) => patchCard(c.key, { spu })}
                placeholder="搜索编码 / 名称"
                filterOption={(input, option) =>
                  String(option?.value ?? '').includes(input) || String(option?.label ?? '').includes(input)
                }
              />
              <div style={{ color: m ? 'rgba(0,0,0,0.45)' : '#ff4d4f', marginTop: 4 }}>
                {c.spu ? (m ? m.spuName : '未命中，不进入展开') : '填写 SPU、个数；材质由 SCM 带出'}
              </div>
            </div>
          </Space>
        );
      },
    },
    { title: '品类', width: 80, render: (_, c) => spus.find((s) => s.spu === c.spu)?.category ?? '—' },
    {
      title: '质检图',
      render: (_, c) => {
        const m = spus.find((s) => s.spu === c.spu);
        return <QcCoverageTag images={m?.qcImages} status={m?.qcStatus} />;
      },
    },
    {
      title: '张数',
      width: 110,
      render: (_, c) => (
        <InputNumber min={1} max={16} value={c.count} onChange={(v) => patchCard(c.key, { count: Number(v) || 4 })} />
      ),
    },
    {
      title: '材质',
      width: 160,
      render: (_, c) => {
        const m = spus.find((s) => s.spu === c.spu);
        const scm = matchScmMaterial(m?.material, materialDictionaries);
        if (!c.spu) return <span style={{ color: 'rgba(0,0,0,0.45)' }}>—</span>;
        if (!scm.name) return <span style={{ color: '#ff4d4f' }}>SCM 未返回材质</span>;
        return (
          <div>
            <div>{scm.name}</div>
            <div style={{ color: scm.matched ? 'rgba(0,0,0,0.45)' : '#d48806', fontSize: 12 }}>
              {scm.matched ? `SCM 自动匹配 · ${scm.description ?? ''}` : 'SCM 已带出，词典未匹配'}
            </div>
          </div>
        );
      },
    },
    {
      title: '操作',
      width: 140,
      render: (_, c) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => setCards((prev) => [...prev, { ...c, key: `${c.spu}-${Date.now()}` }])}
          >
            复制
          </Button>
          <Button type="link" size="small" danger onClick={() => setCards((prev) => prev.filter((x) => x.key !== c.key))}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className={shared.page}>
      <Typography.Title level={4} className={shared.title}>
        自由批量生图
        <span className={shared.sub}>设计 · 不接灵鉴 · 本页生图与下载</span>
      </Typography.Title>
      <Alert
        className={shared.notice}
        type="info"
        showIcon
        message="使用说明"
        description={
          <div>
            <div>1. 【新建】或表格导入加入 SPU；材质从 SCM 自动带出。颜色、标签在展开行填写。</div>
            <div>
              2. 参考图：<b>图1 商品图（必填）</b>从 SCM 按角度调取，没有该角度则默认展示首图，不可上传；<b>图2 参考图（选填）</b>
              先选标签，再按已配置的图库表单 <b>品类-标签-角度</b> 调取手选或手传；<b>图3 质检图（选填）</b>
              从【商品质检图】配置按角度拉取，有则带出，可替换上传；<b>图4 其他（选填）</b>手传。图2 / 图3 / 图4 都支持手动上传。
            </div>
            <div>
              3. 描述词按 <b>品类 + 角度</b> 分层匹配；色值按 <b>材质 + 颜色</b> 从灵枢【AI颜色图配置】调取，填入描述词对应槽位。
            </div>
            <div>4. 本页生图与下载，不进任务清单 / 审核 / CMS。结果图展示在图1后面。仅【生图失败】可在行内重跑。</div>
            <div>
              5. 【下载本批结果】只打包已成功的结果图：<b>文件夹按 SPU 命名</b>，<b>图片按 SPU+颜色+角度 命名</b>
              （如 SPU-1008630/SPU-1008630_黑色_正面.png）。
            </div>
          </div>
        }
      />

      <Card className={shared.card} size="small" title="加入 SPU" extra={<span>已加入 {cards.length} 个</span>}>
        <Space wrap>
          <AutoComplete
            style={{ width: 320 }}
            options={options}
            value={search}
            onChange={setSearch}
            onSelect={addSpu}
            placeholder="搜索编码 / 名称后回车添加"
          >
            <Input
              onPressEnter={() => addSpu(search)}
              allowClear
            />
          </AutoComplete>
          <Button type="primary" onClick={addBlankRow}>
            新建
          </Button>
          <Button onClick={() => setImportOpen(true)}>表格导入</Button>
          <Button onClick={() => setPasteOpen(true)}>粘贴 SPU</Button>
          {isDesigner ? (
            <>
              <Button onClick={() => setCards((prev) => prev.map((c) => ({ ...c, count: 4 })))}>全部默认 4 张</Button>
              <Input
                style={{ width: 140 }}
                placeholder="统一填颜色"
                value={unifiedColor}
                onChange={(e) => setUnifiedColor(e.target.value)}
              />
              <Button
                onClick={() => {
                  if (!unifiedColor.trim()) {
                    message.warning('请先填写统一颜色');
                    return;
                  }
                  setRows((prev) =>
                    prev.map((r) => {
                      const color = unifiedColor.trim();
                      const master = spus.find((s) => s.spu === r.spu);
                      const p = master
                        ? fillPromptFromSpu(master, r.angle, color, promptTemplates, colorDictionaries)
                        : { text: r.prompt, ver: r.ver };
                      return { ...r, color, prompt: p.text, ver: p.ver, match: matchColor(color, colorDictionaries) };
                    }),
                  );
                }}
              >
                统一填颜色
              </Button>
            </>
          ) : null}
        </Space>
        <Table
          style={{ marginTop: 12 }}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={cards}
          columns={cardCols}
          locale={{ emptyText: '点【新建】加一行，填写 SPU / 个数' }}
        />
      </Card>

      <Card
        className={shared.card}
        size="small"
        title="待创建行（自动展开）"
        extra={<span style={{ color: 'rgba(0,0,0,0.45)' }}>图1 从 SCM 调取，不可上传。图2 先选标签再调库，也可手传。</span>}
      >
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={rows}
          locale={{ emptyText: '加入 SPU 后自动展开' }}
          rowClassName={(r) => (r.error ? shared.rowError : r.match === '未匹配' ? shared.unmatch : '')}
          columns={[
            {
              title: 'SPU',
              width: 130,
              render: (_, r) => (
                <>
                  {r.spu}
                  <div style={{ color: 'rgba(0,0,0,0.45)' }}>第 {r.idx} 张</div>
                </>
              ),
            },
            {
              title: '颜色',
              width: 130,
              render: (_, r) => (
                <AutoComplete
                  style={{ width: 120 }}
                  options={colorOptions}
                  value={r.color}
                  onChange={(color) => patchRow(r.key, { color })}
                  placeholder="必填"
                  filterOption={(input, option) => String(option?.value ?? '').includes(input)}
                />
              ),
            },
            {
              title: '角度',
              width: 110,
              render: (_, r) => (
                <Select
                  value={r.angle}
                  style={{ width: 90 }}
                  options={ANGLES.map((a) => ({ value: a, label: a }))}
                  onChange={(angle) => patchRow(r.key, { angle })}
                />
              ),
            },
            {
              title: '标签',
              width: 140,
              render: (_, r) => (
                <LibraryTagSelect
                  value={r.tag}
                  materials={materials}
                  category={r.category}
                  angle={r.angle}
                  style={{ width: 120 }}
                  onChange={(tag) => patchRow(r.key, { tag })}
                />
              ),
            },
            {
              title: '图1 商品图（必填）',
              width: 160,
              render: (_, r) => (
                <div>
                  <ImagePlaceholder label={r.img1Label} kind={image1Kind(r.img1Source)} size="md" source="商品图" />
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>SCM 商品图</div>
                </div>
              ),
            },
            {
              title: '图2 参考图（选填）',
              width: 200,
              render: (_, r) => (
                <div>
                  <ImagePlaceholder label={r.img2 || '请手动选择'} kind={r.img2 ? 'mat' : ''} size="md" source="参考图" />
                  <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 4 }}>
                    {r.tag ? `图库：${r.category}-${r.tag}-${r.angle}` : '先选标签再调库，或直接上传'}
                  </div>
                  <MaterialPicker
                    value={isUploadedSlot(r.img2) ? undefined : r.img2}
                    materials={materials}
                    category={r.category}
                    crowdTag={r.tag}
                    angle={r.angle}
                    emptyLabel="从参考图库选择"
                    onChange={(img2) => patchRow(r.key, { img2 })}
                    style={{ marginTop: 8, width: '100%' }}
                  />
                  <Upload
                    showUploadList={false}
                    beforeUpload={() => {
                      patchRow(r.key, { img2: `已上传参考图·${r.angle}` });
                      message.success('已上传参考图（演示）');
                      return false;
                    }}
                  >
                    <Button type="link" size="small">
                      上传/替换
                    </Button>
                  </Upload>
                </div>
              ),
            },
            {
              title: '图3 质检图（选填）',
              width: 160,
              render: (_, r) => (
                <div>
                  <ImagePlaceholder
                    label={r.img3Label || '无质检图'}
                    kind={r.img3Label ? 'qc' : ''}
                    size="md"
                    source={r.img3Label ? '质检图' : undefined}
                  />
                  <Upload
                    showUploadList={false}
                    beforeUpload={() => {
                      patchRow(r.key, { img3Source: '质检图', img3Label: `已上传质检图·${r.angle}` });
                      return false;
                    }}
                  >
                    <Button type="link" size="small">
                      上传/替换
                    </Button>
                  </Upload>
                </div>
              ),
            },
            {
              title: '图4 其他（选填）',
              width: 150,
              render: (_, r) => (
                <div>
                  <ImagePlaceholder label={r.img4Label || '选填'} kind={r.img4Label ? 'mat' : ''} size="md" source={r.img4Label ? '其他' : undefined} />
                  <Upload
                    showUploadList={false}
                    beforeUpload={() => {
                      patchRow(r.key, { img4Label: `其他·${r.angle}` });
                      return false;
                    }}
                  >
                    <Button type="link" size="small">
                      上传
                    </Button>
                  </Upload>
                </div>
              ),
            },
            {
              title: '描述词',
              width: 260,
              render: (_, r) => (
                <div>
                  <div style={{ color: 'rgba(0,0,0,0.45)' }}>
                    模板 {r.ver}{' '}
                    <Button type="link" size="small" onClick={() => patchRow(r.key, { promptOpen: !r.promptOpen })}>
                      {r.promptOpen ? '收起' : '展开编辑'}
                    </Button>
                  </div>
                  {r.promptOpen ? (
                    <Input.TextArea rows={4} value={r.prompt} onChange={(e) => patchRow(r.key, { prompt: e.target.value })} />
                  ) : null}
                  {r.match === '未匹配' ? (
                    <Button
                      size="small"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        const hex = colorHex(r.color, colorDictionaries) || '#CCCCCC';
                        store.addColor({
                          id: `CLR-${Date.now()}`,
                          name: r.color,
                          aliases: [],
                          hex,
                          description: '自由批量页存入',
                        });
                        message.success(`已将颜色「${r.color}」存入词典`);
                      }}
                    >
                      存入词典
                    </Button>
                  ) : null}
                </div>
              ),
            },
            { title: '色值匹配', width: 140, render: (_, r) => <StatusTag value={colorMatchDisplay(r.match, r.prompt)} /> },
          ]}
        />
        <div className={shared.toolbar} style={{ marginTop: 12 }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>图1、颜色、描述词必填。图2 选库需先选标签，也可手传；图3/图4 可手传。</span>
          {isDesigner ? (
            <Button type="primary" onClick={create} disabled={!rows.length}>
              批量创建
            </Button>
          ) : null}
        </div>
      </Card>

      <Card
        className={shared.card}
        size="small"
        title="本批次结果"
        extra={
          <Space>
            {freeBatches.slice(0, 8).map((b) => (
              <Tag
                key={b.id}
                color={b.id === activeBatchId ? 'blue' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveBatchId(b.id)}
              >
                {b.id}
              </Tag>
            ))}
            {isDesigner ? (
              <Button type="primary" disabled={!readyCount} loading={downloading} onClick={downloadReady}>
                下载本批结果
              </Button>
            ) : null}
          </Space>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          dataSource={batchSubs}
          locale={{ emptyText: '创建后在此查看本批结果；历史批次点上方标签切换' }}
          columns={[
            { title: '子任务', dataIndex: 'id', render: (id: string) => <Link to={`/buyer-show/subtask/${id}`}>{id}</Link> },
            { title: 'SPU', dataIndex: 'spu' },
            { title: '颜色', dataIndex: 'color' },
            { title: '角度', dataIndex: 'angle' },
            {
              title: '图1 商品图',
              width: 140,
              render: (_, s) => (
                <ImagePlaceholder
                  label={s.image1.url || '图1'}
                  kind={image1Kind(s.image1.source)}
                  size="md"
                  source="商品图"
                />
              ),
            },
            {
              title: '结果图',
              width: 140,
              render: (_, s) =>
                s.currentResultUrl ? (
                  <ImagePlaceholder label={`结果·${s.angle}`} kind="result" size="md" source="nano banana" />
                ) : s.status === '生图中' ? (
                  <span style={{ color: 'rgba(0,0,0,0.45)' }}>生图中</span>
                ) : (
                  '—'
                ),
            },
            { title: '状态', dataIndex: 'status', render: (v: string) => <StatusTag value={v} /> },
            { title: '生成次数', dataIndex: 'generateCount' },
            {
              title: '操作',
              render: (_, s) =>
                isDesigner ? (
                  <Space>
                    <Link to={`/buyer-show/subtask/${s.id}`}>详情</Link>
                    {s.status === '生图失败' ? (
                      <Button type="link" size="small" onClick={() => rerunOne(s.id)}>
                        重新生成
                      </Button>
                    ) : null}
                  </Space>
                ) : (
                  <Link to={`/buyer-show/subtask/${s.id}`}>查看</Link>
                ),
            },
          ]}
        />
      </Card>

      <Card size="small" className={shared.card} title="近 7 天批次">
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={freeBatches}
          locale={{ emptyText: '暂无批次' }}
          columns={[
            { title: '批次', dataIndex: 'id' },
            { title: '时间', dataIndex: 'createdAt' },
            { title: '制作人', dataIndex: 'operator' },
            { title: 'SPU 数', render: (_, b) => b.spus.length },
            { title: '张数', dataIndex: 'imageCount' },
            {
              title: '操作',
              render: (_, b) => (
                <Button
                  type="link"
                  size="small"
                  onClick={() => setActiveBatchId(b.id)}
                >
                  查看结果
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="表格导入（SPU / 个数）"
        open={importOpen}
        width={640}
        onCancel={() => setImportOpen(false)}
        onOk={() => {
          if (applyImportText(importText)) setImportOpen(false);
        }}
        okText="导入"
      >
        <p style={{ color: 'rgba(0,0,0,0.45)', marginTop: 0 }}>
          表头：<b>SPU,个数</b>。个数空则默认 4。材质从 SCM 自动带出；颜色和标签在展开行选择。Excel 另存为 CSV 后上传，或直接粘贴。
        </p>
        <Space style={{ marginBottom: 8 }}>
          <Button onClick={downloadTemplate}>下载模板</Button>
          <Upload
            accept=".csv,.txt,.tsv"
            showUploadList={false}
            beforeUpload={(file) => {
              const reader = new FileReader();
              reader.onload = () => setImportText(String(reader.result ?? ''));
              reader.readAsText(file);
              return false;
            }}
          >
            <Button>上传 CSV</Button>
          </Upload>
        </Space>
        <Input.TextArea rows={8} value={importText} onChange={(e) => setImportText(e.target.value)} />
      </Modal>
      <Modal
        title="粘贴 SPU"
        open={pasteOpen}
        onCancel={() => setPasteOpen(false)}
        onOk={() => {
          const tokens = parseSpuTokens(pasteText);
          if (!tokens.length) {
            message.warning('没有可识别的 SPU');
            return;
          }
          addMany(tokens);
          setPasteText('');
          setPasteOpen(false);
        }}
      >
        <Input.TextArea
          rows={6}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={'换行、逗号或空格分隔，例如：\nSPU-1008640\nSPU-1008611'}
        />
      </Modal>
    </div>
  );
}
