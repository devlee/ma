# -*- coding: utf-8 -*-
"""步骤6:颜色汇总——多语言归一化后,输出全品类与各子品类颜色表格。"""
import pandas as pd

OUT = '/workspace/analysis/output/'
PREFIX_NAME = {
    'swd': '婚纱 BRIDE', 'sbd': '伴娘裙 BRIDESMAID', 'smbd': '妈妈装 MOB',
    'sed': '晚礼服 EVENING', 'scd': '鸡尾酒裙 COCKTAIL', 'spd': '舞会裙 PROM',
    'shd': '返校节裙 HOCO', 'sfgd': '花童裙 FLOWER GIRL', 'sjbd': '少女伴娘 JR BM',
}

c = pd.read_parquet('/workspace/analysis/color_lines.parquet')
c['子品类'] = c['prefix'].map(PREFIX_NAME)

# 多语言(法/德/西/意/波/瑞典)同色异名 → 英文标准名
TRANS = {
    # Ivory / White / Black
    'ivoire': 'Ivory', 'elfenbein': 'Ivory', 'marfil': 'Ivory', 'avorio': 'Ivory',
    'elfenbenshvit': 'Ivory', 'elfenbensvit': 'Ivory', 'kość słoniowa': 'Ivory', 'kosc sloniowa': 'Ivory',
    'hvit': 'White', 'sort': 'Black',
    'blanc': 'White', 'weiß': 'White', 'weiss': 'White', 'blanco': 'White', 'bianco': 'White',
    'biały': 'White', 'bialy': 'White', 'vit': 'White',
    'noir': 'Black', 'schwarz': 'Black', 'negro': 'Black', 'nero': 'Black', 'svart': 'Black', 'czarny': 'Black',
    # As picture
    'as pictured': 'As Picture', "comme sur l'image": 'As Picture', 'siehe abbildung': 'As Picture',
    'como imagen': 'As Picture', 'come in foto': 'As Picture', 'como en la imagen': 'As Picture',
    'som på bilden': 'As Picture', 'jak na zdjęciu': 'As Picture',
    # Blues
    'bleu marine': 'Navy Blue', 'marineblau': 'Navy Blue', 'blu navy': 'Navy Blue', 'azul marino': 'Navy Blue',
    'granatowy': 'Navy Blue', 'marinblå': 'Navy Blue',
    'bleu marine foncé': 'Dark Navy', 'dunkles marineblau': 'Dark Navy', 'azul marino oscuro': 'Dark Navy',
    'blu navy scuro': 'Dark Navy',
    'bleu roi': 'Royal Blue', 'königsblau': 'Royal Blue', 'blu reale': 'Royal Blue', 'azul real': 'Royal Blue',
    'bleu ardoise': 'Slate Blue', 'schieferblau': 'Slate Blue', 'blu ardesia': 'Slate Blue', 'azul pizarra': 'Slate Blue',
    'bleu ciel': 'Sky Blue', 'himmelblau': 'Sky Blue', 'azul cielo': 'Sky Blue', 'blu cielo': 'Sky Blue',
    'bleu encre': 'Ink Blue', 'azul tinta': 'Ink Blue', 'tintenblau': 'Ink Blue',
    'bleu poudré': 'Dusty Blue', 'bleu poudre': 'Dusty Blue', 'staubblau': 'Dusty Blue', 'azul empolvado': 'Dusty Blue',
    'bleu océan': 'Ocean Blue', 'azul océano': 'Ocean Blue',
    # Greens
    'olive verte': 'Olive Green', 'vert olive': 'Olive Green', 'olivgrün': 'Olive Green',
    'verde oliva': 'Olive Green', 'oliwkowy': 'Olive Green',
    'vert sauge': 'Sage Green', 'salbeigrün': 'Sage Green', 'verde salvia': 'Sage Green',
    'vert céladon': 'Celadon', 'seladongrün': 'Celadon', 'verde celadón': 'Celadon', 'verde celadon': 'Celadon',
    'vert chasseur': 'Hunter Green', 'jägergrün': 'Hunter Green', 'verde cazador': 'Hunter Green',
    'vert forêt': 'Forest Green', 'waldgrün': 'Forest Green', 'verde bosque': 'Forest Green',
    'vert émeraude': 'Emerald', 'smaragd': 'Emerald', 'esmeralda': 'Emerald', 'émeraude': 'Emerald',
    'emeraude': 'Emerald', 'smeraldo': 'Emerald', 'szmaragdowy': 'Emerald',
    'vert mousse': 'Moss Green', 'moosgrün': 'Moss Green', 'verde musgo': 'Moss Green',
    'jade': 'Jade', 'giada': 'Jade',
    # Reds / Pinks / Purples
    'rouge': 'Red', 'rot': 'Red', 'rojo': 'Red', 'rosso': 'Red', 'czerwony': 'Red', 'röd': 'Red',
    'bordeaux': 'Burgundy', 'burgund': 'Burgundy', 'borgoña': 'Burgundy', 'borgogna': 'Burgundy',
    'bordo': 'Burgundy', 'vinröd': 'Burgundy',
    'vermillon': 'Vermilion', 'bermellón': 'Vermilion',
    'fucsia': 'Fuchsia', 'fuchsie': 'Fuchsia',
    'vieux rose': 'Dusty Rose', 'altrosa': 'Dusty Rose', 'rosa empolvado': 'Dusty Rose', 'rosa antico': 'Dusty Rose',
    'rose poudré': 'Blush', 'rosa empolvada': 'Blush',
    'rose nacré': 'Pearl Pink', 'perlrosa': 'Pearl Pink', 'rosa perla': 'Pearl Pink',
    'rose vif': 'Hot Pink', 'rosa fuerte': 'Hot Pink', 'rosa caldo': 'Hot Pink', 'pink': 'Pink',
    'rose cannelle': 'Cinnamon Rose', 'zimtrosa': 'Cinnamon Rose',
    'rose bonbon': 'Candy Pink', 'rosa caramelo': 'Candy Pink',
    'mauve vintage': 'Vintage Mauve', 'malva vintage': 'Vintage Mauve',
    'lilas': 'Lilac', 'lila': 'Lilac', 'lilla': 'Lilac', 'liliowy': 'Lilac',
    'lavande': 'Lavender', 'lavendel': 'Lavender', 'lavanda': 'Lavender',
    'orchidée': 'Orchid', 'orquídea': 'Orchid', 'orchidee': 'Orchid', 'orchidea': 'Orchid',
    'raisin': 'Grape', 'traube': 'Grape', 'uva': 'Grape',
    'prune': 'Plum', 'pflaume': 'Plum', 'ciruela': 'Plum', 'prugna': 'Plum',
    'mûre': 'Mulberry', 'maulbeere': 'Mulberry', 'mora': 'Mulberry',
    'glycine': 'Wisteria', 'glicina': 'Wisteria', 'glicine': 'Wisteria',
    # Oranges / Yellows / Browns / Neutrals
    'terre cuite': 'Terracotta', 'terracota': 'Terracotta', 'terrakotta': 'Terracotta',
    'orange brûlée': 'Burnt Orange', 'orange brulee': 'Burnt Orange', 'naranja quemado': 'Burnt Orange',
    'arancione bruciato': 'Burnt Orange', 'gebranntes orange': 'Burnt Orange',
    'naranja': 'Orange', 'arancione': 'Orange',
    'papaye': 'Papaya',
    'jonquille': 'Daffodil', 'narzisse': 'Daffodil', 'narciso': 'Daffodil',
    'corail': 'Coral', 'koralle': 'Coral', 'coral': 'Coral', 'corallo': 'Coral',
    'chocolat': 'Chocolate', 'schokolade': 'Chocolate', 'cioccolato': 'Chocolate',
    'czekoladowy': 'Chocolate', 'choklad': 'Chocolate',
    'champán': 'Champagne', 'champagner': 'Champagne', 'szampan': 'Champagne',
    'or': 'Gold', 'oro': 'Gold', 'dorado': 'Gold', 'guld': 'Gold',
    'or rose': 'Rose Gold', 'roségold': 'Rose Gold', 'oro rosa': 'Rose Gold',
    'argent': 'Silver', 'silber': 'Silver', 'plata': 'Silver', 'argento': 'Silver',
    'pavo real': 'Peacock', 'pavone': 'Peacock', 'paon': 'Peacock', 'pfau': 'Peacock',
    'sarcelle': 'Teal', 'verde azulado': 'Teal',
    'beige': 'Beige', 'taupe': 'Taupe',
}


