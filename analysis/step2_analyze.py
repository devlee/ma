# -*- coding: utf-8 -*-
"""步骤2:产品等级划分(帕累托) + 品类健康度诊断 + 图表与Excel输出。"""
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei']
plt.rcParams['axes.unicode_minus'] = False

OUT = '/workspace/analysis/output/'
ART = '/opt/cursor/artifacts/'
import os
os.makedirs(OUT, exist_ok=True)
os.makedirs(ART, exist_ok=True)

m = pd.read_parquet('/workspace/analysis/master_spu.parquet')

# ---------- 1. 帕累托等级划分 ----------
sold = m[m['销量件数'] > 0].sort_values('销量件数', ascending=False).copy()
sold['累计占比'] = sold['销量件数'].cumsum() / sold['销量件数'].sum()


def tier_of(cum):
    if cum <= 0.50:
        return 'S 爆款'
    if cum <= 0.80:
        return 'A 旺款'
    if cum <= 0.95:
        return 'B 平款'
    return 'C 微销款'


sold['等级'] = sold['累计占比'].apply(tier_of)
m = m.merge(sold[['SPU', '等级', '累计占比']], on='SPU', how='left')
m['等级'] = m['等级'].fillna('D 零动销')
TIERS = ['S 爆款', 'A 旺款', 'B 平款', 'C 微销款', 'D 零动销']
m['等级'] = pd.Categorical(m['等级'], TIERS, ordered=True)

total_qty = m['销量件数'].sum()
total_gmv = m['GMV_产品表'].sum()

# ---------- 2. 等级结构汇总 ----------
tier_sum = m.groupby('等级', observed=True).agg(
    SPU数=('SPU', 'count'),
    在架SPU数=('在架', 'sum'),
    销量件数=('销量件数', 'sum'),
    GMV美金=('GMV_产品表', 'sum'),
).reset_index()
tier_sum['SPU数占比'] = tier_sum['SPU数'] / tier_sum['SPU数'].sum()
tier_sum['销量占比'] = tier_sum['销量件数'] / total_qty
tier_sum['GMV占比'] = tier_sum['GMV美金'] / total_gmv
tier_sum['款均月销'] = (tier_sum['销量件数'] / tier_sum['SPU数']).round(1)
print('=== 等级结构 ===')
print(tier_sum.to_string(index=False))

# 各等级销量阈值
th = m[m['销量件数'] > 0].groupby('等级', observed=True)['销量件数'].agg(['min', 'max'])
print('\n各等级月销量区间:')
print(th.to_string())

# ---------- 3. 集中度 ----------
q = sold['销量件数'].values
cr = lambda n: q[:n].sum() / total_qty
n_sold = len(sold)
top1pct = max(1, int(np.ceil(n_sold * 0.01)))
conc = {
    'CR5(Top5销量占比)': cr(5), 'CR10': cr(10), 'CR20': cr(20), 'CR50': cr(50),
    'Top1%动销SPU销量占比': q[:top1pct].sum() / total_qty,
    '动销SPU数': n_sold, '总SPU数': len(m), '在架SPU数': int(m['在架'].sum()),
    '总销量件数': int(total_qty), '总GMV美金': round(float(total_gmv), 0),
}
lorenz = np.concatenate([[0], np.cumsum(np.sort(q)) / q.sum()])
gini = 1 - 2 * np.trapezoid(lorenz, dx=1 / n_sold)
conc['基尼系数(动销SPU内)'] = round(float(gini), 3)
print('\n=== 集中度 ===')
for k, v in conc.items():
    print(f'{k}: {v:.2%}' if isinstance(v, float) and v <= 1 and '基尼' not in k else f'{k}: {v}')

# ---------- 4. 子品类健康度 ----------
def health(g):
    onshelf = g[g['在架']]
    sold_g = g[g['销量件数'] > 0]
    return pd.Series({
        'SPU总数': len(g),
        '在架SPU': len(onshelf),
        '动销SPU': len(sold_g),
        '在架动销率': (onshelf['销量件数'] > 0).mean() if len(onshelf) else np.nan,
        '销量件数': g['销量件数'].sum(),
        '销量占比': g['销量件数'].sum() / total_qty,
        'GMV美金': g['GMV_产品表'].sum(),
        'S款数': (g['等级'] == 'S 爆款').sum(),
        'A款数': (g['等级'] == 'A 旺款').sum(),
        '在架零动销数': ((g['在架']) & (g['销量件数'] == 0)).sum(),
        'CR5内部': sold_g['销量件数'].nlargest(5).sum() / max(sold_g['销量件数'].sum(), 1),
        '动销款均月销': sold_g['销量件数'].mean() if len(sold_g) else 0,
        '退款率': g['退款件数'].sum() / max(g['销量件数'].sum(), 1),
        '均价美金': g.loc[g['产品单价'] > 0, '产品单价'].median(),
    })

