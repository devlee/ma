# -*- coding: utf-8 -*-
"""步骤1:清洗订单表与产品表,构建 SPU 主表,并做两表口径校验。"""
import pandas as pd

UP = '/home/ubuntu/.cursor/projects/workspace/uploads/'
ORDER_FILES = [UP + '____1_7bd6.csv', UP + '____2_7f67.csv', UP + '____3_417e.csv']
PROD_FILE = UP + '_____8e7c.csv'

TARGET_PREFIXES = ['sjbd', 'sfgd', 'smbd', 'swd', 'sbd', 'sed', 'scd', 'spd', 'shd']
PREFIX_NAME = {
    'swd': '婚纱 BRIDE', 'sbd': '伴娘裙 BRIDESMAID', 'smbd': '妈妈装 MOB',
    'sed': '晚礼服 EVENING', 'scd': '鸡尾酒裙 COCKTAIL', 'spd': '舞会裙 PROM',
    'shd': '返校节裙 HOCO', 'sfgd': '花童裙 FLOWER GIRL', 'sjbd': '少女伴娘 JR BM',
}
# 已支付且未退款的状态
PAID_STATUS = ['支付成功', '售后争议中', '售后争议已解决', '售后争议通知', '订单争议中']
WINDOW = ('2026-08-01', '2026-09-01')  # [8-01, 9-01)


def extract_prefix(spu_series):
    s = spu_series.astype(str).str.lower().str.extract(r'^([a-z]+)')[0]
    # 最长前缀优先(此处9个前缀互不包含,直接 isin 即可)
    return s.where(s.isin(TARGET_PREFIXES))


def load_orders():
    df = pd.concat([pd.read_csv(f, skiprows=1) for f in ORDER_FILES], ignore_index=True)
    n0 = len(df)
    df = df[df['SPU'].notna()].copy()          # 剔除支付信息空行
    n1 = len(df)
    df = df.drop_duplicates(subset='子订单号')   # 文件边界重复
    n2 = len(df)
    df['下单时间'] = pd.to_datetime(df['下单时间'], errors='coerce')
    df = df[(df['下单时间'] >= WINDOW[0]) & (df['下单时间'] < WINDOW[1])]
    n3 = len(df)
    df = df[df['订单支付状态'].isin(PAID_STATUS)]
    n4 = len(df)
    df['prefix'] = extract_prefix(df['SPU'])
    df['SPU'] = df['SPU'].astype(str).str.strip().str.upper()
    clothing = df[df['prefix'].notna()].copy()
    print(f"订单行清洗: 原始 {n0} -> 去支付空行 {n1} -> 去重 {n2} -> 8月窗口 {n3} -> 已支付 {n4} -> 衣服品类行 {len(clothing)}")
    return df, clothing


def load_products():
    p = pd.read_csv(PROD_FILE)
    p['SPU'] = p['SPU'].astype(str).str.strip().str.upper()
    p['prefix'] = extract_prefix(p['SPU'])
    p = p[p['prefix'].notna()].copy()
    p['上架日期'] = pd.to_datetime(p['上架日期'], errors='coerce')
    p['下架日期'] = pd.to_datetime(p['下架日期'], errors='coerce')
    assert p['SPU'].is_unique
    print(f"产品表衣服品类SPU: {len(p)}")
    return p


def main():
    all_orders, cloth_orders = load_orders()
    prod = load_products()

    # 按SPU聚合订单
    agg = cloth_orders.groupby('SPU').agg(
        销量件数=('数量', 'sum'),
        订单行数=('子订单号', 'count'),
        订单数_订单表=('订单编号', 'nunique'),
    ).reset_index()

    # 校验1: 订单表中的衣服SPU是否都在产品表
    missing = set(agg['SPU']) - set(prod['SPU'])
    print(f"\n校验: 订单表衣服SPU共 {agg['SPU'].nunique()} 个, 不在产品表中的: {len(missing)}")
    if missing:
        print("  示例:", sorted(missing)[:10])

    # 校验2: 两表订单数相关性(口径不同不求相等,看方向一致性)
    cmp = prod[['SPU', '订单数']].merge(agg[['SPU', '订单数_订单表']], on='SPU', how='inner')
    cmp = cmp[(cmp['订单数'] > 0) | (cmp['订单数_订单表'] > 0)]
    corr = cmp['订单数'].corr(cmp['订单数_订单表'])
    diff = (cmp['订单数'] - cmp['订单数_订单表'])
    print(f"校验: 两表SPU订单数相关系数 {corr:.4f}, 差值中位数 {diff.median()}, 平均 {diff.mean():.2f}")
    print(f"  产品表订单数合计 {cmp['订单数'].sum()}, 订单表口径合计 {cmp['订单数_订单表'].sum()}")

    # 构建SPU主表(产品表为主表, 保留零销量SPU)
    master = prod.merge(agg, on='SPU', how='left')
    for c in ['销量件数', '订单行数', '订单数_订单表']:
        master[c] = master[c].fillna(0).astype(int)
    master['子品类'] = master['prefix'].map(PREFIX_NAME)
    master['在架'] = (master['产品状态'] == '上架')
    period_end = pd.Timestamp('2026-08-31')
    master['上架天数'] = (period_end - master['上架日期']).dt.days
    master['新品30天'] = master['上架天数'] <= 30
    # 产品收入为产品表口径(8月, 美金)
    master = master.rename(columns={'产品收入': 'GMV_产品表', '订单数': '订单数_产品表'})

    # 订单表有销量但产品表无记录的SPU补充进主表(不常见但避免遗漏)
    if missing:
        extra = agg[agg['SPU'].isin(missing)].copy()
        extra['prefix'] = extract_prefix(extra['SPU'])
        extra['子品类'] = extra['prefix'].map(PREFIX_NAME)
        extra['在架'] = True
        extra['产品状态'] = '(产品表缺失)'
        master = pd.concat([master, extra], ignore_index=True)
        master['销量件数'] = master['销量件数'].fillna(0).astype(int)

    master.to_parquet('/workspace/analysis/master_spu.parquet')
    print(f"\nSPU主表: {len(master)} 行, 其中在架 {master['在架'].sum()}, 有销量 {(master['销量件数']>0).sum()}")
    print(master.groupby('子品类').agg(SPU数=('SPU','count'), 在架数=('在架','sum'), 销量=('销量件数','sum')).to_string())


if __name__ == '__main__':
    main()
