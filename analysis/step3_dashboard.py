# -*- coding: utf-8 -*-
"""步骤3:生成单文件HTML诊断面板(数据从主表实时计算, 图表base64内嵌)。"""
import base64
import pandas as pd

OUT = '/workspace/analysis/output/'
m = pd.read_parquet('/workspace/analysis/master_spu.parquet')

# 业务等级标准: 月销量绝对阈值, 区间不含前含后
def tier_of(qty):
    if qty > 100: return 'S'
    if qty > 50: return 'A'
    if qty > 30: return 'B'
    if qty > 20: return 'C'
    if qty > 10: return 'D'
    if qty > 0: return 'E'
    return 'F'

TIERS = ['S', 'A', 'B', 'C', 'D', 'E', 'F']
TIER_RANGE = {'S': '>100件', 'A': '50-100]', 'B': '30-50]', 'C': '20-30]', 'D': '10-20]', 'E': '0-10]', 'F': '0'}
m['等级'] = m['销量件数'].apply(tier_of)
sold = m[m['销量件数'] > 0].sort_values('销量件数', ascending=False)

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

tier_stats = m.groupby('等级').agg(款数=('SPU', 'count'), 销量=('销量件数', 'sum')).reindex(TIERS)
tier_stats['销量占比'] = tier_stats['销量'] / total_qty
TIER_COLORS = {'S': '#c0392b', 'A': '#e67e22', 'B': '#f39c12', 'C': '#b8860b', 'D': '#3d7ea6', 'E': '#5d6b85', 'F': '#2c3850'}
# 等级构成条(款数条只看动销款, 销量条含全部)
sold_total = len(sold)
bar_cnt = ''.join(
    f'<div style="background:{TIER_COLORS[t]};width:{max(tier_stats.loc[t,"款数"]/sold_total*100,3):.1f}%">{t} {tier_stats.loc[t,"款数"]}</div>'
    for t in TIERS[:-1])
bar_qty = ''.join(
    f'<div style="background:{TIER_COLORS[t]};width:{max(tier_stats.loc[t,"销量占比"]*100,3):.1f}%">{t} {tier_stats.loc[t,"销量占比"]:.0%}</div>'
    for t in TIERS[:-1])
tier_rows = ''
for t in TIERS:
    r = tier_stats.loc[t]
    avg = r['销量'] / r['款数'] if r['款数'] else 0
    tier_rows += f'<tr><td><b style="color:{TIER_COLORS[t]}">{t}</b>({TIER_RANGE[t]})</td><td>{int(r["款数"]):,}</td><td>{int(r["销量"]):,}</td><td>{r["销量占比"]:.1%}</td><td>{avg:.1f}</td></tr>'
    if t == 'E':
        for sub_name, seg in [('E1(5-10]', m[(m['等级'] == 'E') & (m['销量件数'] > 5)]),
                              ('E2(0-5]', m[(m['等级'] == 'E') & (m['销量件数'] <= 5)])]:
            tier_rows += (f'<tr style="color:#8b95a8"><td style="padding-left:26px">└ {sub_name}</td>'
                          f'<td>{len(seg):,}</td><td>{int(seg["销量件数"].sum()):,}</td>'
                          f'<td>{seg["销量件数"].sum()/total_qty:.1%}</td><td>{seg["销量件数"].mean():.1f}</td></tr>')

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
<div class="sub">统计窗口 2026-08-01 ~ 08-31 · 9 个子品类(swd/sbd/smbd/sed/scd/spd/shd/sfgd/sjbd) · 销量含退款单(与产品表口径一致, 欺诈单剔除) · 等级=月销量绝对阈值(不含前含后): S>100 / A(50,100] / B(30,50] / C(20,30] / D(10,20] / E(0,10] / F=0</div>

<div class="grid kpis">
<div class="card kpi"><div class="l">SPU 总数 / 在架</div><div class="v">{len(m):,} / {len(onshelf):,}</div><div class="d">下架 {len(m)-len(onshelf):,}</div></div>
<div class="card kpi"><div class="l">8月销量 / GMV</div><div class="v">{total_qty:,} 件</div><div class="d">${total_gmv/10000:,.0f} 万美金</div></div>
<div class="card kpi"><div class="l">在架动销率</div><div class="v">{rate_onshelf:.1%}</div><div class="d">动销 SPU {len(sold):,} 个</div></div>
<div class="card kpi"><div class="l">S级爆款(月销>100)</div><div class="v">{int(tier_stats.loc['S','款数'])} 款</div><div class="d">S+A 共 {len(sa):,} 款 · 贡献销量 {sa['销量件数'].sum()/total_qty:.1%}</div></div>
<div class="card kpi"><div class="l">CR10 (爆款依赖)</div><div class="v">{cr10:.1%}</div><div class="d">无单一爆款依赖 · 头部偏平</div></div>
<div class="card kpi"><div class="l">整体退款率</div><div class="v">{refund_rate:.1%}</div><div class="d">件数口径 · 婚纱最高 4.6%</div></div>
</div>