sub = m.groupby('子品类').apply(health, include_groups=False).sort_values('销量件数', ascending=False)
print('\n=== 子品类健康度 ===')
print(sub.to_string())

# ---------- 5. 新品分析(90天口径, 按上架龄段拆分) ----------
new = m[m['新品90天'] == True].copy()
old_onshelf_dead = m[(m['在架']) & (m['销量件数'] == 0) & (m['新品90天'] != True)]


def new_bucket_stats(g):
    sold_g = g[g['销量件数'] > 0]
    return pd.Series({
        'SPU数': len(g),
        '在架数': g['在架'].sum(),
        '动销数': len(sold_g),
        '动销率': (g['销量件数'] > 0).mean() if len(g) else np.nan,
        '销量合计': g['销量件数'].sum(),
        '动销款均月销': sold_g['销量件数'].mean() if len(sold_g) else 0,
        'S款数': (g['等级'] == 'S 爆款').sum(),
        'A款数': (g['等级'] == 'A 旺款').sum(),
    })


new_sum = new.groupby('新品龄段', observed=True).apply(new_bucket_stats, include_groups=False)
new_sum.loc['新品合计(≤90天)'] = new_bucket_stats(new)
print('\n=== 新品分龄段(上架≤90天) ===')
print(new_sum.to_string())
print(f"\n在架且上架>90天的零动销老品: {len(old_onshelf_dead)}")
# 新品 × 子品类动销率
new_sub = new.groupby('子品类').apply(new_bucket_stats, include_groups=False).sort_values('SPU数', ascending=False)
print('\n=== 新品(≤90天) × 子品类 ===')
print(new_sub.to_string())

# ---------- 6. 价格带 ----------
bins = [0, 50, 80, 100, 120, 150, 200, 300, 10000]
labels = ['<50', '50-80', '80-100', '100-120', '120-150', '150-200', '200-300', '300+']
mp = m[m['产品单价'] > 0].copy()
mp['价格带'] = pd.cut(mp['产品单价'], bins, labels=labels)
price = mp.groupby('价格带', observed=True).agg(
    SPU数=('SPU', 'count'), 在架SPU=('在架', 'sum'), 销量件数=('销量件数', 'sum'), GMV美金=('GMV_产品表', 'sum'))
price['动销率_全部'] = mp.groupby('价格带', observed=True).apply(lambda g: (g['销量件数'] > 0).mean(), include_groups=False)
print('\n=== 价格带(美金) ===')
print(price.to_string())

# ---------- 7. Top20 爆款 ----------
top20 = sold.head(20)[['SPU', '子品类', '销量件数', 'GMV_产品表', '产品单价', '上架日期', '产品状态', 'Reviews数']].copy()
top20['销量占比'] = top20['销量件数'] / total_qty
print('\n=== Top20 爆款 ===')
print(top20.to_string(index=False))

# ---------- 图表 ----------
def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT + name, dpi=130)
    fig.savefig(ART + name, dpi=130)
    plt.close(fig)

# 图1: 帕累托曲线
fig, ax = plt.subplots(figsize=(9, 5.5))
x = np.arange(1, n_sold + 1) / n_sold * 100
ax.plot(x, sold['累计占比'].values * 100, color='#c0392b', lw=2)
for pct, tier_lab in [(50, 'S'), (80, 'A'), (95, 'B')]:
    idx = (sold['累计占比'] * 100 >= pct).idxmax()
    xi = (sold.index.get_indexer([idx])[0] + 1) / n_sold * 100
    ax.axhline(pct, color='grey', ls=':', lw=0.8)
    ax.axvline(xi, color='grey', ls=':', lw=0.8)
    ax.annotate(f'{tier_lab}级截点: {xi:.1f}%的动销款\n贡献{pct}%销量', (xi, pct), xytext=(xi + 4, pct - 13), fontsize=9,
                arrowprops=dict(arrowstyle='->', color='grey'))
ax.set_xlabel('动销SPU占比 %(按销量降序)')
ax.set_ylabel('累计销量占比 %')
ax.set_title(f'衣服品类帕累托曲线(2026年8月, 动销SPU={n_sold:,})')
save(fig, 'pareto_curve.png')

# 图2: 等级结构 双条形
fig, axes = plt.subplots(1, 2, figsize=(11, 4.8))
colors = ['#c0392b', '#e67e22', '#f1c40f', '#95a5a6', '#bdc3c7']
axes[0].bar(tier_sum['等级'].astype(str), tier_sum['SPU数'], color=colors)
for i, v in enumerate(tier_sum['SPU数']):
    axes[0].text(i, v, f"{v}\n({v/len(m):.1%})", ha='center', va='bottom', fontsize=9)
