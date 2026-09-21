# -*- coding: utf-8 -*-
"""步骤8:7→8月等级迁移矩阵 + 新品爬坡验证。两月统一用产品表"订单数"(=销售件数)口径。"""
import pandas as pd
import numpy as np

OUT = '/workspace/analysis/output/'
JULY_FILE = '/home/ubuntu/.cursor/projects/workspace/uploads/7______1__22da.csv'

TARGET = ['sjbd', 'sfgd', 'smbd', 'swd', 'sbd', 'sed', 'scd', 'spd', 'shd']
PREFIX_NAME = {
    'swd': '婚纱 BRIDE', 'sbd': '伴娘裙 BRIDESMAID', 'smbd': '妈妈装 MOB',
    'sed': '晚礼服 EVENING', 'scd': '鸡尾酒裙 COCKTAIL', 'spd': '舞会裙 PROM',
    'shd': '返校节裙 HOCO', 'sfgd': '花童裙 FLOWER GIRL', 'sjbd': '少女伴娘 JR BM',
}
ORDER = ['S', 'A', 'B', 'C', 'D', 'E1', 'E2a', 'E2b', 'F', '(不在表)']


def tier_of(q):
    if q > 100: return 'S'
    if q > 50: return 'A'
    if q > 30: return 'B'
    if q > 20: return 'C'
    if q > 10: return 'D'
    if q > 5: return 'E1'
    if q > 1: return 'E2a'
    if q > 0: return 'E2b'
    return 'F'


# ---- 7月产品表 ----
j = pd.read_csv(JULY_FILE, encoding='gbk')
j['SPU'] = j['SPU'].astype(str).str.strip().str.upper()
j['prefix'] = j['SPU'].str.lower().str.extract(r'^([a-z]+)')[0]
j = j[j['prefix'].isin(TARGET)].copy()
j['子品类'] = j['prefix'].map(PREFIX_NAME)
j['销量7月'] = j['订单数'].fillna(0).astype(int)
j['等级7月'] = j['销量7月'].apply(tier_of)
j = j.rename(columns={'产品状态': '产品状态7月'})
print(f"7月产品表衣服SPU: {len(j)}, 7月销量合计 {j['销量7月'].sum()}")

# ---- 8月(用产品表口径的订单数, 与7月同源) ----
a = pd.read_csv(OUT + 'spu_master_with_tiers.csv')
a['SPU'] = a['SPU'].astype(str).str.strip().str.upper()
a['销量8月'] = a['订单数_产品表'].fillna(0).astype(int)
a['等级8月'] = a['销量8月'].apply(tier_of)
a['上架日期'] = pd.to_datetime(a['上架日期'])
print(f"8月主表衣服SPU: {len(a)}, 8月销量(产品表口径)合计 {a['销量8月'].sum()}")

# ---- 合并(外连接, 两月SPU池可能有差) ----
mg = a[['SPU', '子品类', '上架日期', '产品状态', '在架', '销量8月', '等级8月', '产品单价', 'Reviews数', '买家秀数量']].merge(
    j[['SPU', '销量7月', '等级7月', '产品状态7月']], on='SPU', how='outer', indicator=True)
only_aug = (mg['_merge'] == 'left_only').sum()
only_jul = (mg['_merge'] == 'right_only').sum()
print(f"仅8月表有: {only_aug} (7月后新上架), 仅7月表有: {only_jul}")
mg['等级7月'] = mg['等级7月'].fillna('(不在表)')
mg['等级8月'] = mg['等级8月'].fillna('(不在表)')
mg['销量7月'] = mg['销量7月'].fillna(0).astype(int)
mg['销量8月'] = mg['销量8月'].fillna(0).astype(int)

# ---- 迁移矩阵 ----
mx = pd.crosstab(mg['等级7月'], mg['等级8月'])
mx = mx.reindex(index=[t for t in ORDER if t in mx.index], columns=[t for t in ORDER if t in mx.columns])
print('\n=== 迁移矩阵: 行=7月等级, 列=8月等级 (款数) ===')
print(mx.to_string())

# ---- 关键转化率 ----
rank = {t: i for i, t in enumerate(['S', 'A', 'B', 'C', 'D', 'E1', 'E2a', 'E2b', 'F'])}
core = mg[(mg['等级7月'] != '(不在表)') & (mg['等级8月'] != '(不在表)')].copy()
core['r7'] = core['等级7月'].map(rank)
core['r8'] = core['等级8月'].map(rank)
core['方向'] = np.select([core['r8'] < core['r7'], core['r8'] > core['r7']], ['升级', '降级'], '持平')

