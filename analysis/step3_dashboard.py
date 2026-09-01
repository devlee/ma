# -*- coding: utf-8 -*-
"""步骤3:生成单文件HTML诊断面板(数据从主表实时计算, 图表base64内嵌)。"""
import base64
import pandas as pd

OUT = '/workspace/analysis/output/'
m = pd.read_parquet('/workspace/analysis/master_spu.parquet')

# 与 step2 相同的等级划分
sold = m[m['销量件数'] > 0].sort_values('销量件数', ascending=False).copy()
sold['cum'] = sold['销量件数'].cumsum() / sold['销量件数'].sum()
sold['等级'] = sold['cum'].apply(lambda c: 'S' if c <= .5 else 'A' if c <= .8 else 'B' if c <= .95 else 'C')
m = m.merge(sold[['SPU', '等级']], on='SPU', how='left')
m['等级'] = m['等级'].fillna('D')

total_qty = int(m['销量件数'].sum())
total_gmv = m['GMV_产品表'].sum()
onshelf = m[m['在架']]
rate_onshelf = (onshelf['销量件数'] > 0).mean()
refund_rate = m['退款件数'].sum() / total_qty
sa = m[m['等级'].isin(['S', 'A'])]
dead_old = m[(m['在架']) & (m['销量件数'] == 0) & (m['新品90天'] != True)]
new = m[m['新品90天'] == True]
new_rate = (new['销量件数'] > 0).mean()
cr10 = sold['销量件数'].head(10).sum() / total_qty

def png64(name):
    with open(OUT + name, 'rb') as f:
        return base64.b64encode(f.read()).decode()

sub = m.groupby('子品类').apply(lambda g: pd.Series({
    '在架': int(g['在架'].sum()),
    '动销率': g[g['在架']]['销量件数'].gt(0).mean(),
    '销量': int(g['销量件数'].sum()),
    'GMV': g['GMV_产品表'].sum(),
    'S款': int((g['等级'] == 'S').sum()),
    '退款率': g['退款件数'].sum() / max(g['销量件数'].sum(), 1),
}), include_groups=False).sort_values('销量', ascending=False)

rows = ''
max_qty = sub['销量'].max()
for name, r in sub.iterrows():
    dr = r['动销率'] * 100
    color = '#e74c3c' if dr < 30 else '#f39c12' if dr < 55 else '#27ae60'
    rows += f'''<tr><td class="subname">{name}</td>
<td><div class="barwrap"><div class="bar" style="width:{r['销量']/max_qty*100:.0f}%"></div><span>{int(r['销量']):,}</span></div></td>
<td>${r['GMV']/10000:.0f}万</td><td>{int(r['在架'])}</td>
<td><span class="pill" style="background:{color}">{dr:.0f}%</span></td>
<td>{int(r['S款'])}</td><td>{r['退款率']:.1%}</td></tr>'''