axes[0].set_title('各等级 SPU 数量')
axes[0].set_ylim(0, tier_sum['SPU数'].max() * 1.2)
axes[1].bar(tier_sum['等级'].astype(str), tier_sum['销量占比'] * 100, color=colors)
for i, v in enumerate(tier_sum['销量占比'] * 100):
    axes[1].text(i, v, f'{v:.1f}%', ha='center', va='bottom', fontsize=9)
axes[1].set_title('各等级销量占比 %')
fig.suptitle('产品等级结构(S/A/B/C=累计销量50/80/95%分档, D=零动销)', y=1.0)
save(fig, 'tier_structure.png')

# 图3: 子品类健康度
fig, axes = plt.subplots(1, 2, figsize=(12.5, 5))
s2 = sub.sort_values('销量件数')
axes[0].barh(s2.index, s2['销量件数'], color='#2980b9')
for i, (v, g) in enumerate(zip(s2['销量件数'], s2['GMV美金'])):
    axes[0].text(v, i, f" {int(v)}件 / ${g/1000:.0f}k", va='center', fontsize=9)
axes[0].set_title('8月销量与GMV(按子品类)')
axes[0].set_xlim(0, s2['销量件数'].max() * 1.35)
s3 = sub.sort_values('在架动销率')
bars = axes[1].barh(s3.index, s3['在架动销率'] * 100, color='#27ae60')
for i, v in enumerate(s3['在架动销率'] * 100):
    axes[1].text(v, i, f' {v:.0f}%', va='center', fontsize=9)
axes[1].axvline((m[m['在架']]['销量件数'] > 0).mean() * 100, color='#c0392b', ls='--', lw=1)
axes[1].set_title('在架动销率 %(红线=品类整体)')
axes[1].set_xlim(0, 100)
save(fig, 'subcategory_health.png')

# 图4: 子品类 等级构成(动销款) + 价格带
fig, axes = plt.subplots(1, 2, figsize=(12.5, 5))
ct = pd.crosstab(m['子品类'], m['等级'])
ct_sold = ct[['S 爆款', 'A 旺款', 'B 平款', 'C 微销款']]
ct_sold = ct_sold.loc[sub.index]
bottom = np.zeros(len(ct_sold))
for col, c in zip(ct_sold.columns, colors[:4]):
    axes[0].bar(ct_sold.index, ct_sold[col], bottom=bottom, label=col, color=c)
    bottom += ct_sold[col].values
axes[0].set_title('各子品类动销款等级构成(SPU数)')
axes[0].legend(fontsize=8)
axes[0].tick_params(axis='x', rotation=40)
axes[1].bar(price.index.astype(str), price['销量件数'], color='#8e44ad', alpha=0.85)
ax2 = axes[1].twinx()
ax2.plot(price.index.astype(str), price['动销率_全部'] * 100, color='#c0392b', marker='o', lw=1.5)
ax2.set_ylabel('动销率 %(红线)')
axes[1].set_title('价格带 × 销量(柱)与动销率(线)')
axes[1].set_xlabel('产品单价(美金)')
save(fig, 'tier_by_subcat_price.png')

# ---------- Excel 输出 ----------
detail_cols = ['SPU', '子品类', 'prefix', '产品分类', '产品状态', '在架', '上架日期', '上架天数', '新品90天', '新品龄段',
               '产品单价', '销量件数', '退款件数', '订单数_订单表', '订单数_产品表', 'GMV_产品表', '等级', '累计占比', 'Reviews数', '买家秀数量']
detail = m[detail_cols].sort_values(['等级', '销量件数'], ascending=[True, False])
dead_onshelf = detail[(detail['在架']) & (detail['销量件数'] == 0)].sort_values('上架天数', ascending=False)

with pd.ExcelWriter(OUT + '衣服品类等级分析_2026年8月.xlsx', engine='openpyxl') as w:
    tier_sum.to_excel(w, sheet_name='等级汇总', index=False)
    sub.reset_index().to_excel(w, sheet_name='子品类健康度', index=False)
    pd.DataFrame([conc]).T.rename(columns={0: '数值'}).to_excel(w, sheet_name='集中度指标')
    price.reset_index().to_excel(w, sheet_name='价格带分析', index=False)
    top20.to_excel(w, sheet_name='Top20爆款', index=False)
    new_sum.reset_index().to_excel(w, sheet_name='新品分龄段', index=False)
    new_sub.reset_index().to_excel(w, sheet_name='新品×子品类', index=False)
    dead_onshelf.to_excel(w, sheet_name='在架零动销清单', index=False)
    detail.to_excel(w, sheet_name='SPU明细含等级', index=False)

m.to_csv(OUT + 'spu_master_with_tiers.csv', index=False)
sub.to_csv(OUT + 'subcategory_health.csv')
print('\n输出完成:', OUT)
