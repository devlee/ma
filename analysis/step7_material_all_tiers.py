# -*- coding: utf-8 -*-
"""步骤7:S-F 全等级素材清单(买家秀/Reviews/颜色图), 买家秀优先规则; 婚纱免颜色图。"""
import pandas as pd

OUT = '/workspace/analysis/output/'
COLOR_FILE = '/home/ubuntu/.cursor/projects/workspace/uploads/____spu___67f3.csv'

f = pd.read_csv(COLOR_FILE)
have_img = set(f['SpuCode'].str.upper())

m = pd.read_csv(OUT + 'spu_master_with_tiers.csv')
m['Reviews数'] = m['Reviews数'].fillna(0).astype(int)
m['买家秀数量'] = m['买家秀数量'].fillna(0).astype(int)
m['是婚纱'] = m['子品类'] == '婚纱 BRIDE'
m['颜色图豁免'] = m['子品类'].isin(['婚纱 BRIDE', '花童裙 FLOWER GIRL'])  # 以白色为主, 不需要颜色图
m['有颜色图'] = m['SPU'].isin(have_img)
m['颜色图OK'] = m['有颜色图'] | m['颜色图豁免']
m['买家秀OK'] = m['买家秀数量'] > 0
m['评论OK'] = m['Reviews数'] >= 10
m['素材完备'] = m['买家秀OK'] & m['评论OK'] & m['颜色图OK']

def gaps(r):
    g = []
    if not r['买家秀OK']:
        g.append('买家秀')
    if not r['评论OK']:
        g.append('评论<10')
    if not r['颜色图OK']:
        g.append('颜色图')
    return '完备' if not g else '缺:' + '+'.join(g)

m['素材缺项'] = m.apply(gaps, axis=1)

# 细分等级(E拆E1/E2)
m['细分等级'] = m['等级']
m.loc[(m['等级'] == 'E') & (m['销量件数'] > 5), '细分等级'] = 'E1'
m.loc[(m['等级'] == 'E') & (m['销量件数'] > 1) & (m['销量件数'] <= 5), '细分等级'] = 'E2a'
m.loc[(m['等级'] == 'E') & (m['销量件数'] == 1), '细分等级'] = 'E2b'
TIER_ORDER = ['S', 'A', 'B', 'C', 'D', 'E1', 'E2a', 'E2b', 'F']

on = m[m['在架']].copy()
TIER_RANGE = {'S': '>100件', 'A': '(50,100]', 'B': '(30,50]', 'C': '(20,30]',
              'D': '(10,20]', 'E1': '(5,10]', 'E2a': '(1,5] 即2-5件', 'E2b': '=1件', 'F': '0'}
TOTAL_QTY = m['销量件数'].sum()  # 全品类销量(含少量已下架动销款)

# ===== 汇总: 各等级素材对应情况(在架) =====
def summ(g):
    nb = g[~g['颜色图豁免']]
    return pd.Series({
        '在架款数': len(g),
        '销量件数': g['销量件数'].sum(),
        '销量占比': g['销量件数'].sum() / TOTAL_QTY,
        '买家秀覆盖率': g['买家秀OK'].mean(),
        '买家秀中位数': g['买家秀数量'].median(),
        'R≥10占比': g['评论OK'].mean(),
        'Reviews中位数': g['Reviews数'].median(),
        '颜色图覆盖率_需图款': nb['有颜色图'].mean() if len(nb) else float('nan'),
        '素材完备率': g['素材完备'].mean(),
        '完备款数': g['素材完备'].sum(),
    })

summary = on.groupby('细分等级').apply(summ, include_groups=False).reindex(TIER_ORDER)
summary.insert(0, '月销区间', [TIER_RANGE[t] for t in summary.index])
print('=== S-F 各等级素材对应情况(在架款) ===')
print(summary.round(3).to_string())

# 高等级缺口点名(S/A/B/C/D 非完备款)
high_gap = on[on['细分等级'].isin(['S', 'A', 'B', 'C', 'D']) & (~on['素材完备'])]
print(f"\nS-D级素材不完备: {len(high_gap)}款")
print(high_gap.groupby(['细分等级', '素材缺项'])['SPU'].count().to_string())

# ===== E级行动清单(买家秀优先规则) =====
e = on[on['等级'] == 'E'].copy()
L1 = e[(e['细分等级'] == 'E1') & (e['评论OK']) & (e['颜色图OK']) & (e['买家秀OK'])]
L2 = e[(e['评论OK']) & (e['颜色图OK']) & (~e['买家秀OK'])]
L3 = e[(e['评论OK']) & (~e['颜色图OK'])]
L4 = e[(e['细分等级'].isin(['E2a', 'E2b'])) & (e['Reviews数'] >= 30) & (e['颜色图OK']) & (e['买家秀OK'])]
L5 = e[(~e['评论OK']) & (e['销量件数'] >= 2) & (e['颜色图OK'])].copy()
L5['优先级'] = L5['销量件数'].apply(lambda q: 'P1' if q >= 3 else 'P2')
L6 = e[(~e['评论OK']) & (e['销量件数'] >= 2) & (~e['颜色图OK'])]
print(f"\nE级清单: ①E1完全就绪 {len(L1)} | ②缺买家秀速补 {len(L2)} | ③缺颜色图速补 {len(L3)} | ④E2素材全卖不动 {len(L4)} | ⑤待种草 {len(L5)} | ⑥图+评论双缺 {len(L6)}")

cols = ['SPU', '子品类', '颜色图豁免', '细分等级', '销量件数', 'GMV_产品表', '产品单价', '上架天数',
        '买家秀数量', 'Reviews数', '有颜色图', '素材缺项', '产品状态']

def prep(df):
    d = df[cols].copy()
    d['有颜色图'] = d.apply(lambda r: '不适用(豁免)' if r['颜色图豁免'] else ('有' if r['有颜色图'] else '无'), axis=1)
    return d.sort_values(['买家秀数量', '销量件数'], ascending=False)

with pd.ExcelWriter(OUT + '全等级素材清单_2026年9月.xlsx', engine='openpyxl') as w:
    summary.reset_index().to_excel(w, sheet_name='各等级素材汇总', index=False)
    prep(high_gap).to_excel(w, sheet_name='S-D级缺口速补', index=False)
    for t in TIER_ORDER:
        seg = on[on['细分等级'] == t]
        prep(seg).to_excel(w, sheet_name=f'{t}级素材明细', index=False)
    prep(L1).to_excel(w, sheet_name='E①完全就绪推流量', index=False)
    prep(L2).to_excel(w, sheet_name='E②缺买家秀速补', index=False)
    prep(L3).to_excel(w, sheet_name='E③缺颜色图速补', index=False)
    prep(L4).to_excel(w, sheet_name='E④素材全卖不动诊断', index=False)
    d5 = prep(L5)
    d5['优先级'] = L5.sort_values(['买家秀数量', '销量件数'], ascending=False)['优先级'].values
    d5.to_excel(w, sheet_name='E⑤待种草', index=False)
    prep(L6).to_excel(w, sheet_name='E⑥图评论双缺', index=False)
print('\nExcel 已导出: 全等级素材清单_2026年9月.xlsx')