html = f'''<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>衣服品类诊断面板 · 2026年8月</title><style>
*{{margin:0;box-sizing:border-box;font-family:'PingFang SC','Microsoft YaHei','WenQuanYi Micro Hei',sans-serif}}
body{{background:#0f1420;color:#e8ecf4;padding:28px 32px;max-width:1440px;margin:0 auto}}
h1{{font-size:22px;font-weight:700}} .sub{{color:#8b95a8;font-size:13px;margin:6px 0 22px}}
.grid{{display:grid;gap:14px}} .kpis{{grid-template-columns:repeat(6,1fr);margin-bottom:14px}}
.card{{background:#1a2233;border:1px solid #263048;border-radius:12px;padding:16px 18px}}
.kpi .v{{font-size:26px;font-weight:700;margin:4px 0}} .kpi .l{{font-size:12px;color:#8b95a8}}
.kpi .d{{font-size:11.5px;color:#5d6b85;margin-top:2px}}
.two{{grid-template-columns:1.15fr .85fr;margin-bottom:14px}}
h2{{font-size:14px;color:#aeb8cc;margin-bottom:12px;letter-spacing:.5px}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{text-align:left;color:#6b7690;font-weight:500;padding:6px 8px;border-bottom:1px solid #263048;font-size:12px}}
td{{padding:7px 8px;border-bottom:1px solid #1f2940}} tr:last-child td{{border-bottom:none}}
.subname{{white-space:nowrap;font-weight:600}}
.barwrap{{position:relative;background:#141b2b;border-radius:4px;height:20px;min-width:150px}}
.bar{{background:linear-gradient(90deg,#2980b9,#3fa7e0);height:100%;border-radius:4px}}
.barwrap span{{position:absolute;left:8px;top:2px;font-size:11.5px}}
.pill{{padding:2px 9px;border-radius:10px;font-size:12px;color:#fff;font-weight:600}}
.tag{{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;margin-right:8px}}
.p0{{background:#e74c3c}} .p1{{background:#e67e22}} .p2{{background:#2980b9}} .ok{{background:#27ae60}}
.conc li{{list-style:none;padding:9px 0;border-bottom:1px solid #1f2940;font-size:13.5px;line-height:1.55}}
.conc li:last-child{{border-bottom:none}}
.tierbar{{display:flex;height:34px;border-radius:8px;overflow:hidden;margin:10px 0 6px}}
.tierbar div{{display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:#fff}}
.legend{{font-size:11.5px;color:#8b95a8;display:flex;gap:14px;flex-wrap:wrap}}
.charts{{grid-template-columns:1fr 1fr}} .charts img{{width:100%;border-radius:8px;background:#fff}}
.note{{color:#5d6b85;font-size:11.5px;margin-top:18px;line-height:1.7}}
b.hl{{color:#ffd166}}
</style></head><body>
<h1>衣服品类产品等级与健康度诊断面板</h1>
<div class="sub">统计窗口 2026-08-01 ~ 08-31 · 9 个子品类(swd/sbd/smbd/sed/scd/spd/shd/sfgd/sjbd) · 销量含退款单(与产品表口径一致, 欺诈单剔除) · 等级=帕累托 50/80/95% 分档</div>

<div class="grid kpis">
<div class="card kpi"><div class="l">SPU 总数 / 在架</div><div class="v">{len(m):,} / {len(onshelf):,}</div><div class="d">下架 {len(m)-len(onshelf):,}</div></div>
<div class="card kpi"><div class="l">8月销量 / GMV</div><div class="v">{total_qty:,} 件</div><div class="d">${total_gmv/10000:,.0f} 万美金</div></div>
<div class="card kpi"><div class="l">在架动销率</div><div class="v">{rate_onshelf:.1%}</div><div class="d">动销 SPU {len(sold):,} 个</div></div>
<div class="card kpi"><div class="l">S+A 款贡献</div><div class="v">80% 销量</div><div class="d">仅 {len(sa):,} 款 · 占 SPU {len(sa)/len(m):.1%}</div></div>
<div class="card kpi"><div class="l">CR10 (爆款依赖)</div><div class="v">{cr10:.1%}</div><div class="d">无单一爆款依赖 · 头部偏平</div></div>
<div class="card kpi"><div class="l">整体退款率</div><div class="v">{refund_rate:.1%}</div><div class="d">件数口径 · 婚纱最高 4.6%</div></div>
</div>

<div class="grid two">
<div class="card"><h2>关键结论与行动优先级</h2><ul class="conc">
<li><span class="tag ok">健康</span>帕累托结构正常:<b class="hl">7.4% 的款贡献 80% 销量</b>;CR10 仅 6.9%,无爆款依赖风险;新品供血正常(90天内产出 15 个 S 款 + 51 个 A 款)。</li>
<li><span class="tag p0">P0</span><b class="hl">返校节裙 HOCO 全面疲软</b>:正值 8–10 月销售季,在架动销率仅 19%(398 款只卖 178 件),新品动销率也仅 21%——非老款拖累,需排查流量入口、选款与价格竞争力。</li>
<li><span class="tag p1">P1</span><b class="hl">在架零动销老品 {len(dead_old):,} 款</b>(上架>90天,占在架 {len(dead_old)/len(onshelf):.0%}),最大库存健康负担;先清 HOCO(321款)与 PROM(346款)。</li>
<li><span class="tag p1">P1</span>头部偏平、缺超级爆款:单款最高月销 292 件仅占 1%;建议对 Top 款(SBD10628 / SMBD11937 / SMBD12560)做流量加码,探索单款放量上限。</li>
<li><span class="tag p1">P1</span>新品约 <b class="hl">60 天定型</b>(动销率 32.7%→43.1%→45.1%):上架满 60 天仍零动销的新品即可纳入去留评估,不必等 90 天。</li>
<li><span class="tag p2">P2</span>妈妈装/伴娘裙为现金牛,扩上新配额;复查 $100–120 价格带(动销率最低 22.8%);关注婚纱 4.6% 退款率成因(尺码/预期差)。</li>
</ul></div>

<div class="card"><h2>产品等级结构(款数 → 销量占比)</h2>
<div class="tierbar">
<div style="background:#c0392b;width:18%">S 1.8%</div>
<div style="background:#e67e22;width:16%">A 5.6%</div>
<div style="background:#b8860b;width:14%">B 9.3%</div>
<div style="background:#5d6b85;width:12%">C 8.6%</div>
<div style="background:#2c3850;width:40%">D 零动销 74.8%</div>
</div>
<div class="legend"><span>■ 款数占比(上条, 示意宽度)</span></div>
<div class="tierbar">
<div style="background:#c0392b;width:49.9%">S 49.9%</div>
<div style="background:#e67e22;width:30.1%">A 30.1%</div>
<div style="background:#b8860b;width:15%">B 15%</div>
<div style="background:#5d6b85;width:5%">C 5%</div>
</div>
<div class="legend"><span>■ 销量占比(下条)</span></div>
<table style="margin-top:12px"><tr><th>等级</th><th>款数</th><th>款均月销</th><th>月销区间</th></tr>
<tr><td>S 爆款</td><td>287</td><td>50.8</td><td>21–292 件</td></tr>
<tr><td>A 旺款</td><td>893</td><td>9.8</td><td>5–21</td></tr>
<tr><td>B 平款</td><td>1,486</td><td>3.0</td><td>2–5</td></tr>
<tr><td>C 微销款</td><td>1,375</td><td>1.1</td><td>1–2</td></tr>
<tr><td>D 零动销</td><td>11,991</td><td>0</td><td>—</td></tr></table>
</div>
</div>

<div class="card" style="margin-bottom:14px"><h2>子品类健康度一览</h2>
<table><tr><th>子品类</th><th>8月销量(件)</th><th>GMV</th><th>在架SPU</th><th>在架动销率</th><th>S款数</th><th>退款率</th></tr>
{rows}</table></div>

<div class="grid charts">
<div class="card"><h2>帕累托曲线</h2><img src="data:image/png;base64,{png64('pareto_curve.png')}"></div>
<div class="card"><h2>子品类销量与动销率</h2><img src="data:image/png;base64,{png64('subcategory_health.png')}"></div>
<div class="card"><h2>等级结构</h2><img src="data:image/png;base64,{png64('tier_structure.png')}"></div>
<div class="card"><h2>动销款等级构成 × 价格带</h2><img src="data:image/png;base64,{png64('tier_by_subcat_price.png')}"></div>
</div>

<div class="note">口径:销量=已成交子订单件数(含退款单,剔除欺诈/空状态/支付信息行/边界重复);GMV=产品表"产品收入"(美金);新品=上架≤90天;动销率分母=在架SPU。
局限:单月窗口,PROM/HOCO 等季节性子类需旺季数据复核。数据来源:订单表(3切片合并) + 产品表(2026-08)。明细见《衣服品类等级分析_2026年8月.xlsx》。</div>
</body></html>'''

with open(OUT + '品类诊断面板_2026年8月.html', 'w') as f:
    f.write(html)
print('面板已生成:', OUT + '品类诊断面板_2026年8月.html', f'({len(html)/1024:.0f} KB)')
