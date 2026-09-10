import type { Subtask } from '@/types/buyer-show';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function safeName(value: string) {
  return (value || '未命名').replace(/[\\/:*?"<>|]/g, '-').trim() || '未命名';
}

export function resultImageFileName(spu: string, color: string, angle: string) {
  return `${safeName(spu)}_${safeName(color)}_${safeName(angle)}.png`;
}

export function resultZipEntryPath(spu: string, color: string, angle: string) {
  return `${safeName(spu)}/${resultImageFileName(spu, color, angle)}`;
}

function uniquePath(used: Set<string>, path: string) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const ext = path.endsWith('.png') ? '.png' : '';
  const base = ext ? path.slice(0, -4) : path;
  let i = 2;
  let next = `${base}_${i}${ext}`;
  while (used.has(next)) {
    i += 1;
    next = `${base}_${i}${ext}`;
  }
  used.add(next);
  return next;
}

function u16(n: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}

function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((c) => {
    out.set(c, offset);
    offset += c.length;
  });
  return out;
}

export function buildZip(files: { path: string; data: Uint8Array }[]) {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = new TextEncoder().encode(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ]);
    locals.push(local);
    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(size),
        u32(size),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local.length;
  });

  const central = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ]);
  return new Blob([concat([...locals, central, eocd])], { type: 'application/zip' });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function renderResultPng(sub: Pick<Subtask, 'spu' | 'color' | 'angle' | 'currentResultUrl'>) {
  const url = sub.currentResultUrl ?? '';
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('结果图下载失败');
    return new Uint8Array(await res.arrayBuffer());
  }

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法生成结果图');
  ctx.fillStyle = '#dff5e4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#95de64';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#237804';
  ctx.textAlign = 'center';
  ctx.font = '28px sans-serif';
  ctx.fillText('nano banana 结果图', 300, 280);
  ctx.font = '32px sans-serif';
  ctx.fillText(sub.spu, 300, 360);
  ctx.font = '26px sans-serif';
  ctx.fillText(`${sub.color} · ${sub.angle}`, 300, 420);
  if (url) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#389e0d';
    ctx.fillText(url, 300, 480);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error('无法导出 PNG'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function downloadFreeBatchResults(subs: Subtask[], zipName: string) {
  const used = new Set<string>();
  const files: { path: string; data: Uint8Array }[] = [];
  for (const sub of subs) {
    const path = uniquePath(used, resultZipEntryPath(sub.spu, sub.color, sub.angle));
    files.push({ path, data: await renderResultPng(sub) });
  }
  triggerDownload(buildZip(files), zipName);
}

export async function downloadOneResult(sub: Subtask) {
  const data = await renderResultPng(sub);
  triggerDownload(new Blob([data], { type: 'image/png' }), resultImageFileName(sub.spu, sub.color, sub.angle));
}
