# -*- coding: utf-8 -*-
"""步骤5:E级拆分(E1/E2) + 素材(Reviews/买家秀)储备分析 + 针对性行动清单。"""
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['WenQuanYi Micro Hei']
plt.rcParams['axes.unicode_minus'] = False

OUT = '/workspace/analysis/output/'
ART = '/opt/cursor/artifacts/'
m = pd.read_parquet('/workspace/analysis/master_spu.parquet')


def tier_of(q):
    if q > 100: return 'S'
    if q > 50: return 'A'
    if q > 30: return 'B'
    if q > 20: return 'C'
    if q > 10: return 'D'
    if q > 0: return 'E'
    return 'F'


m['等级'] = m['销量件数'].apply(tier_of)
m['Reviews数'] = m['Reviews数'].fillna(0)
m['买家秀数量'] = m['买家秀数量'].fillna(0)
m['细分等级'] = m['等级']
m.loc[(m['等级'] == 'E') & (m['销量件数'] > 5), '细分等级'] = 'E1'
m.loc[(m['等级'] == 'E') & (m['销量件数'] <= 5), '细分等级'] = 'E2'
total_qty = m['销量件数'].sum()

# ---- 素材状态 ----
m['素材状态'] = np.select(
    [(m['Reviews数'] >= 10) & (m['买家秀数量'] > 0), m['Reviews数'] >= 10, m['Reviews数'] > 0],
    ['A素材充足(R≥10+买家秀)', 'B有评论缺买家秀(R≥10)', 'C素材薄弱(R1-9)'], default='D零素材')

e = m[m['等级'] == 'E']
es = e.groupby('细分等级').agg(款数=('SPU', 'count'), 销量=('销量件数', 'sum'), GMV=('GMV_产品表', 'sum'), 在架=('在架', 'sum'))
es['销量占比_全品类'] = es['销量'] / total_qty
print('=== E级拆分 ===')
print(es.round(2).to_string())

mat_tier = m.groupby('等级').apply(lambda g: pd.Series({
    '款数': len(g), 'Reviews中位数': g['Reviews数'].median(), '零Review占比': (g['Reviews数'] == 0).mean(),
    'R≥10占比': (g['Reviews数'] >= 10).mean(), '有买家秀占比': (g['买家秀数量'] > 0).mean(),
}), include_groups=False).reindex(['S', 'A', 'B', 'C', 'D', 'E', 'F'])
print('\n=== 素材储备按等级 ===')
print(mat_tier.round(3).to_string())

# ---- 行动清单 ----
cols = ['SPU', '子品类', '销量件数', 'GMV_产品表', '产品单价', '上架天数', 'Reviews数', '买家秀数量', '素材状态', '产品状态']
on = m[m['在架']]
list_e1_push = on[(on['细分等级'] == 'E1') & (on['Reviews数'] >= 10)].sort_values(['Reviews数', '销量件数'], ascending=False)[cols]
list_e2_traffic = on[(on['细分等级'] == 'E2') & (on['Reviews数'] >= 30)].sort_values('Reviews数', ascending=False)[cols]
list_e_seed = on[(on['等级'] == 'E') & (on['Reviews数'] < 10) & (on['销量件数'] >= 2)].sort_values('销量件数', ascending=False)[cols]
list_d_up = on[on['等级'] == 'D'].sort_values('销量件数', ascending=False)[cols]

with pd.ExcelWriter(OUT + 'E级与素材行动清单_2026年8月.xlsx', engine='openpyxl') as w:
    es.reset_index().to_excel(w, sheet_name='E级拆分汇总', index=False)
    mat_tier.reset_index().to_excel(w, sheet_name='素材储备按等级', index=False)
    list_d_up.to_excel(w, sheet_name='D级推升清单(315款)', index=False)
    list_e1_push.to_excel(w, sheet_name='E1素材就绪推流量', index=False)
    list_e2_traffic.to_excel(w, sheet_name='E2素材好卖不动待诊断', index=False)
    list_e_seed.to_excel(w, sheet_name='E级有销量缺素材待种草', index=False)

print(f'\n清单: D级推升 {len(list_d_up)} | E1推流量 {len(list_e1_push)} | E2待诊断 {len(list_e2_traffic)} | E级待种草 {len(list_e_seed)}')

# ---- 图: 素材阶梯 + E级素材矩阵 ----
fig, axes = plt.subplots(1, 2, figsize=(13, 5.2))
old_on = m[m['在架'] & (m['新品90天'] != True)]
buckets = [('零Review', old_on['Reviews数'] == 0), ('R 1-9', (old_on['Reviews数'] > 0) & (old_on['Reviews数'] < 10)),
           ('R 10-49', (old_on['Reviews数'] >= 10) & (old_on['Reviews数'] < 50)), ('R ≥50', old_on['Reviews数'] >= 50)]
names = [b[0] for b in buckets]
rates = [(old_on[b[1]]['销量件数'] > 0).mean() * 100 for b in buckets]
avgs = [old_on[b[1]]['销量件数'].mean() for b in buckets]
cnts = [b[1].sum() for b in buckets]
bars = axes[0].bar(names, rates, color=['#95a5a6', '#f1c40f', '#e67e22', '#c0392b'])
for i, (r, a, c) in enumerate(zip(rates, avgs, cnts)):
    axes[0].text(i, r + 1.5, f'{r:.0f}%\n款均{a:.1f}件\n({c}款)', ha='center', fontsize=9)
axes[0].set_ylim(0, 115)
axes[0].set_ylabel('动销率 %')
axes[0].set_title('素材阶梯:在架老品按Reviews数分组的动销率\n(相关性而非因果, 但可作为投放就绪度筛选)')

ex = e[e['在架']].pivot_table(index='细分等级', columns='素材状态', values='SPU', aggfunc='count', fill_value=0)
ex = ex[['A素材充足(R≥10+买家秀)', 'B有评论缺买家秀(R≥10)', 'C素材薄弱(R1-9)', 'D零素材']]
bottom = np.zeros(len(ex))
for col, c in zip(ex.columns, ['#27ae60', '#2980b9', '#f39c12', '#95a5a6']):
    axes[1].bar(ex.index, ex[col], bottom=bottom, label=col, color=c)
    for i, v in enumerate(ex[col]):
        if v > 60:
            axes[1].text(i, bottom[i] + v / 2, str(int(v)), ha='center', va='center', fontsize=9, color='white')
    bottom += ex[col].values
axes[1].legend(fontsize=8.5)
axes[1].set_title('E级(在架)素材矩阵: E1(5-10] vs E2(0-5]')
axes[1].set_ylabel('SPU 数')
fig.tight_layout()
fig.savefig(OUT + 'e_tier_material.png', dpi=130)
fig.savefig(ART + 'e_tier_material.png', dpi=130)
plt.close(fig)
print('图表与Excel输出完成')