print('\n=== 关键留存/转化(7月等级 → 8月去向) ===')
for t in ['S', 'A', 'B', 'C', 'D', 'E1', 'E2a', 'E2b']:
    g = core[core['等级7月'] == t]
    if not len(g):
        continue
    stay = (g['等级8月'] == t).mean()
    up = (g['r8'] < g['r7']).mean()
    down = (g['r8'] > g['r7']).mean()
    to_f = (g['等级8月'] == 'F').mean()
    print(f"{t}(7月{len(g)}款): 留级{stay:.0%} 升级{up:.0%} 降级{down:.0%} (其中直接归零{to_f:.0%})")

e1 = core[core['等级7月'] == 'E1']
print(f"\nE1→D+转化率(核心验证): {(e1['r8'] <= rank['D']).mean():.1%} ({(e1['r8']<=rank['D']).sum()}/{len(e1)})")
e2a = core[core['等级7月'] == 'E2a']
print(f"E2a→E1+转化率: {(e2a['r8'] <= rank['E1']).mean():.1%}")
f7 = core[core['等级7月'] == 'F']
print(f"7月F款8月复活率(卖出>1件): {(f7['r8'] <= rank['E2a']).mean():.1%}")

# S/A稳定性
sa8 = core[core['等级8月'].isin(['S', 'A'])]
print(f"\n8月S+A共{len(sa8)}款中, 7月已是S/A的 {sa8['等级7月'].isin(['S','A']).sum()}款, 7月是B-D的 {sa8['等级7月'].isin(['B','C','D']).sum()}款, 7月E级以下的 {sa8['等级7月'].isin(['E1','E2a','E2b','F']).sum()}款")

# ---- 熄火款与爬坡款 ----
stall = core[(core['销量7月'] > 5) & (core['销量8月'] <= 1) & (core['在架'] == True)]
climb = core[(core['方向'] == '升级') & (core['销量8月'] > 5) & (core['在架'] == True)]
print(f"\n熄火款(7月E1+, 8月≤1件, 仍在架): {len(stall)}款")
print(f"爬坡款(升级且8月>5件, 在架): {len(climb)}款")

# ---- 新品爬坡验证: 按上架月看 7月 vs 8月 款均销量(同一批款) ----
core['上架月'] = pd.to_datetime(core['上架日期']).dt.to_period('M').astype(str)
coh = core[core['上架月'] >= '2026-02']
print('\n=== 新品批次真实爬坡(同一批款, 7月 vs 8月款均销量) ===')
cs = coh.groupby('上架月').apply(lambda g: pd.Series({
    '款数': len(g), '7月款均': g['销量7月'].mean(), '8月款均': g['销量8月'].mean(),
    '7月E1+率': (g['销量7月'] > 5).mean(), '8月E1+率': (g['销量8月'] > 5).mean(),
}), include_groups=False)
print(cs.round(3).to_string())

# HOCO 季节对照
hoco = core[core['子品类'] == '返校节裙 HOCO']
print(f"\nHOCO: 7月销量 {hoco['销量7月'].sum()} → 8月 {hoco['销量8月'].sum()}; 动销款 {(hoco['销量7月']>0).sum()} → {(hoco['销量8月']>0).sum()}")

# ---- 导出 ----
exp_cols = ['SPU', '子品类', '产品单价', '上架日期', '在架', '销量7月', '等级7月', '销量8月', '等级8月', '方向', 'Reviews数', '买家秀数量']
with pd.ExcelWriter(OUT + '等级迁移_7to8月.xlsx', engine='openpyxl') as w:
    mx.reset_index().to_excel(w, sheet_name='迁移矩阵', index=False)
    core[core['方向'] == '降级'].sort_values(['r7', '销量7月'], ascending=[True, False])[exp_cols].to_excel(w, sheet_name='降级款清单', index=False)
    climb.sort_values('销量8月', ascending=False)[exp_cols].to_excel(w, sheet_name='爬坡款清单', index=False)
    stall.sort_values('销量7月', ascending=False)[exp_cols].to_excel(w, sheet_name='熄火款清单', index=False)
    core[exp_cols].to_excel(w, sheet_name='全量迁移明细', index=False)
print('\n已导出: 等级迁移_7to8月.xlsx')
