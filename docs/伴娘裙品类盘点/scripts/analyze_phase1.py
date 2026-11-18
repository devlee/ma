"""伴娘裙品类盘点 · 第一阶段分析复现脚本。

用法（在仓库根目录）:
    pip install pandas openpyxl
    python docs/伴娘裙品类盘点/scripts/analyze_phase1.py

输入:
    数据/伴娘裙品类数据_2026-01至10.csv        2026 年 1–10 月品类大盘 + 站点月度（UTF-8）
    数据/伴娘裙盘点补充拉数据1_4.xlsx           Sheet1 大盘历史 / Sheet2 站点历史 / Sheet3 SPU×月 /
                                               Sheet4 Top200×站点×月 / Sheet5 SPU 属性
输出: 终端打印报告中各表对应的数字。
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CSV_2026 = ROOT / "数据" / "伴娘裙品类数据_2026-01至10.csv"
XLSX = ROOT / "数据" / "伴娘裙盘点补充拉数据1_4.xlsx"

pd.set_option("display.width", 220)
pd.set_option("display.max_columns", 40)
pd.set_option("display.max_rows", 200)

PCT_COLS_CAT = ["销量同比增长率", "在全品类的销量占比", "在全品类的销售额占比", "动销率", "top100款的销量占比"]
PCT_COLS_SITE = [
    "在该站点的销量占比", "在该站点的销售额占比", "在伴娘裙品类的销量占比", "在伴娘裙品类的销售额占比",
    "销量同比增长率", "该站点全品类销量/全站全品类销量", "该站点全品类销售额/全站全品类销售额",
]


def ym(v) -> str:
    m = re.match(r"(\d{4})-(\d{2})", str(v))
    return f"{m.group(1)}-{m.group(2)}" if m else str(v)


def pct(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s.astype(str).str.rstrip("%"), errors="coerce") / 100


def load_2026_csv():
    rows = list(csv.reader(open(CSV_2026, encoding="utf-8")))
    cat = pd.DataFrame(rows[1:11], columns=rows[0])
    cat["ym"] = pd.to_datetime(cat["月份"], format="%b-%y").dt.strftime("%Y-%m")
    for c in cat.columns:
        if c in PCT_COLS_CAT:
            cat[c] = pct(cat[c])
        elif c not in ("月份", "ym", "销量占比达50%的spu明细(spu(销量))"):
            cat[c] = pd.to_numeric(cat[c], errors="coerce")

    hdr_idx = next(i for i, r in enumerate(rows) if r and r[0] == "月份" and i > 0)
    hdr = rows[hdr_idx][:14]
    site = pd.DataFrame([r[:14] for r in rows[hdr_idx + 1 :] if r and r[0]], columns=hdr)
    site["ym"] = pd.to_datetime(site["月份"], format="%b-%y").dt.strftime("%Y-%m")
    for c in ["销量", "销售额", "件单价"]:
        site[c] = pd.to_numeric(site[c])
    for c in PCT_COLS_SITE:
        site[c] = pct(site[c])
    return cat, site


def load_history():
    x = pd.read_excel(XLSX, sheet_name=None)
    t1, t2, t3, t4, t5 = (x[f"Sheet{i}"] for i in range(1, 6))
    t1["ym"] = t1["月份"].map(ym)
    t1["销量同比增长率"] = pd.to_numeric(t1["销量同比增长率"], errors="coerce") / 100
    t2["ym"] = t2["月份"].map(ym)
    t2["销量同比增长率"] = pd.to_numeric(t2["销量同比增长率"], errors="coerce") / 100
    t3["ym"] = t3["月份"].map(ym)
    for c in ["上架日期(同步时间)", "首次上架日期", "下架日期(估算)"]:
        t3[c] = pd.to_datetime(t3[c], errors="coerce")
    t4["ym"] = t4["月份"].map(ym)
    t5 = t5.set_index("SPU")
    return t1, t2, t3, t4, t5


def section(title: str):
    print("\n" + "=" * 12 + f" {title} " + "=" * 12)


def main():
    cat26, site26 = load_2026_csv()
    t1, t2, spu, top_site, attr = load_history()

    cat = pd.concat([t1, cat26], ignore_index=True).sort_values("ym").reset_index(drop=True)
    cat["yr"], cat["mo"] = cat["ym"].str[:4], cat["ym"].str[5:7]
    # 2026-11 为半月数据，不参与同比与结构分析
    full = cat[cat["ym"] < "2026-11"].copy()
    full["company"] = full["当月销量"] / full["在全品类的销量占比"]

    # ---------- 01 大盘 ----------
    section("01 大盘：1–10 月销量 / 同比 / 全站同比")
    jo = full[full["mo"] <= "10"].groupby("yr").agg(sales=("当月销量", "sum"), company=("company", "sum"))
    jo["yoy"] = jo["sales"].pct_change().round(3)
    jo["company_yoy"] = jo["company"].pct_change().round(3)
    print(jo)
    print(full.pivot(index="mo", columns="yr", values="当月销量"))
    print((full.pivot(index="mo", columns="yr", values="在全品类的销量占比") * 100).round(1))

    # ---------- 02 增长引擎 ----------
    section("02 增长引擎：2025 Top50 老款 vs 其余款 同比")
    spu["yr"], spu["mo"] = spu["ym"].str[:4], spu["ym"].str[5:7]
    top50 = spu[spu["yr"] == "2025"].groupby("SPU")["当月销量"].sum().nlargest(50).index
    spu["seg"] = np.where(spu["SPU"].isin(top50), "Top50_2025", "Other")
    p = spu[spu["mo"] <= "10"].pivot_table(index="mo", columns=["seg", "yr"], values="当月销量", aggfunc="sum")
    out = pd.DataFrame(
        {
            "Top_yoy": (p[("Top50_2025", "2026")] / p[("Top50_2025", "2025")] - 1).round(2),
            "Other_yoy": (p[("Other", "2026")] / p[("Other", "2025")] - 1).round(2),
        }
    )
    print(out)
    spu["cohort_y"] = spu["首次上架日期"].dt.year.astype(str)
    coh = spu[spu["yr"] == "2026"].pivot_table(index="ym", columns="cohort_y", values="当月销量", aggfunc="sum").fillna(0)
    print((coh.div(coh.sum(axis=1), axis=0) * 100).round(1))

    # ---------- 03 新品 ----------
    section("03 新品：上架后单款月均销量 / 批次质量")
    spu["mdate"] = pd.to_datetime(spu["ym"].str[:7] + "-01", errors="coerce")
    spu["age"] = (spu["mdate"].dt.year - spu["首次上架日期"].dt.year) * 12 + (spu["mdate"].dt.month - spu["首次上架日期"].dt.month)
    spu["coh"] = spu["首次上架日期"].map(lambda d: f"{d.year}{'H1' if d.month <= 6 else 'H2'}")
    new = spu[spu["首次上架日期"] >= "2025-01-01"]
    print(new[new["age"].between(0, 6)].pivot_table(index="age", columns="coh", values="当月销量", aggfunc="mean").round(1))
    first6 = new[new["age"] <= 6].groupby(["coh", "SPU"])["当月销量"].max().reset_index()
    print(
        first6.groupby("coh")["当月销量"].apply(
            lambda s: pd.Series({"n": len(s), "zero": (s == 0).mean().round(2), "ge20": (s >= 20).mean().round(2)})
        ).unstack()
    )
    print(new.groupby(["coh", "SPU"])["现售价"].first().groupby("coh").median())

    # ---------- 04 价格 / 大码图 / 属性 ----------
    section("04 价格带 / 大码图 / 属性效率（2026 年 1–10 月在架款）")
    d26 = spu[(spu["yr"] == "2026") & (spu["ym"] <= "2026-10") & (spu["期末是否在架"] == "是")]
    s = d26.groupby("SPU").agg(months=("ym", "nunique"), sales=("当月销量", "sum"), price=("现售价", "last"), first=("首次上架日期", "first"))
    s["mps"] = s["sales"] / s["months"]
    s["cy"] = s["first"].dt.year
    s = s.join(attr[["裙型(Silhouette)", "长度(Length)", "领型(Neckline)", "袖型(Sleeve)", "面料(Fabric)", "是否有口袋", "是否有大码图"]])
    s["band"] = pd.cut(s["price"], [0, 89, 109, 129, 149, 999], labels=["<90", "90-109", "110-129", "130-149", "150+"])

    def eff(col, minn=15):
        g = s.groupby(col, observed=True).agg(n=("sales", "size"), sales=("sales", "sum"), mps=("mps", "mean"))
        g["share"] = g["sales"] / g["sales"].sum() * 100
        g["n_share"] = g["n"] / g["n"].sum() * 100
        g["idx"] = (g["share"] / g["n_share"]).round(2)
        return g[g["n"] >= minn].round(1).sort_values("idx", ascending=False)

    for c in ["band", "是否有大码图", "裙型(Silhouette)", "长度(Length)", "领型(Neckline)", "袖型(Sleeve)", "面料(Fabric)", "是否有口袋"]:
        print(f"\n-- {c}")
        print(eff(c))
    print("\n-- 大码图 × 上架年份")
    print(s.groupby(["cy", "是否有大码图"]).agg(n=("sales", "size"), mps=("mps", "mean")).round(1))
    print("\n-- 价格带 × 上架年份（单款月均）")
    print(s.pivot_table(index="band", columns="cy", values="mps", aggfunc="mean", observed=True).round(1))

    def fabric_family(f: str) -> str:
        f = str(f)
        if "Chiffon" in f:
            return "雪纺"
        if "Stretch" in f and "Non" not in f:
            return "弹力缎"
        if "Satin" in f or "Charmeuse" in f:
            return "缎"
        return "其他"

    s["combo"] = s["领型(Neckline)"].astype(str) + " × " + s["面料(Fabric)"].map(fabric_family) + " × " + s["长度(Length)"].astype(str)
    g = s.groupby("combo").agg(n=("sales", "size"), sales=("sales", "sum"), new26=("cy", lambda x: (x == 2026).sum()))
    g["share"] = g["sales"] / g["sales"].sum() * 100
    g["idx"] = (g["share"] / (g["n"] / len(s) * 100)).round(2)
    print("\n-- 属性组合效率（款数 ≥ 8）")
    print(g[g["n"] >= 8].sort_values("idx", ascending=False).round(1))

    # ---------- 05 站点 ----------
    section("05 站点：销量 / 同比 / 站点全品类同比 / 渗透率")
    site = pd.concat([t2, site26], ignore_index=True)
    site["yr"], site["mo"] = site["ym"].str[:4], site["ym"].str[5:7]
    site = site[site["ym"] < "2026-11"].copy()
    site["site_total"] = site["销量"] / site["在该站点的销量占比"]
    sj = site[site["mo"] <= "10"].groupby(["站点", "yr"]).agg(b=("销量", "sum"), t=("site_total", "sum"))
    sj["pen"] = (sj["b"] / sj["t"] * 100).round(1)
    bj = sj["b"].unstack()
    tj = sj["t"].unstack()
    print(
        pd.DataFrame(
            {
                "sales26": bj["2026"],
                "share26": (bj["2026"] / bj["2026"].sum() * 100).round(1),
                "yoy26": (bj["2026"] / bj["2025"] - 1).round(2),
                "site_yoy26": (tj["2026"] / tj["2025"] - 1).round(2),
                "pen25": sj["pen"].unstack()["2025"],
                "pen26": sj["pen"].unstack()["2026"],
            }
        ).sort_values("sales26", ascending=False)
    )
    ts = top_site[(top_site["ym"] >= "2026-01") & (top_site["ym"] <= "2026-10")]
    hero2 = ts[ts["SPU"].isin(["SBD10628", "SBD10001"])].groupby("站点")["当月销量"].sum()
    print("\n-- Top2 老款占该站伴娘裙销量")
    print((hero2 / bj["2026"]).round(2))

    # ---------- 06 在架结构 ----------
    section("06 在架结构：近 6 个月（5–10 月）销量分层")
    last6 = spu[(spu["ym"] >= "2026-05") & (spu["ym"] <= "2026-10")].groupby("SPU")["当月销量"].sum()
    cur = spu[spu["ym"] == "2026-11"].set_index("SPU").join(attr[["是否有大码图"]])
    cur["l6"] = last6.reindex(cur.index).fillna(0)
    cur["cy"] = cur["首次上架日期"].dt.year
    cur["seg"] = pd.cut(cur["l6"], [-1, 0, 5, 20, 60, 150, 10_000], labels=["0", "1-5", "6-20", "21-60", "61-150", "150+"])
    seg = cur.groupby("seg", observed=True).agg(n=("l6", "size"), sales=("l6", "sum"))
    seg["share"] = (seg["sales"] / seg["sales"].sum() * 100).round(1)
    print(seg)
    print(pd.crosstab(cur["seg"], cur["cy"]))
    pool = cur[(cur["l6"] >= 6) & (cur["是否有大码图"] == "否")]
    print(f"\n补大码图候选池: {len(pool)} 款, 5–10 月合计销量 {int(pool['l6'].sum())} 件, 月均 {pool['l6'].sum() / 6:.0f} 件")
    mid = cur[cur["l6"].between(6, 60)]
    print("同档位（6–60 件）有无大码图对照（中位数）:")
    print(mid.groupby("是否有大码图")["l6"].agg(["count", "median", "mean"]).round(1))


if __name__ == "__main__":
    main()
