# -*- coding: utf-8 -*-
"""步骤4:资源分配视角分析——子品类效率、四象限、上新批次效果、潜力款/成熟款清单。"""
import pandas as pd, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei']
plt.rcParams['axes.unicode_minus'] = False

OUT = '/workspace/analysis/output/'
ART = '/opt/cursor/artifacts/'
m = pd.read_parquet('/workspace/analysis/master_spu.parquet')

def eff(g):
    on = g[g['在架']]; sold = g[g['销量件数'] > 0]; new = g[g['新品90天'] == True]
    return pd.Series({
        '在架SPU': len(on), '销量': g['销量件数'].sum(), 'GMV': g['GMV_产品表'].sum(),
        '件每在架SPU': g['销量件数'].sum() / max(len(on), 1),
        'GMV每在架SPU': g['GMV_产品表'].sum() / max(len(on), 1),
        '在架动销率': on['销量件数'].gt(0).mean() if len(on) else 0,
        '动销款均月销': sold['销量件数'].mean() if len(sold) else 0,
        '新品数90天': len(new), '新品动销率': new['销量件数'].gt(0).mean() if len(new) else np.nan,
        '客单价中位': g.loc[g['产品单价'] > 0, '产品单价'].median(),
        '退款率': g['退款件数'].sum() / max(g['销量件数'].sum(), 1),
    })

eff_tab = m.groupby('子品类').apply(eff, include_groups=False).sort_values('GMV每在架SPU', ascending=False)

m['上架月'] = m['上架日期'].dt.to_period('M')
coh = m[m['上架日期'] >= '2025-09-01'].groupby('上架月').apply(lambda g: pd.Series({
    '上架SPU数': len(g), '仍在架': g['在架'].sum(), '8月动销数': (g['销量件数'] > 0).sum(),
    '8月动销率': (g['销量件数'] > 0).mean(), '8月销量': g['销量件数'].sum(),
    '动销款均销': g.loc[g['销量件数'] > 0, '销量件数'].mean() if (g['销量件数'] > 0).any() else 0,
    '月销≥20款数': (g['销量件数'] >= 20).sum(), '月销≥5款数': (g['销量件数'] >= 5).sum(),
}), include_groups=False)

potential = m[(m['新品90天'] == True) & (m['销量件数'] >= 10)].sort_values('销量件数', ascending=False)[
    ['SPU', '子品类', '销量件数', 'GMV_产品表', '产品单价', '上架天数', '上架日期', 'Reviews数']]
mature = m[(m['销量件数'] >= 50) & (m['新品90天'] != True)].sort_values('销量件数', ascending=False)[
    ['SPU', '子品类', '销量件数', 'GMV_产品表', '产品单价', '上架日期', 'Reviews数']]

with pd.ExcelWriter(OUT + '资源分配分析_2026年8月.xlsx', engine='openpyxl') as w:
    eff_tab.reset_index().to_excel(w, sheet_name='子品类投入产出效率', index=False)
    coh.reset_index().astype(str).to_excel(w, sheet_name='上新批次效果', index=False)
    potential.to_excel(w, sheet_name='潜力新款(90天内月销≥10)', index=False)
    mature.to_excel(w, sheet_name='成熟加码款(月销≥50)', index=False)

# 四象限
offsets = {'妈妈装 MOB': (14, -26), '伴娘裙 BRIDESMAID': (-30, 22), '婚纱 BRIDE': (14, 8),
           '晚礼服 EVENING': (14, 8), '花童裙 FLOWER GIRL': (-115, 10), '鸡尾酒裙 COCKTAIL': (12, 26),
           '舞会裙 PROM': (-105, -8), '少女伴娘 JR BM': (12, -30), '返校节裙 HOCO': (12, 8)}
fig, ax = plt.subplots(figsize=(10, 7))
colors = plt.cm.tab10(np.linspace(0, 1, len(eff_tab)))
for (name, r), c in zip(eff_tab.iterrows(), colors):
    ax.scatter(r['在架动销率'] * 100, r['动销款均月销'], s=max(r['GMV'] / 1500, 60), alpha=.65, color=c, edgecolors='white', zorder=3)
    ax.annotate(f"{name}\n${r['GMV']/10000:.0f}万 / {int(r['在架SPU'])}款", (r['在架动销率'] * 100, r['动销款均月销']),
                textcoords='offset points', xytext=offsets[name], fontsize=9.5, zorder=4)
ax.axvline(55, color='grey', ls='--', lw=1); ax.axhline(6, color='grey', ls='--', lw=1)
ax.text(97, 11.8, '明星区:加码投入', ha='right', fontsize=11, color='#c0392b')
ax.text(3, 11.8, '深度好广度差:选款问题', fontsize=10, color='#e67e22')
ax.text(97, 0.3, '广度好深度差:单款起量难', ha='right', fontsize=10, color='#2980b9')
ax.text(3, 0.3, '问题区:诊断/收缩', fontsize=11, color='#7f8c8d')
ax.set_xlabel('在架动销率 %(卖得开不开 = 广度)'); ax.set_ylabel('动销款均月销 件(卖得深不深 = 深度)')
ax.set_title('子品类资源分配四象限(气泡=8月GMV, 2026年8月)')
ax.set_xlim(0, 100); ax.set_ylim(0, 12.5)
fig.tight_layout()
fig.savefig(OUT + 'quadrant_resource.png', dpi=130); fig.savefig(ART + 'quadrant_resource.png', dpi=130); plt.close(fig)

# 上新批次
fig, ax1 = plt.subplots(figsize=(11, 5.5))
xs = coh.index.astype(str)
ax1.bar(xs, coh['上架SPU数'], color='#34495e', alpha=.8, label='当月上架SPU数')
ax1.bar(xs, coh['月销≥20款数'] * 10, color='#c0392b', alpha=.9, width=.4, label='其中8月月销≥20件款数 ×10')
ax1.set_ylabel('SPU 数'); ax1.legend(loc='upper left', fontsize=9)
ax2 = ax1.twinx()
ax2.plot(xs, coh['8月动销率'] * 100, color='#27ae60', marker='o', lw=2, label='该批次8月动销率%')
ax2.set_ylabel('8月动销率 %', color='#27ae60'); ax2.set_ylim(0, 60)
ax2.legend(loc='upper right', fontsize=9)
for i in range(len(coh)):
    ax1.text(i, coh['上架SPU数'].iloc[i] + 5, f"{int(coh['月销≥20款数'].iloc[i])}款≥20", ha='center', fontsize=8, color='#c0392b')
ax1.set_title('上新批次效果:近12个月各月上架SPU在2026年8月的表现')
ax1.tick_params(axis='x', rotation=35)
fig.tight_layout()
fig.savefig(OUT + 'cohort_newproduct.png', dpi=130); fig.savefig(ART + 'cohort_newproduct.png', dpi=130); plt.close(fig)
print('step4 输出完成')
