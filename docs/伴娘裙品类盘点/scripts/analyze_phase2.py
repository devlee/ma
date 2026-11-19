"""伴娘裙品类盘点 · 第二阶段分析复现脚本（流量转化 / 订单结构 / 尺码 / 颜色 / 复购）。

用法（在仓库根目录）:
    pip install pandas openpyxl
    python docs/伴娘裙品类盘点/scripts/analyze_phase2.py

输入:
    数据/伴娘裙盘点补充拉数据5_流量.csv        站点 × 月 详情页 UV / 类目页 UV / 自然流量
    数据/伴娘裙盘点补充拉数据5_加购订单.csv    站点 × 月 加购 / 下单 / 件数 / 销售额
    数据/伴娘裙盘点补充拉数据6_订单明细.csv    伴娘裙订单明细（行 = 订单 × SPU × 颜色 × 尺码）
    数据/伴娘裙盘点补充拉数据1_4.xlsx           Sheet5 SPU 属性（领型 / 袖型 / 面料 / 是否有大码图 / 售价）
输出: 终端打印报告中各表对应的数字。
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "数据"

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 200)

ANOMALY_MONTHS = {"2026-08", "2026-09"}  # 自然流量异常月，转化率分析剔除
PLUS_US = 16  # 大码定义：US 16 及以上


def ym(v: str) -> str:
    v = str(v)
    if m := re.match(r"(\d{4})-(\d{2})", v):
        return f"{m.group(1)}-{m.group(2)}"
    return pd.to_datetime(v, format="%b-%y").strftime("%Y-%m")


def section(title: str) -> None:
    print("\n" + "=" * 100 + f"\n{title}\n" + "=" * 100)


# ----------------------------------------------------------------------------------------------
# 载入
# ----------------------------------------------------------------------------------------------
def load():
    tr = pd.read_csv(DATA / "伴娘裙盘点补充拉数据5_流量.csv", encoding="utf-8-sig")
    cart = pd.read_csv(DATA / "伴娘裙盘点补充拉数据5_加购订单.csv", encoding="utf-8-sig")
    for d in (tr, cart):
        d["ym"] = d["月份"].map(ym)
        d["yr"] = d["ym"].str[:4]
        d["mo"] = d["ym"].str[5:]

    od = pd.read_csv(DATA / "伴娘裙盘点补充拉数据6_订单明细.csv", encoding="utf-8-sig", dtype={"邮编前缀(前3位)": str})
    od["下单日期"] = pd.to_datetime(od["下单日期"])
    od["ym"] = od["下单日期"].dt.strftime("%Y-%m")
    od["yr"] = od["下单日期"].dt.year
    od["尺码"] = od["尺码"].astype(str)
    # 注意：原表"是否定制尺寸"字段取反，以尺码 == custom 为准
    od["custom"] = od["尺码"].eq("custom")
    od["W"] = od["尺码"].str.endswith("W")
    num = pd.to_numeric(od["尺码"].str.rstrip("W"), errors="coerce")
    offset = od["尺码单位"].map({"US": 0, "UK": -4, "AU": -4, "EU": -32})
    od["us"] = np.where(od["W"], num, num + offset)  # W 码直接按 US 数字
    od["plus"] = (~od["custom"]) & (od["us"] >= PLUS_US)
    od["fam"] = od["颜色"].map(color_family)

    attr = pd.read_excel(DATA / "伴娘裙盘点补充拉数据1_4.xlsx", sheet_name="Sheet5").set_index("SPU")
    return tr, cart, od, attr


COLOR_FAMILY = {
    "Blue": ["Dusty Blue", "Sky Blue", "Light Blue", "Navy Blue", "Dark Navy", "Ink Blue", "Royal Blue", "Ocean Blue",
             "Slate Blue", "Peacock", "Regency", "Stormy", "Steel Grey"],
    "Green": ["Sage Green", "Olive Green", "Celadon", "Emerald", "Forest Green", "Hunter Green", "Dark Green",
              "Moss Green", "Mint Green", "Jade", "Teal", "Spa", "Pool"],
    "Pink/Rose": ["Dusty Rose", "Blush", "Blushing Pink", "Candy Pink", "Hot Pink", "Pearl Pink", "Cinnamon Rose",
                  "Dusk", "Mauve", "Vintage Mauve", "Mulberry", "Fuchsia", "Orchid", "Petal", "Rose Gold", "Watermelon"],
    "Red/Burgundy": ["Burgundy", "Cabernet", "Red", "Vermilion", "Grape", "Plum"],
    "Orange/Earth": ["Burnt Orange", "Terracotta", "Chocolate", "Coral", "Orange", "Papaya", "Tahiti", "Daffodil"],
    "Neutral/Metallic": ["Champagne", "Ivory", "White", "Beige", "Taupe", "Gold", "Silver", "Mist"],
    "Purple": ["Lavender", "Lilac", "Wisteria"],
    "Black": ["Black"],
}
_C2F = {c: f for f, cs in COLOR_FAMILY.items() for c in cs}


def color_family(c: str) -> str:
    return _C2F.get(c, "Other")


# ----------------------------------------------------------------------------------------------
# 01 流量与转化
# ----------------------------------------------------------------------------------------------
def funnel(df: pd.DataFrame, by) -> pd.DataFrame:
    g = df.groupby(by).agg(
        pdp=("商品详情页UV", "sum"), organic=("自然流量UV", "sum"), cartp=("加购人数(uuid)", "sum"),
        orders=("下单数(含伴娘裙订单数)", "sum"), units=("伴娘裙下单件数", "sum"),
    )
    g["加购率%"] = (g["cartp"] / g["pdp"] * 100).round(2)
    g["下单转化率%"] = (g["orders"] / g["pdp"] * 100).round(2)
    g["加购→下单%"] = (g["orders"] / g["cartp"] * 100).round(1)
    g["自然占比%"] = (g["organic"] / g["pdp"] * 100).round(1)
    g["件/单"] = (g["units"] / g["orders"]).round(2)
    return g


def sec01_traffic(tr, cart):
    section("01 流量与转化")
    f = tr.merge(cart, on=["ym", "站点", "yr", "mo"])
    print("\n[2026-07~10 US 流量异常]")
    print(f[(f["站点"] == "US") & f["ym"].isin(["2026-07", "2026-08", "2026-09", "2026-10"])]
          [["ym", "商品详情页UV", "自然流量UV", "加购人数(uuid)", "下单数(含伴娘裙订单数)"]].to_string(index=False))
    print("\n[类目页 UV 首个非零月]", tr.loc[tr["类目页UV"] > 0, "ym"].min())

    sub = f[(f["mo"] <= "10") & ~f["ym"].str[5:].isin({m[5:] for m in ANOMALY_MONTHS})]
    print("\n[全站漏斗 1–10 月，剔除 8–9 月]")
    g = funnel(sub, "yr")
    print(g.to_string())
    print("UV 同比 %.1f%%  件数同比 %.1f%%" % ((g.loc["2026", "pdp"] / g.loc["2025", "pdp"] - 1) * 100,
                                             (g.loc["2026", "units"] / g.loc["2025", "units"] - 1) * 100))

    print("\n[分站点漏斗 2026（同口径）]")
    s26 = funnel(sub[sub["yr"] == "2026"], "站点").sort_values("下单转化率%", ascending=False)
    print(s26.to_string())
    print("\n[分站点 2025 → 2026 变化]")
    s = funnel(sub, ["站点", "yr"]).unstack()
    out = pd.DataFrame({
        "UV同比%": ((s[("pdp", "2026")] / s[("pdp", "2025")] - 1) * 100).round(0),
        "件数同比%": ((s[("units", "2026")] / s[("units", "2025")] - 1) * 100).round(0),
        "转化率25": s[("下单转化率%", "2025")], "转化率26": s[("下单转化率%", "2026")],
        "加购率25": s[("加购率%", "2025")], "加购率26": s[("加购率%", "2026")],
    })
    print(out.to_string())


# ----------------------------------------------------------------------------------------------
# 02 订单结构与伴娘团识别
# ----------------------------------------------------------------------------------------------
def sec02_orders(od):
    section("02 订单结构")
    orders = od.groupby("订单号").agg(site=("站点", "first"), yr=("yr", "first"), units=("件数", "sum"),
                                     amt=("订单伴娘裙金额", "first"), paid=("订单实付金额", "first"),
                                     same_style=("是否多件同款", "first"), same_color=("是否多件同款同色", "first"))
    print("订单数", len(orders), "件数", orders["units"].sum(), "客户数", od["客户ID(脱敏)"].nunique())
    print("单均伴娘裙金额 $%.1f  单均实付 $%.1f" % (orders["amt"].mean(), orders["paid"].mean()))
    for yr in (2025, 2026):
        o = orders[orders["yr"] == yr]
        print(f"{yr}: 件/单 {o['units'].mean():.2f}  单件订单占比 {(o['units'] == 1).mean() * 100:.1f}%  "
              f"多件订单贡献件数占比 {o.loc[o['units'] > 1, 'units'].sum() / o['units'].sum() * 100:.1f}%")
    multi = orders[orders["units"] > 1]
    print("多件订单 %d：同款 %.0f%%  同款同色 %.0f%%" % (len(multi), (multi["same_style"] == "是").mean() * 100,
                                                      (multi["same_color"] == "是").mean() * 100))
    print("\n[分站点订单结构 2025-01~2026-11]")
    bs = orders.groupby("site").apply(lambda o: pd.Series({
        "订单数": len(o), "件/单": round(o["units"].mean(), 2),
        "多件订单%": round((o["units"] > 1).mean() * 100, 1),
        "多件中同款同色%": round((o.loc[o["units"] > 1, "same_color"] == "是").mean() * 100, 0),
    })).sort_values("件/单", ascending=False)
    print(bs.to_string())

    section("02b 疑似婚礼识别")
    d = od.dropna(subset=["邮编前缀(前3位)"]).sort_values("下单日期").copy()
    for label, geo in (("zip3 口径（下限）", "邮编前缀(前3位)"), ("省州口径（上限）", "收货省州")):
        d["key"] = d["站点"] + "|" + d["SPU"] + "|" + d["颜色"] + "|" + d[geo].astype(str)
        # 同 key 内，与上一单间隔 >30 天则开新簇
        gap = d.groupby("key")["下单日期"].diff().dt.days
        d["cl"] = d["key"] + "|" + (gap.isna() | (gap > 30)).groupby(d["key"]).cumsum().astype(str)
        c = d.groupby("cl").agg(units=("件数", "sum"), custs=("客户ID(脱敏)", "nunique"))
        print(f"\n{label}: 簇数 {len(c)}  每簇件数 {c['units'].mean():.2f}  "
              f"单件簇占比 {(c['units'] == 1).mean() * 100:.1f}%（占件数 {c.loc[c['units'] == 1, 'units'].sum() / c['units'].sum() * 100:.0f}%）  "
              f"多客户簇占比 {(c['custs'] > 1).mean() * 100:.1f}%（占件数 {c.loc[c['custs'] > 1, 'units'].sum() / c['units'].sum() * 100:.1f}%）")


# ----------------------------------------------------------------------------------------------
# 03 尺码
# ----------------------------------------------------------------------------------------------
def size_stats(g: pd.DataFrame) -> pd.Series:
    u = g["件数"].sum()
    std = g.loc[~g["custom"], "件数"].sum()
    return pd.Series({
        "件数": u,
        "定制%": round(g.loc[g["custom"], "件数"].sum() / u * 100, 1),
        "大码占标准码%": round(g.loc[g["plus"], "件数"].sum() / std * 100, 1) if std else np.nan,
    })


def sec03_sizes(od, attr):
    section("03 尺码")
    print("[总体]")
    print(pd.DataFrame({"全部": size_stats(od), **{str(y): size_stats(od[od["yr"] == y]) for y in (2025, 2026)}}).to_string())
    std = od[~od["custom"]]
    print("大码占总件数 %.1f%%  W 码占标准码 %.1f%%" % (od.loc[od["plus"], "件数"].sum() / od["件数"].sum() * 100,
                                                  std.loc[std["W"], "件数"].sum() / std["件数"].sum() * 100))

    print("\n[2026 分站点]")
    o26 = od[od["yr"] == 2026]
    print(o26.groupby("站点").apply(size_stats).sort_values("大码占标准码%", ascending=False).to_string())

    print("\n[2026 标准码分布（折算 US 码，% of 标准码件数）]")
    s26 = o26[~o26["custom"]]
    dist = s26.pivot_table(index="us", columns="站点", values="件数", aggfunc="sum").fillna(0)
    dist = (dist / dist.sum() * 100).round(1)
    print(dist.to_string())
    band = pd.cut(s26["us"], [-1, 2, 6, 10, 14, 18, 22, 99], labels=["0-2", "4-6", "8-10", "12-14", "16-18", "20-22", "24+"])
    bd = s26.groupby([band, "站点"], observed=True)["件数"].sum().unstack().fillna(0)
    print("\n[尺码段分布 %]")
    print((bd / bd.sum() * 100).round(1).to_string())

    print("\n[大码图 × 大码占比（2026）]")
    o = o26.join(attr[["是否有大码图", "售价", "领型(Neckline)", "袖型(Sleeve)", "面料(Fabric)", "裙型(Silhouette)"]], on="SPU")
    print(o.groupby("是否有大码图").apply(size_stats).to_string())
    spu = o.groupby("SPU").apply(size_stats).join(attr["是否有大码图"])
    big = spu[spu["件数"] >= 30]
    print("SPU 级中位数（≥30 件，%d 款）:" % len(big))
    print(big.groupby("是否有大码图")[["定制%", "大码占标准码%"]].median().to_string())

    print("\n[定制码异常 SPU（2026 ≥30 件）]")
    big = big.join(attr["售价"])
    print(big.sort_values("定制%", ascending=False).head(12).to_string())
    print(big.sort_values("定制%").head(5).to_string())

    print("\n[大码占标准码 × 属性（2026）]")
    o["面料族"] = o["面料(Fabric)"].str.extract(r"^(Chiffon|Elastic Satin|Satin|Velvet|Tulle|Lace|Sequin)")[0]
    for col in ["领型(Neckline)", "袖型(Sleeve)", "面料族", "裙型(Silhouette)"]:
        t = o.groupby(col).apply(size_stats)
        print(t[t["件数"] >= 300].sort_values("大码占标准码%", ascending=False).to_string(), "\n")
    print("[Top 款大码占比]")
    print(spu.loc[spu.index.intersection(["SBD10628", "SBD10929", "SBD11458", "SBD11657", "SBD11724", "SBD10001"])].to_string())


# ----------------------------------------------------------------------------------------------
# 04 颜色
# ----------------------------------------------------------------------------------------------
def sec04_colors(od):
    section("04 颜色")
    o26 = od[od["yr"] == 2026]
    sh = o26.groupby("颜色")["件数"].sum().sort_values(ascending=False) / o26["件数"].sum() * 100
    print("2026 售出颜色数 %d  第一色 %s %.1f%%  Top10 %.0f%%  Top20 %.0f%%" % (len(sh), sh.index[0], sh.iloc[0], sh.head(10).sum(), sh.head(20).sum()))
    print(sh.head(12).round(1).to_string())
    hero = o26[o26["SPU"] == "SBD10628"].groupby("颜色")["件数"].sum().sort_values(ascending=False)
    print("SBD10628 售出颜色数 %d，凑到 50%% 需要前 %d 色" % (len(hero), (hero.cumsum() / hero.sum() < 0.5).sum() + 1))

    print("\n[色系份额 % 2025 vs 2026]")
    fam = od.pivot_table(index="fam", columns="yr", values="件数", aggfunc="sum")
    fam = (fam / fam.sum() * 100).round(1)
    fam["变化pt"] = (fam[2026] - fam[2025]).round(1)
    print(fam.sort_values(2026, ascending=False).to_string())

    print("\n[伴娘主力色份额 %（2026）]")
    key = ["Dusty Blue", "Sage Green", "Dusty Rose", "Navy Blue", "Burgundy", "Champagne", "Black", "Terracotta", "Burnt Orange", "Chocolate"]
    yr = od.pivot_table(index="颜色", columns="yr", values="件数", aggfunc="sum")
    yr = (yr / yr.sum() * 100).round(1)
    print(yr.loc[key].to_string())

    print("\n[季节性：2026 各月份额 %]")
    mo = o26.pivot_table(index="颜色", columns="ym", values="件数", aggfunc="sum").fillna(0)
    mo = (mo / mo.sum() * 100).round(1)
    print(mo.loc[["Burgundy", "Terracotta", "Chocolate", "Champagne", "Dusty Rose", "Black"]].to_string())

    print("\n[分站点 Top5 颜色 2026]")
    for site in ["US", "GB", "FR", "AU"]:
        s = o26[o26["站点"] == site].groupby("颜色")["件数"].sum().sort_values(ascending=False)
        print(site, ", ".join(f"{c} {v / s.sum() * 100:.1f}%" for c, v in s.head(5).items()))


# ----------------------------------------------------------------------------------------------
# 05 复购
# ----------------------------------------------------------------------------------------------
def sec05_repurchase(od):
    section("05 复购（观察期满 12 个月的客户）")
    m = od[od["复购观察期是否满12个月"] == "是"].sort_values("下单日期")
    c = m.groupby("客户ID(脱敏)").agg(site=("站点", "first"), first=("下单日期", "min"),
                                       rep=("12个月内是否复购", lambda s: (s == "是").any()),
                                       other=("12个月内是否买其他品类", lambda s: (s == "是").any()),
                                       rep_date=("首次复购日期", "first"))
    print("客户数 %d  12 个月复购 %.1f%%  买其他品类 %.1f%%  只复购伴娘裙 %.1f%%" % (
        len(c), c["rep"].mean() * 100, c["other"].mean() * 100, (c["rep"] & ~c["other"]).mean() * 100))
    r = c[c["rep"]].copy()
    r["days"] = (pd.to_datetime(r["rep_date"], errors="coerce") - r["first"]).dt.days
    print("复购间隔中位数 %.0f 天；30 天内 %.0f%%；90 天内 %.0f%%" % (r["days"].median(), (r["days"] <= 30).mean() * 100, (r["days"] <= 90).mean() * 100))
    print(c.groupby("site").agg(客户数=("rep", "size"), 复购率=("rep", "mean"), 跨品类=("other", "mean")).mul([1, 100, 100]).round(1).to_string())


# ----------------------------------------------------------------------------------------------
# 06 CA 站 SBD10628
# ----------------------------------------------------------------------------------------------
def sec06_ca(od):
    section("06 CA 站 SBD10628")
    ca = od[od["站点"] == "CA"].copy()
    ca["q"] = ca["下单日期"].dt.to_period("Q").astype(str)
    t = ca.pivot_table(index="q", columns=ca["SPU"].eq("SBD10628").map({True: "SBD10628", False: "其他SPU"}), values="件数", aggfunc="sum").fillna(0)
    print(t.to_string())
    h = ca[ca["SPU"] == "SBD10628"]
    print("SBD10628 CA 均价 2025 $%.0f / 2026 $%.0f" % ((h[h.yr == 2025]["明细金额"] / h[h.yr == 2025]["件数"]).mean(), (h[h.yr == 2026]["明细金额"] / h[h.yr == 2026]["件数"]).mean()))


if __name__ == "__main__":
    tr, cart, od, attr = load()
    sec01_traffic(tr, cart)
    sec02_orders(od)
    sec03_sizes(od, attr)
    sec04_colors(od)
    sec05_repurchase(od)
    sec06_ca(od)