def normalize(v):
    if pd.isna(v):
        return '未标注'
    s = str(v).strip()
    if s.upper() in ('NONE', 'N/A', ''):
        return '未标注'
    key = s.lower()
    if key in TRANS:
        return TRANS[key]
    return s.title() if s.islower() or s.isupper() else s


c['颜色N'] = c['颜色'].apply(normalize)
total = c['数量'].sum()
print(f"归一化: {c['颜色'].nunique()} -> {c['颜色N'].nunique()} 个颜色值")

# 色系归类(粗粒度)
FAMILY = {
    '白/象牙': ['Ivory', 'White'],
    '香槟/金银': ['Champagne', 'Gold', 'Rose Gold', 'Silver'],
    '黑': ['Black'],
    '蓝色系': ['Navy Blue', 'Dark Navy', 'Royal Blue', 'Slate Blue', 'Sky Blue', 'Dusty Blue', 'Ink Blue',
            'Ocean Blue', 'Light Blue', 'Teal', 'Peacock', 'Pool', 'Spa', 'Mist', 'Stormy', 'Regency', 'Blue'],
    '红/酒红': ['Burgundy', 'Cabernet', 'Red', 'Vermilion', 'Watermelon', 'Rust', 'Wine'],
    '粉色系': ['Dusty Rose', 'Blush', 'Blushing Pink', 'Blush Pink', 'Pearl Pink', 'Candy Pink', 'Hot Pink',
            'Pink', 'Cinnamon Rose', 'Dusky Pink', 'Lolly Pink', 'Petal', 'Coral', 'Peach', 'Blusher'],
    '紫色系': ['Vintage Mauve', 'Mauve', 'Lilac', 'Lavender', 'Orchid', 'Grape', 'Plum', 'Mulberry',
            'Wisteria', 'Fuchsia', 'Purple', 'Eggplant'],
    '绿色系': ['Olive Green', 'Sage Green', 'Celadon', 'Hunter Green', 'Forest Green', 'Emerald',
            'Moss Green', 'Jade', 'Dark Green', 'Mint Green', 'Green', 'Tahiti'],
    '橙/棕/大地': ['Terracotta', 'Burnt Orange', 'Orange', 'Papaya', 'Chocolate', 'Taupe', 'Beige',
              'Brown', 'Cinnamon', 'Caramel', 'Daffodil', 'Gold Yellow', 'Yellow', 'Dusk'],
    '按图/其他': ['As Picture', '未标注'],
}
f_map = {col: fam for fam, cols in FAMILY.items() for col in cols}
c['色系'] = c['颜色N'].map(f_map).fillna('其他具体色')