<div class="grid two">
<div class="card"><h2>关键结论与行动优先级</h2><ul class="conc">
<li><span class="tag p0">P0</span><b class="hl">头部严重偏薄</b>:按业务标准 S 级爆款仅 {int(tier_stats.loc['S','款数'])} 款、S+A 合计 {len(sa)} 款只贡献 {sa['销量件数'].sum()/total_qty:.0%} 销量;而 E 级(月销≤10)有 {int(tier_stats.loc['E','款数']):,} 款、贡献 {tier_stats.loc['E','销量占比']:.0%} 销量——生意靠长尾微销款堆出来,亟需造爆款:对 Top 款(SBD10628 / SMBD11937 / SMBD12560)与 88 款月销≥50 的成熟款做流量加码。</li>
<li><span class="tag p0">P0</span><b class="hl">返校节裙 HOCO 全面疲软</b>:正值 8–10 月销售季,在架动销率仅 19%(398 款只卖 178 件),新品动销率也仅 21%——非老款拖累,需排查流量入口、选款与价格竞争力。</li>
<li><span class="tag p1">P1</span><b class="hl">在架零动销老品 {len(dead_old):,} 款</b>(上架>90天,占在架 {len(dead_old)/len(onshelf):.0%}),最大库存健康负担;先清 HOCO(321款)与 PROM(346款)。</li>
<li><span class="tag p1">P1</span>新品约 <b class="hl">60 天定型</b>(动销率 32.7%→43.1%→45.1%),但 90 天内新品尚无一款达到 S 级(最高 SWD13339 月销 75 件)——上新"有命中、无爆款",对 38 款潜力新款重点扶持。</li>
<li><span class="tag p1">P1</span><b class="hl">E级提升靠素材分层运营</b>:E1(月销5-10)502款中 421 款素材就绪(R≥10)可直接推流量;E2(0-5)中 336 款素材好却卖不动待诊断;709 款有销量缺素材(R&lt;10)先种草再推。素材阶梯:零Review动销率 21% vs R≥50 达 97%。</li>
<li><span class="tag p2">P2</span>妈妈装/伴娘裙为现金牛(合计 52.8% 销量),扩上新配额;复查 $100–120 价格带(动销率最低 22.8%);关注婚纱 4.6% 退款率成因(尺码/预期差)。</li>
<li><span class="tag ok">健康</span>CR10 仅 6.9%,无单一爆款依赖风险;整体退款率 3.5% 可控;新品动销率随上架时长正常爬坡。</li>
</ul></div>

<div class="card"><h2>产品等级结构(业务标准)</h2>
<div class="tierbar">{bar_cnt}</div>
<div class="legend"><span>■ 动销款款数构成(上条, 共 {sold_total:,} 款, 宽度=占比)</span></div>
<div class="tierbar">{bar_qty}</div>
<div class="legend"><span>■ 销量占比(下条)</span></div>
<table style="margin-top:12px"><tr><th>等级(月销区间)</th><th>款数</th><th>销量</th><th>销量占比</th><th>款均月销</th></tr>
{tier_rows}</table>
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
<div class="card"><h2>素材阶梯 × E级素材矩阵</h2><img src="data:image/png;base64,{png64('e_tier_material.png')}"></div>
<div class="card"><h2>上新批次效果</h2><img src="data:image/png;base64,{png64('cohort_newproduct.png')}"></div>
</div>

<div class="note">口径:销量=已成交子订单件数(含退款单,剔除欺诈/空状态/支付信息行/边界重复);GMV=产品表"产品收入"(美金);新品=上架≤90天;动销率分母=在架SPU。
局限:单月窗口,PROM/HOCO 等季节性子类需旺季数据复核。数据来源:订单表(3切片合并) + 产品表(2026-08)。明细见《衣服品类等级分析_2026年8月.xlsx》。</div>
</body></html>'''

with open(OUT + '品类诊断面板_2026年8月.html', 'w') as f:
    f.write(html)
print('面板已生成:', OUT + '品类诊断面板_2026年8月.html', f'({len(html)/1024:.0f} KB)')
