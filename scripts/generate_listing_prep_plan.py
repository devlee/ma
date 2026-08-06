# -*- coding: utf-8 -*-
"""
根据月度上架计划，反推上架准备工作(选款/打分/定款/SPU/作图/同步)的按周排期，
输出 Excel 计划表。

规则要点：
- 复杂品类(妈妈装MBD/婚纱WD, 60%+单个作图): 上架前5周启动选款, 作图3周
- 选款错峰: MBD/WD/Prom 前第5周选款, ED/BD 前第4周, 每周组内选款不超过2个批次
- 常规品类(约30%单个作图): 作图2周; 小批次(≤20款): 前3周合并"选款+打分"(可直接定款)
- CD/JBD 已有50款定款库存: 覆盖 CD 9月批(20款) + JBD 10月批(30款), 直接SPU+作图
- 婚纱来图定制: 每月约20款, 无需选款/打分/定款; 12月-2月WD计划量全部由定制覆盖
- 每周上新: ≥40款按月内各周均摊; 21-39款分2周; ≤20款集中1周
- 撞期批次标注"直接定款候选", 执行时由负责人直接定款错峰
- 春节: 2027/2/5-2/18 放假, 2/8与2/15两周不排工作, 2月批次全部节前完成作图
- 8月为追赶月, 按当前实际进度单独排期
"""
import datetime as dt
import math
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------- 基础数据

CATS = ["MBD", "ED", "WD", "BD", "Prom", "CD", "FG", "JBD"]
CAT_NAMES = {
    "MBD": "妈妈装 Mother of the Bride",
    "ED": "晚礼服 Evening",
    "WD": "婚纱 Bride",
    "BD": "伴娘裙 Bridesmaid",
    "Prom": "舞会裙 Prom",
    "CD": "鸡尾酒裙 Cocktail",
    "FG": "花童裙 Flower Girl",
    "JBD": "小伴娘裙 JBD",
}
COMPLEX_CATS = {"MBD", "WD"}          # 60%以上款需单个作图
SINGLE_RATIO = {c: (0.6 if c in COMPLEX_CATS else 0.3) for c in CATS}

MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]
PLAN = {  # 月度上架计划(款)
    "MBD":  [70, 80, 80, 100, 80, 80, 50],
    "ED":   [40, 40, 40, 60, 50, 40, 30],
    "WD":   [50, 50, 40, 40, 10, 10, 10],
    "BD":   [40, 40, 40, 50, 40, 40, 30],
    "Prom": [0, 0, 0, 20, 40, 40, 0],
    "CD":   [0, 20, 10, 20, 20, 30, 0],
    "FG":   [0, 30, 20, 10, 20, 20, 0],
    "JBD":  [0, 0, 30, 0, 20, 0, 0],
}
WD_CUSTOM_PER_MONTH = 20  # 婚纱来图定制月供给约20款

# 周(周一日期)序列: 2026-08-03 ~ 2027-03-01
FIRST_MONDAY = dt.date(2026, 8, 3)
WEEKS = [FIRST_MONDAY + dt.timedelta(weeks=i) for i in range(31)]
HOLIDAY_WEEKS = {dt.date(2027, 2, 8), dt.date(2027, 2, 15)}  # 春节 2/5-2/18

def W(y, m, d):
    return dt.date(y, m, d)

def wk_label(monday):
    fri = monday + dt.timedelta(days=4)
    return f"{monday.month}/{monday.day}周\n({monday.month}.{monday.day}-{fri.month}.{fri.day})"

def wb_(monday, n):
    return monday - dt.timedelta(weeks=n)

def even_split(qty, weeks):
    n = len(weeks)
    base, rem = divmod(qty, n)
    return {w: base + (1 if i < rem else 0) for i, w in enumerate(weeks)}

SYNC_WEEKS = {
    "2026-08": [W(2026, 8, 10), W(2026, 8, 17), W(2026, 8, 24), W(2026, 8, 31)],
    "2026-09": [W(2026, 9, 7), W(2026, 9, 14), W(2026, 9, 21), W(2026, 9, 28)],
    "2026-10": [W(2026, 10, 5), W(2026, 10, 12), W(2026, 10, 19), W(2026, 10, 26)],
    "2026-11": [W(2026, 11, 2), W(2026, 11, 9), W(2026, 11, 16), W(2026, 11, 23), W(2026, 11, 30)],
    "2026-12": [W(2026, 12, 7), W(2026, 12, 14), W(2026, 12, 21), W(2026, 12, 28)],
    "2027-01": [W(2027, 1, 4), W(2027, 1, 11), W(2027, 1, 18), W(2027, 1, 25)],
    "2027-02": [W(2027, 2, 1), W(2027, 2, 22)],  # 春节: 2/8、2/15两周放假
}

# ------------------------------------------------------- 批次定义
# 每个批次: cat, month, sub(子批次名), qty, sel/score/ding/spu/art 各阶段周,
#           sync {周:款数}, note, flag(直接定款候选原因)