# ===== 表1: 全品类颜色汇总(Top30) =====
t1 = c.groupby('颜色N').agg(销量件数=('数量', 'sum'), 动销SPU数=('SPU', 'nunique')).sort_values('销量件数', ascending=False)
t1['销量占比'] = t1['销量件数'] / total
t1['累计占比'] = t1['销量占比'].cumsum()
print('\n=== 全品类颜色 Top30 ===')
print(t1.head(30).round(3).to_string())

# ===== 表2: 全品类色系汇总 =====
t2 = c.groupby('色系').agg(销量件数=('数量', 'sum')).sort_values('销量件数', ascending=False)
t2['销量占比'] = t2['销量件数'] / total
print('\n=== 全品类色系 ===')
print(t2.round(3).to_string())

# ===== 表3: 各子品类 Top8 颜色 =====
print('\n=== 各子品类 Top8 颜色 ===')
rows = []
for sub, g in c.groupby('子品类'):
    gt = g.groupby('颜色N')['数量'].sum().sort_values(ascending=False)
    st = gt.sum()
    row = {'子品类': sub, '销量': int(st)}
    for i, (col, q) in enumerate(gt.head(8).items(), 1):
        row[f'Top{i}'] = f'{col} {q/st:.0%}'
    rows.append(row)
t3 = pd.DataFrame(rows).sort_values('销量', ascending=False)
print(t3.to_string(index=False))

# ===== 表4: 子品类 × 色系占比矩阵 =====
t4 = c.pivot_table(index='子品类', columns='色系', values='数量', aggfunc='sum', fill_value=0)
t4 = t4.div(t4.sum(axis=1), axis=0)
order = ['白/象牙', '香槟/金银', '黑', '蓝色系', '绿色系', '粉色系', '紫色系', '红/酒红', '橙/棕/大地', '按图/其他', '其他具体色']
t4 = t4[[o for o in order if o in t4.columns]]
t4 = t4.loc[t3['子品类']]
print('\n=== 子品类 × 色系占比 ===')
print((t4 * 100).round(1).to_string())

# 导出
with pd.ExcelWriter(OUT + '颜色汇总_2026年8月.xlsx', engine='openpyxl') as w:
    t1.reset_index().to_excel(w, sheet_name='全品类颜色汇总', index=False)
    t2.reset_index().to_excel(w, sheet_name='全品类色系汇总', index=False)
    t3.to_excel(w, sheet_name='子品类Top颜色', index=False)
    t4.reset_index().to_excel(w, sheet_name='子品类×色系矩阵', index=False)
    # 每个子品类的完整颜色明细
    det = c.groupby(['子品类', '颜色N']).agg(销量件数=('数量', 'sum'), 动销SPU数=('SPU', 'nunique')).reset_index()
    det['子品类内占比'] = det['销量件数'] / det.groupby('子品类')['销量件数'].transform('sum')
    det.sort_values(['子品类', '销量件数'], ascending=[True, False]).to_excel(w, sheet_name='子品类颜色明细', index=False)
print('\nExcel 已导出')