BATCHES = []

def add_batch(cat, month, qty, sel=(), score=(), ding=(), spu=(), art=(),
              sync=None, note="", sub="", flag=""):
    assert sum(sync.values()) == qty, f"{cat} {month} {sub} 同步数与批次量不符"
    BATCHES.append(dict(cat=cat, month=month, sub=sub, qty=qty,
                        sel=list(sel), score=list(score), ding=list(ding),
                        spu=list(spu), art=list(art), sync=sync, note=note, flag=flag))

# 排期模板(相对首个上架周 w0 反推)
def complex_sched(w0):   # MBD/WD选款批: 前5周选款, 作图3周
    return dict(sel=[wb_(w0, 5)], score=[wb_(w0, 4)], ding=[wb_(w0, 4)],
                spu=[wb_(w0, 3)], art=[wb_(w0, 3), wb_(w0, 2), wb_(w0, 1)])

def regular5(w0):        # Prom等: 前5周选款(与ED/BD错峰), 作图2周
    return dict(sel=[wb_(w0, 5)], score=[wb_(w0, 4)], ding=[wb_(w0, 4)],
                spu=[wb_(w0, 3)], art=[wb_(w0, 2), wb_(w0, 1)])

def regular4(w0):        # ED/BD/CD大批: 前4周选款, 作图2周
    return dict(sel=[wb_(w0, 4)], score=[wb_(w0, 3)], ding=[wb_(w0, 3)],
                spu=[wb_(w0, 2)], art=[wb_(w0, 2), wb_(w0, 1)])

def small_sched(w0):     # 小批次: 前3周合并选款+打分+定款
    return dict(sel=[wb_(w0, 3)], score=[wb_(w0, 3)], ding=[wb_(w0, 3)],
                spu=[wb_(w0, 2)], art=[wb_(w0, 2), wb_(w0, 1)])

def nosel_sched(w0):     # 已定款库存 / 来图定制: 直接SPU+作图
    return dict(spu=[wb_(w0, 2)], art=[wb_(w0, 2), wb_(w0, 1)])

# ---- 2026-08 追赶批次(按当前实际进度) ----
add_batch("MBD", "2026-08", 70,
          art=[W(2026, 8, 3), W(2026, 8, 10)],
          sync={W(2026, 8, 10): 20, W(2026, 8, 17): 20, W(2026, 8, 24): 15, W(2026, 8, 31): 15},
          note="已在作图环节, 边作图边滚动上架")
add_batch("ED", "2026-08", 40,
          spu=[W(2026, 8, 3)], art=[W(2026, 8, 3), W(2026, 8, 10)],
          sync={W(2026, 8, 17): 15, W(2026, 8, 24): 15, W(2026, 8, 31): 10},
          note="定款已完成, 本周生成SPU并启动作图")
add_batch("BD", "2026-08", 40,
          ding=[W(2026, 8, 3)], spu=[W(2026, 8, 10)],
          art=[W(2026, 8, 10), W(2026, 8, 17)],
          sync={W(2026, 8, 24): 20, W(2026, 8, 31): 20},
          note="选款打分已完成, 本周内定款")
add_batch("WD", "2026-08", 30, sub="选款",
          sel=[W(2026, 8, 3)], ding=[W(2026, 8, 3)], spu=[W(2026, 8, 10)],
          art=[W(2026, 8, 10), W(2026, 8, 17), W(2026, 8, 24)],
          sync={W(2026, 8, 31): 30},
          note="尚未启动, 本周直接定款(跳过打分); 来图定制覆盖20款后仅需定30款, 如仍延期可部分顺延至9/7周",
          flag="追赶批次, 建议直接定款")
add_batch("WD", "2026-08", 20, sub="来图定制",
          spu=[W(2026, 8, 10)], art=[W(2026, 8, 10), W(2026, 8, 17)],
          sync={W(2026, 8, 24): 20},
          note="来图定制来源, 无需选款打分定款")

# ---- 2026-09 起: 标准节奏 ----

# MBD: 全部复杂批
for month in MONTHS[1:]:
    qty = PLAN["MBD"][MONTHS.index(month)]
    wks = SYNC_WEEKS[month]
    add_batch("MBD", month, qty, sync=even_split(qty, wks),
              note="复杂品类(60%+单个作图), 作图排3周", **complex_sched(wks[0]))

# ED / BD: 前4周选款, 全月均摊
for cat in ["ED", "BD"]:
    for month in MONTHS[1:]:
        qty = PLAN[cat][MONTHS.index(month)]
        wks = SYNC_WEEKS[month]
        add_batch(cat, month, qty, sync=even_split(qty, wks), **regular4(wks[0]))

# WD: 拆分为 选款批(复杂) + 来图定制批
WD_SPLIT = {  # month: (选款量, 定制量)
    "2026-09": (30, 20), "2026-10": (20, 20), "2026-11": (20, 20),
    "2026-12": (0, 10), "2027-01": (0, 10), "2027-02": (0, 10),
}
WD_CUSTOM_SYNC = {  # 定制批集中/均摊上架
    "2026-09": None, "2026-10": None, "2026-11": None,  # None=全月均摊
    "2026-12": {W(2026, 12, 14): 10},
    "2027-01": {W(2027, 1, 4): 10},
    "2027-02": {W(2027, 2, 1): 10},
}
for month, (q_sel, q_cus) in WD_SPLIT.items():
    wks = SYNC_WEEKS[month]
    if q_sel:
        add_batch("WD", month, q_sel, sub="选款", sync=even_split(q_sel, wks),
                  note="复杂品类, 作图排3周; 仅需定款计划量减去定制20款后的部分",
                  **complex_sched(wks[0]))
    sync_c = WD_CUSTOM_SYNC[month] or even_split(q_cus, wks)
    first = min(sync_c)
    add_batch("WD", month, q_cus, sub="来图定制", sync=sync_c,
              note="来图定制来源(月供约20款), 无需选款打分定款", **nosel_sched(first))

# Prom: 11月首批20款走小批次; 12月/1月40款走前5周选款(与ED/BD错峰)
add_batch("Prom", "2026-11", 20, sync={W(2026, 11, 9): 20},
          note="新品类首批, 小批次: 选款打分同周合并", **small_sched(W(2026, 11, 9)))
for month in ["2026-12", "2027-01"]:
    qty = PLAN["Prom"][MONTHS.index(month)]
    wks = SYNC_WEEKS[month]
    add_batch("Prom", month, qty, sync=even_split(qty, wks),
              note="选款提前至前5周, 与ED/BD错峰", **regular5(wks[0]))

# CD: 9月批由已定款库存覆盖; 10-12月小批次; 1月30款前4周选款
add_batch("CD", "2026-09", 20, sync={W(2026, 9, 14): 20},
          note="已定款库存覆盖(50款库存之20款), 直接SPU+作图", **nosel_sched(W(2026, 9, 14)))
add_batch("CD", "2026-10", 10, sync={W(2026, 10, 12): 10},
          note="小批次: 选款打分同周合并, 可直接定款", **small_sched(W(2026, 10, 12)))
add_batch("CD", "2026-11", 20, sync={W(2026, 11, 16): 20},
          note="小批次: 选款打分同周合并, 可直接定款", **small_sched(W(2026, 11, 16)))
add_batch("CD", "2026-12", 20, sync={W(2026, 12, 7): 20},
          note="小批次: 选款打分同周合并, 可直接定款", **small_sched(W(2026, 12, 7)))
add_batch("CD", "2027-01", 30, sync={W(2027, 1, 11): 15, W(2027, 1, 18): 15},
          note="按首个上架周(1/11)前4周选款, 避开12/7选款高峰", **regular4(W(2027, 1, 11)))

# JBD: 10月批由已定款库存覆盖; 12月批小批次
add_batch("JBD", "2026-10", 30, sync={W(2026, 10, 5): 15, W(2026, 10, 19): 15},
          note="已定款库存覆盖(50款库存之30款), 直接SPU+作图", **nosel_sched(W(2026, 10, 5)))
add_batch("JBD", "2026-12", 20, sync={W(2026, 12, 28): 20},
          note="小批次: 选款打分同周合并",
          flag="定款周(12/7)与ED/BD 1月批选款撞期, 建议直接定款",
          **small_sched(W(2026, 12, 28)))

# FG: 各批次定款/选款周均与大批次选款撞期 → 全部标注直接定款候选
add_batch("FG", "2026-09", 30, sync={W(2026, 9, 7): 15, W(2026, 9, 21): 15},
          note="", flag="选款周(8/10)与ED/BD 9月批撞期, 建议直接定款",
          **regular4(W(2026, 9, 7)))
add_batch("FG", "2026-10", 20, sync={W(2026, 10, 26): 20},
          note="小批次: 选款打分同周合并",
          flag="定款周(10/5)与ED/BD 11月批选款撞期, 建议直接定款",
          **small_sched(W(2026, 10, 26)))
add_batch("FG", "2026-11", 10, sync={W(2026, 11, 23): 10},
          note="小批次: 选款打分同周合并",
          flag="定款周(11/2)与MBD/Prom 12月批选款撞期, 建议直接定款",
          **small_sched(W(2026, 11, 23)))
add_batch("FG", "2026-12", 20, sync={W(2026, 12, 21): 20},
          note="小批次: 选款打分同周合并",
          flag="定款周(11/30)与MBD/Prom 1月批选款撞期, 建议直接定款",
          **small_sched(W(2026, 12, 21)))
add_batch("FG", "2027-01", 20, sync={W(2027, 1, 25): 20},
          note="小批次: 选款打分同周合并",
          flag="定款周(1/4)与ED/BD 2月批选款撞期, 建议直接定款",
          **small_sched(W(2027, 1, 25)))

# 校验: 各月合计
for m_idx, month in enumerate(MONTHS):
    total = sum(b["qty"] for b in BATCHES if b["month"] == month)
    expect = sum(PLAN[c][m_idx] for c in CATS)
    assert total == expect, f"{month}: {total} != {expect}"

# ---------------------------------------------------------------- 样式

THIN = Side(style="thin", color="D0D0D0")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HDR_FILL = PatternFill("solid", fgColor="4472C4")
HDR_FONT = Font(bold=True, color="FFFFFF", size=10)
BASE_FONT = Font(size=10)
BOLD = Font(bold=True, size=10)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)

STAGE_FILL = {
    "选款": PatternFill("solid", fgColor="BDD7EE"),
    "打分": PatternFill("solid", fgColor="FFE699"),
    "定款": PatternFill("solid", fgColor="F8CBAD"),
    "SPU": PatternFill("solid", fgColor="D9D2E9"),
    "作图": PatternFill("solid", fgColor="C9DAF8"),
    "上架": PatternFill("solid", fgColor="C6EFCE"),
    "假期": PatternFill("solid", fgColor="E7E6E6"),
    "候选": PatternFill("solid", fgColor="FFC7CE"),
}

def style_header(cell):
    cell.fill = HDR_FILL
    cell.font = HDR_FONT
    cell.alignment = CENTER
    cell.border = BORDER

def style_cell(cell, align=CENTER, font=BASE_FONT):
    cell.alignment = align
    cell.border = BORDER
    cell.font = font

# ---------------------------------------------------------------- 生成工作簿

wb = Workbook()

# ===== Sheet 1: 说明与规则 =====
ws = wb.active
ws.title = "说明与规则"
rules = [
    ("目的", "根据 2026-08 ~ 2027-02 月度上架计划, 反推选款/打分/定款/生成SPU/作图/同步(上架)各环节的按周节点安排, 保证每月上架量按周均匀完成。"),
    ("周定义", "以周一日期标识一周(工作周为周一至周五)。"),
    ("环节耗时", "选款 3-5个工作日(量大取5天); 打分 2-3个工作日, 打分完成当周内定款; 生成SPU 2-3个工作日; 作图: 常规品类约2周(约30%款单个制作), 妈妈装/婚纱约3周(60%以上款单个制作)。"),
    ("反推提前量与选款错峰", "妈妈装/婚纱/舞会裙: 上架前第5周启动选款; 晚礼服/伴娘裙: 前第4周; 小批次(≤20款): 前第3周合并选款+打分。经错峰后每周组内选款不超过2个大批次。"),
    ("已定款库存", "CD/JBD 现有50款已定款: 覆盖 CD 9月批(20款) + JBD 10月批(30款), 这两批跳过选款/打分/定款, 直接生成SPU+作图。如实际分配不同可在表中调整。"),
    ("婚纱来图定制", "婚纱每月约20款新品来自来图定制, 无需选款/打分/定款。9-11月婚纱拆为\"选款批+来图定制批\"两行; 12月-2月计划量(各10款)全部由定制覆盖, 无需选款。8月婚纱需紧急定款量由50款降为30款。"),
    ("直接定款候选", "甘特表\"直接定款建议\"列(红色)标注了选款/定款周与其他大批次选款撞期的批次(FG各批、JBD 12月批、WD 8月批), 执行时若当周人力排不开, 由负责人直接定款, 整体可再压缩1周。"),
    ("上架节奏", "每周上新: 月量≥40款的品类按月内各周均摊; 21-39款分2周; ≤20款集中1周上架(各品类错开周次, 平衡周上架总量)。"),
    ("选款产能", "选款池按定款量的1.5倍备选(可调); 人均选款产能: 大批次(≥40款)一人每周40款, 小批次一人每周20款。详见\"产能与作图拆解\"表。"),
    ("作图产能", "单个制作: 1名设计师2款/天, 即10款/人·周, 共10人, 理论上限100款/周; 但目前实际分配给新款的量约30款/周(设计师另有其他需求, 有调整空间)。批量制作: 约20款/天, 满投入上限100款/周(批量线还承担在架款图片迭代, 可调整)。来图定制款按批量线处理。批次作图量按其作图周期(2-3周)均摊计算每周负荷, 详见\"作图负荷vs产能\"表: 超过当前投放30款/周的周需提前与设计团队协调加量。排期保守地要求每批作图在首个上架周前全部完成(留缓冲), 因此每月月初周作图负荷很低; 高负荷周可把当月靠后周次上架款的作图顺延到月初空档周削峰。"),
    ("春节安排", "假设 2027/2/5-2/18 放假14天(以公司通知为准), 2/8周与2/15周不排任何工作。2月120款全部于 1/29(节前)完成作图, 分 2/1周(65款)与 2/22周(55款)两次上架。"),
    ("2027-03 批次提示", "受春节影响, 3月批次(量待定)中妈妈装需提前: 1/18-1/29 完成选款打分定款, 节前完成SPU并启动作图, 节后 2/22周 收尾作图, 3月第1周正常上架; 常规品类节后 2/22周 立即选款(或直接定款); 婚纱可优先用来图定制款过渡。"),
    ("8月追赶(当前进度)", "BD: 选款打分已完成→本周定款; ED: 已定款→本周SPU+作图; MBD: 作图中→8/10周起滚动上架; WD: 未启动→本周直接定款30款(来图定制另覆盖20款), 8/24周起上架, 必要时部分顺延至9月第1周。8月上架量后置明显(8/24、8/31两周合计145款), 属追赶期特殊情况。"),
    ("图例", "选款=浅蓝, 打分=黄色, 定款=橙色, 生成SPU=浅紫, 作图=蓝紫, 上架=绿色, 春节假期=灰色, 直接定款候选=红色。"),
]
ws.column_dimensions["A"].width = 20
ws.column_dimensions["B"].width = 120
c = ws.cell(row=1, column=1, value="上架准备工作按周排期 — 说明与规则 (2026-08 ~ 2027-02)")
c.font = Font(bold=True, size=13)
r = 3
for k, v in rules:
    kc = ws.cell(row=r, column=1, value=k)
    vc = ws.cell(row=r, column=2, value=v)
    style_cell(kc, LEFT, BOLD)
    style_cell(vc, LEFT)
    ws.row_dimensions[r].height = max(28, 14 * (len(v) // 60 + 1))
    r += 1

# ===== Sheet 2: 月度上架计划 =====
ws = wb.create_sheet("月度上架计划")
ws.cell(row=1, column=1, value="品类")
for j, m in enumerate(MONTHS):
    ws.cell(row=1, column=2 + j, value=m)
ws.cell(row=1, column=2 + len(MONTHS), value="合计")
for cell in ws[1]:
    if cell.value:
        style_header(cell)
for i, cat in enumerate(CATS):
    r = 2 + i
    c = ws.cell(row=r, column=1, value=CAT_NAMES[cat])
    style_cell(c, LEFT, BOLD)
    for j in range(len(MONTHS)):
        cc = ws.cell(row=r, column=2 + j, value=PLAN[cat][j] or "")
        style_cell(cc)
    tc = ws.cell(row=r, column=2 + len(MONTHS), value=sum(PLAN[cat]))
    style_cell(tc, CENTER, BOLD)
r = 2 + len(CATS)
c = ws.cell(row=r, column=1, value="月合计")
style_cell(c, LEFT, BOLD)
for j in range(len(MONTHS)):
    cc = ws.cell(row=r, column=2 + j, value=sum(PLAN[c2][j] for c2 in CATS))
    style_cell(cc, CENTER, BOLD)
tc = ws.cell(row=r, column=2 + len(MONTHS), value=sum(sum(PLAN[c2]) for c2 in CATS))
style_cell(tc, CENTER, BOLD)
ws.column_dimensions["A"].width = 28
for j in range(len(MONTHS) + 1):
    ws.column_dimensions[get_column_letter(2 + j)].width = 10

# ===== Sheet 3: 每周上架拆解 =====
ws = wb.create_sheet("每周上架拆解")
sync_week_list = [w for w in WEEKS if any(w in b["sync"] for b in BATCHES) or w in HOLIDAY_WEEKS]
ws.cell(row=1, column=1, value="品类")
for j, w in enumerate(sync_week_list):
    hc = ws.cell(row=1, column=2 + j, value=wk_label(w))
    style_header(hc)
style_header(ws.cell(row=1, column=1))
tc = ws.cell(row=1, column=2 + len(sync_week_list), value="合计")
style_header(tc)
for i, cat in enumerate(CATS):
    r = 2 + i
    c = ws.cell(row=r, column=1, value=CAT_NAMES[cat])
    style_cell(c, LEFT, BOLD)
    row_total = 0
    for j, w in enumerate(sync_week_list):
        qty = sum(b["sync"].get(w, 0) for b in BATCHES if b["cat"] == cat)
        row_total += qty
        cc = ws.cell(row=r, column=2 + j, value=qty or "")
        style_cell(cc)
        if w in HOLIDAY_WEEKS:
            cc.fill = STAGE_FILL["假期"]
        elif qty:
            cc.fill = STAGE_FILL["上架"]
    tc = ws.cell(row=r, column=2 + len(sync_week_list), value=row_total)
    style_cell(tc, CENTER, BOLD)
r = 2 + len(CATS)
c = ws.cell(row=r, column=1, value="周合计")
style_cell(c, LEFT, BOLD)
grand = 0
for j, w in enumerate(sync_week_list):
    qty = sum(b["sync"].get(w, 0) for b in BATCHES)
    grand += qty
    cc = ws.cell(row=r, column=2 + j, value=qty if w not in HOLIDAY_WEEKS else "春节")
    style_cell(cc, CENTER, BOLD)
    if w in HOLIDAY_WEEKS:
        cc.fill = STAGE_FILL["假期"]
tc = ws.cell(row=r, column=2 + len(sync_week_list), value=grand)
style_cell(tc, CENTER, BOLD)
ws.column_dimensions["A"].width = 28
for j in range(len(sync_week_list) + 1):
    ws.column_dimensions[get_column_letter(2 + j)].width = 11
ws.freeze_panes = "B2"

# ===== Sheet 4: 批次甘特总览 =====
ws = wb.create_sheet("批次甘特总览")
headers = ["品类", "月份批次", "款数"] + [wk_label(w) for w in WEEKS] + ["直接定款建议", "备注"]
for j, h in enumerate(headers):
    hc = ws.cell(row=1, column=1 + j, value=h)
    style_header(hc)
STAGE_KEYS = [("sel", "选款"), ("score", "打分"), ("ding", "定款"), ("spu", "SPU"), ("art", "作图")]
r = 2
for month in MONTHS:
    for cat in CATS:
        for b in [x for x in BATCHES if x["month"] == month and x["cat"] == cat]:
            name = CAT_NAMES[cat] + (f"({b['sub']})" if b["sub"] else "")
            style_cell(ws.cell(row=r, column=1, value=name), LEFT, BOLD)
            style_cell(ws.cell(row=r, column=2, value=f"{month} 批"), CENTER, BOLD)
            style_cell(ws.cell(row=r, column=3, value=b["qty"]))
            for j, w in enumerate(WEEKS):
                parts = []
                fill_key = None
                for key, label in STAGE_KEYS:
                    if w in b[key]:
                        parts.append(label)
                        fill_key = label
                if w in b["sync"]:
                    parts.append(f"上架{b['sync'][w]}")
                    fill_key = "上架"
                cc = ws.cell(row=r, column=4 + j, value="+".join(parts) if parts else "")
                style_cell(cc)
                if w in HOLIDAY_WEEKS:
                    cc.fill = STAGE_FILL["假期"]
                    if not parts:
                        cc.value = "假期"
                elif fill_key:
                    cc.fill = STAGE_FILL[fill_key]
            fc = ws.cell(row=r, column=4 + len(WEEKS), value=b["flag"])
            style_cell(fc, LEFT)
            if b["flag"]:
                fc.fill = STAGE_FILL["候选"]
                fc.font = BOLD
            nc = ws.cell(row=r, column=5 + len(WEEKS), value=b["note"])
            style_cell(nc, LEFT)
            r += 1
ws.column_dimensions["A"].width = 30
ws.column_dimensions["B"].width = 11
ws.column_dimensions["C"].width = 6
for j in range(len(WEEKS)):
    ws.column_dimensions[get_column_letter(4 + j)].width = 10.5
ws.column_dimensions[get_column_letter(4 + len(WEEKS))].width = 38
ws.column_dimensions[get_column_letter(5 + len(WEEKS))].width = 46
ws.freeze_panes = "D2"

# ===== Sheet 5: 每周工作清单 =====
ws = wb.create_sheet("每周工作清单")
cols = ["周次", "选款", "打分+定款", "生成SPU", "作图(进行中)", "同步上架", "本周上架量", "备注"]
for j, h in enumerate(cols):
    style_header(ws.cell(row=1, column=1 + j, value=h))

def batch_tag(b):
    sub = f"-{b['sub']}" if b["sub"] else ""
    star = "★" if b["flag"] else ""
    return f"{star}{CAT_NAMES[b['cat']].split(' ')[0]}{b['month'][2:].replace('-', '')}批{sub}({b['qty']}款)"

r = 2
for w in WEEKS:
    style_cell(ws.cell(row=r, column=1, value=wk_label(w).replace("\n", " ")), LEFT, BOLD)
    if w in HOLIDAY_WEEKS:
        cc = ws.cell(row=r, column=2, value="春节假期")
        style_cell(cc, CENTER, BOLD)
        cc.fill = STAGE_FILL["假期"]
        for j in range(3, len(cols) + 1):
            c2 = ws.cell(row=r, column=j, value="")
            style_cell(c2)
            c2.fill = STAGE_FILL["假期"]
        r += 1
        continue
    sel = [batch_tag(b) for b in BATCHES if w in b["sel"]]
    score = [batch_tag(b) for b in BATCHES if w in b["score"] or w in b["ding"]]
    spu = [batch_tag(b) for b in BATCHES if w in b["spu"]]
    art = [batch_tag(b) for b in BATCHES if w in b["art"]]
    sync = [f"{CAT_NAMES[b['cat']].split(' ')[0]} {b['sync'][w]}款" for b in BATCHES if w in b["sync"]]
    total = sum(b["sync"][w] for b in BATCHES if w in b["sync"])
    notes = []
    if any(b["flag"] and (w in b["sel"] or w in b["ding"]) for b in BATCHES):
        notes.append("★=直接定款候选, 人力排不开时由负责人直接定款")
    if w == W(2026, 8, 3):
        notes.append("追赶周: WD 8月批直接定款30款; 同时启动 MBD/WD 9月批选款")
    if w == W(2027, 1, 25):
        notes.append("节前最后完整周: 确认2月批次作图全部完成; 启动3月批次(MBD)选款")
    if w == W(2027, 2, 1):
        notes.append("节前上架周(2/5起放假)")
    if w == W(2027, 2, 22):
        notes.append("节后复工: 上架2月剩余批次; 3月批次常规品类立即选款/定款")
    vals = ["、".join(sel), "、".join(score), "、".join(spu), "、".join(art),
            "、".join(sync), total or "", "; ".join(notes)]
    for j, v in enumerate(vals):
        cc = ws.cell(row=r, column=2 + j, value=v)
        style_cell(cc, LEFT if j != 5 else CENTER)
    ws.row_dimensions[r].height = 30
    r += 1
widths = [16, 32, 32, 28, 36, 34, 10, 46]
for j, wd_ in enumerate(widths):
    ws.column_dimensions[get_column_letter(1 + j)].width = wd_
ws.freeze_panes = "B2"

# ===== Sheet 6: 产能与作图拆解 =====
ws = wb.create_sheet("产能与作图拆解")
cols = ["月份批次", "品类", "定款量", "选款池(×1.5)", "人均选款产能(款/周)", "选款需人·周",
        "单个制作占比", "单个制作(款)", "批量制作(款)", "作图周期(周)"]
for j, h in enumerate(cols):
    style_header(ws.cell(row=1, column=1 + j, value=h))
r = 2
for month in MONTHS:
    for cat in CATS:
        for b in [x for x in BATCHES if x["month"] == month and x["cat"] == cat]:
            qty = b["qty"]
            no_sel = not b["sel"] and not b["ding"]
            name = CAT_NAMES[cat] + (f"({b['sub']})" if b["sub"] else "")
            if no_sel or b["sub"] == "来图定制":
                pool = cap = ppl = "-"
            else:
                pool = math.ceil(qty * 1.5)
                cap = 40 if qty >= 40 else 20
                ppl = round(pool / cap, 1)
            if b["sub"] == "来图定制":
                ratio, single, batch_n = "-", "-", "-"
            else:
                ratio = f"{int(SINGLE_RATIO[cat]*100)}%"
                single = round(qty * SINGLE_RATIO[cat])
                batch_n = qty - single
            art_weeks = len(b["art"]) if b["art"] else ""
            vals = [f"{month} 批", name, qty, pool, cap, ppl, ratio, single, batch_n, art_weeks]
            for j, v in enumerate(vals):
                cc = ws.cell(row=r, column=1 + j, value=v)
                style_cell(cc, LEFT if j == 1 else CENTER)
            r += 1
widths2 = [12, 30, 9, 12, 18, 12, 12, 12, 12, 12]
for j, wd_ in enumerate(widths2):
    ws.column_dimensions[get_column_letter(1 + j)].width = wd_
ws.freeze_panes = "A2"

# ===== Sheet 7: 作图负荷 vs 产能 =====
# 产能假设: 单个 2款/设计师/天 → 10款/人·周, 10人 → 理论上限100款/周,
#           当前实际分配给新款约30款/周;
#           批量 20款/天 → 上限100款/周(满投入, 实际还需承担在架款图片迭代)
DESIGNERS = 10
SINGLE_PER_DESIGNER_WEEK = 10
SINGLE_CAP = DESIGNERS * SINGLE_PER_DESIGNER_WEEK
SINGLE_CURRENT = 30  # 当前每周实际投放给新款单个作图的量
BATCH_PER_DAY = 20
BATCH_CAP = BATCH_PER_DAY * 5

def art_load(week):
    """返回 (单个需求, 批量需求, 批次标签列表)"""
    single = batch = 0.0
    tags = []
    for b in BATCHES:
        if week not in b["art"]:
            continue
        per_week = b["qty"] / len(b["art"])
        if b["sub"] == "来图定制":
            batch += per_week
        else:
            single += per_week * SINGLE_RATIO[b["cat"]]
            batch += per_week * (1 - SINGLE_RATIO[b["cat"]])
        sub = f"-{b['sub']}" if b["sub"] else ""
        tags.append(f"{CAT_NAMES[b['cat']].split(' ')[0]}{b['month'][2:].replace('-', '')}批{sub}")
    return single, batch, tags

RED = PatternFill("solid", fgColor="FF9999")
YELLOW = PatternFill("solid", fgColor="FFE699")
GREEN = PatternFill("solid", fgColor="C6EFCE")

ws = wb.create_sheet("作图负荷vs产能")
cols = ["周次", "在制批次", "单个需求(款)", f"需设计师(人, {SINGLE_PER_DESIGNER_WEEK}款/人·周)",
        f"占理论产能({SINGLE_CAP}款/周)", f"对比当前投放({SINGLE_CURRENT}款/周)",
        "批量需求(款)", f"批量占用(天, {BATCH_PER_DAY}款/天)",
        "批量占用率(按5天)", "批量剩余产能(款, 可用于在架款迭代)", "提示"]
for j, h in enumerate(cols):
    style_header(ws.cell(row=1, column=1 + j, value=h))

def load_fill(cell, ratio):
    if ratio >= 1.0:
        cell.fill = RED
    elif ratio >= 0.8:
        cell.fill = YELLOW
    else:
        cell.fill = GREEN

r = 2
for w in WEEKS:
    if w in HOLIDAY_WEEKS:
        style_cell(ws.cell(row=r, column=1, value=wk_label(w).replace("\n", " ")), LEFT, BOLD)
        cc = ws.cell(row=r, column=2, value="春节假期")
        style_cell(cc, CENTER, BOLD)
        for j in range(1, len(cols) + 1):
            c2 = ws.cell(row=r, column=j)
            style_cell(c2, LEFT if j in (1, 2, 10) else CENTER)
            c2.fill = STAGE_FILL["假期"]
        r += 1
        continue
    single, batch, tags = art_load(w)
    if not tags:
        continue
    designers_needed = single / SINGLE_PER_DESIGNER_WEEK
    s_ratio = single / SINGLE_CAP
    cur_ratio = single / SINGLE_CURRENT
    batch_days = batch / BATCH_PER_DAY
    b_ratio = batch / BATCH_CAP
    hints = []
    if s_ratio >= 1.0:
        hints.append("单个作图超理论产能!需加人或提前启动")
    if cur_ratio >= 1.0:
        hints.append(f"超当前投放量: 该周新款单个作图需提量至约{math.ceil(single/5)*5}款")
    if b_ratio >= 1.0:
        hints.append("批量作图超产能!")
    elif b_ratio >= 0.8:
        hints.append("批量线高负荷: 在架款迭代需让路")
    vals = [wk_label(w).replace("\n", " "), "、".join(tags),
            round(single, 1), round(designers_needed, 1), f"{s_ratio:.0%}", f"{cur_ratio:.0%}",
            round(batch, 1), round(batch_days, 1), f"{b_ratio:.0%}",
            round(BATCH_CAP - batch, 1) if BATCH_CAP > batch else 0,
            "; ".join(hints)]
    for j, v in enumerate(vals):
        cc = ws.cell(row=r, column=1 + j, value=v)
        style_cell(cc, LEFT if j in (0, 1, 10) else CENTER, BOLD if j == 0 else BASE_FONT)
    load_fill(ws.cell(row=r, column=5), s_ratio)
    load_fill(ws.cell(row=r, column=6), cur_ratio)
    load_fill(ws.cell(row=r, column=9), b_ratio)
    ws.row_dimensions[r].height = 28
    r += 1
widths3 = [16, 52, 12, 16, 14, 14, 12, 14, 12, 16, 44]
for j, wd_ in enumerate(widths3):
    ws.column_dimensions[get_column_letter(1 + j)].width = wd_
ws.freeze_panes = "C2"

OUT = "/workspace/上架准备工作按周排期_2026-08_2027-02.xlsx"
wb.save(OUT)
print("saved:", OUT)

print("\n作图负荷vs产能(单个理论上限%d款/周, 当前投放%d款/周, 批量上限%d款/周):"
      % (SINGLE_CAP, SINGLE_CURRENT, BATCH_CAP))
for w in WEEKS:
    if w in HOLIDAY_WEEKS:
        continue
    single, batch, tags = art_load(w)
    if tags:
        mark = " <== 超当前投放" if single > SINGLE_CURRENT else ""
        print(f"  {w}: 单个 {single:5.1f} (理论{single/SINGLE_CAP:4.0%}/当前投放{single/SINGLE_CURRENT:4.0%})"
              f"  批量 {batch:5.1f} ({batch/BATCH_CAP:4.0%}){mark}")

# ---------------------------------------------------------------- 校验输出
print("\n各月上架合计(按周拆解求和):")
for m_idx, month in enumerate(MONTHS):
    total = sum(sum(b["sync"].values()) for b in BATCHES if b["month"] == month)
    print(f"  {month}: {total} (计划 {sum(PLAN[c][m_idx] for c in CATS)})")

print("\n每周上架总量:")
for w in WEEKS:
    t = sum(b["sync"].get(w, 0) for b in BATCHES)
    if t:
        print(f"  {w}: {t}")

print("\n每周选款/定款负荷(批次数):")
for w in WEEKS:
    sels = [f"{b['cat']}{b['month'][5:]}{'(直定候选)' if b['flag'] else ''}"
            for b in BATCHES if w in b["sel"]]
    dings = [f"{b['cat']}{b['month'][5:]}{'(直定候选)' if b['flag'] else ''}"
             for b in BATCHES if w in b["ding"] and w not in b["sel"] and not b["score"]]
    small_d = [f"{b['cat']}{b['month'][5:]}{'(直定候选)' if b['flag'] else ''}"
               for b in BATCHES if w in b["ding"] and w in b["sel"]]
    if sels or dings or small_d:
        items = [x for x in sels if x not in small_d] + [f"小批:{x}" for x in small_d] + dings
        print(f"  {w}: {len(sels)+len(dings)}项 -> {', '.join(items)}")
