#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成《克拉先生》裂变项目总经理竞选 PPT（16:9，12 页）。"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ---------- 主题色 ----------
NAVY = RGBColor(0x11, 0x2A, 0x46)      # 深海军蓝（主色）
NAVY_LIGHT = RGBColor(0x1E, 0x3D, 0x5C)
GOLD = RGBColor(0xC9, 0xA2, 0x4B)      # 金色（强调）
GOLD_LIGHT = RGBColor(0xE8, 0xD5, 0xA3)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
OFFWHITE = RGBColor(0xF7, 0xF5, 0xF0)
GREY = RGBColor(0x5A, 0x64, 0x70)
DARK = RGBColor(0x22, 0x2A, 0x33)
RED = RGBColor(0xB0, 0x3A, 0x2E)
GREEN = RGBColor(0x2E, 0x7D, 0x52)
LIGHTLINE = RGBColor(0xD9, 0xD4, 0xC8)

FONT = "Noto Sans CJK SC"

SW, SH = Inches(13.333), Inches(7.5)

prs = Presentation()
prs.slide_width = SW
prs.slide_height = SH
BLANK = prs.slide_layouts[6]


def set_font(run, size=18, bold=False, color=DARK, italic=False):
    f = run.font
    f.name = FONT
    f.size = Pt(size)
    f.bold = bold
    f.italic = italic
    f.color.rgb = color
    # 东亚字体
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn('a:ea'))
    if ea is None:
        ea = rPr.makeelement(qn('a:ea'), {})
        rPr.append(ea)
    ea.set('typeface', FONT)


def add_rect(slide, x, y, w, h, fill=None, line=None, line_w=None, shadow=False,
             shape=MSO_SHAPE.RECTANGLE, radius=None):
    sp = slide.shapes.add_shape(shape, x, y, w, h)
    if fill is None:
        sp.fill.background()
    else:
        sp.fill.solid()
        sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line
        sp.line.width = line_w or Pt(1)
    sp.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        try:
            sp.adjustments[0] = radius
        except Exception:
            pass
    return sp


def add_text(slide, x, y, w, h, lines, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
             space_after=6, line_spacing=1.0, wrap=True):
    """lines: list of (text, size, bold, color) 或 list of list of runs."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = wrap
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(space_after)
        if line_spacing:
            p.line_spacing = line_spacing
        runs = ln if isinstance(ln, list) else [ln]
        for (text, size, bold, color) in runs:
            r = p.add_run()
            r.text = text
            set_font(r, size, bold, color)
    return tb


def slide_base(bg=OFFWHITE):
    s = prs.slides.add_slide(BLANK)
    add_rect(s, 0, 0, SW, SH, fill=bg)
    return s


def header(s, title, subtitle=None, num=None):
    """内容页统一页眉。"""
    add_rect(s, 0, 0, SW, Inches(1.06), fill=NAVY)
    add_rect(s, 0, Inches(1.06), SW, Pt(3), fill=GOLD)
    add_text(s, Inches(0.55), Inches(0.22), Inches(10.5), Inches(0.7),
             [(title, 27, True, WHITE)], anchor=MSO_ANCHOR.MIDDLE)
    if subtitle:
        add_text(s, Inches(0.55), Inches(1.22), Inches(12.2), Inches(0.4),
                 [(subtitle, 14, False, GREY)])
    if num:
        add_text(s, Inches(12.35), Inches(0.22), Inches(0.7), Inches(0.7),
                 [(num, 16, True, GOLD)], align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    # 页脚品牌
    add_text(s, Inches(0.55), Inches(7.08), Inches(6), Inches(0.35),
             [("克拉先生 Mr. Karat · 裂变项目竞选", 10.5, False, RGBColor(0xAA, 0xA4, 0x96))])


def diamond_mark(s, cx, cy, size, color=GOLD):
    """菱形装饰。cx/cy 为中心 Emu。"""
    half = int(size / 2)
    add_rect(s, Emu(int(cx) - half), Emu(int(cy) - half), Emu(int(size)), Emu(int(size)),
             fill=color, shape=MSO_SHAPE.DIAMOND)


# ================================================================
# 第 1 页 封面
# ================================================================
s = slide_base(NAVY)
add_rect(s, 0, Inches(6.9), SW, Inches(0.6), fill=GOLD)
add_rect(s, Inches(0.9), Inches(0.9), Inches(11.53), Pt(1.2), fill=GOLD)

diamond_mark(s, SW / 2, Inches(1.95), Inches(0.42), GOLD)
add_text(s, Inches(1.5), Inches(2.35), Inches(10.33), Inches(1.3),
         [("克拉先生  Mr. Karat", 54, True, WHITE)], align=PP_ALIGN.CENTER)
add_text(s, Inches(1.5), Inches(3.62), Inches(10.33), Inches(0.6),
         [("美国培育钻婚戒 DTC 独立站品牌", 24, False, GOLD_LIGHT)], align=PP_ALIGN.CENTER)
add_text(s, Inches(1.5), Inches(4.55), Inches(10.33), Inches(0.55),
         [("低风险产品结构  ×  专业流量投放体系", 18, False, WHITE)], align=PP_ALIGN.CENTER)
add_text(s, Inches(1.5), Inches(5.55), Inches(10.33), Inches(0.5),
         [("裂变项目总经理竞选  ·  演讲人：____  ·  时长 12 分钟", 15, False, RGBColor(0x9F, 0xB0, 0xC4))],
         align=PP_ALIGN.CENTER)

# ================================================================
# 第 2 页 开场钩子：两颗钻石的故事
# ================================================================
s = slide_base(NAVY)
add_rect(s, 0, 0, SW, Pt(4), fill=GOLD)
add_text(s, Inches(0.75), Inches(0.42), Inches(11.8), Inches(0.7),
         [("开场：这两颗钻石，哪颗 30 万，哪颗 6 万？", 29, True, WHITE)])
add_text(s, Inches(0.75), Inches(1.2), Inches(11.8), Inches(0.5),
         [("培育钻不是仿钻——它是实验室里\u201c长\u201d出来的真钻石，连 IGI / GIA 都为它出具证书", 15.5, False, GOLD_LIGHT)])

# 两颗钻石实拍对比图（同一背景同一张图；替换 ppt/assets/rings_comparison.png 后重跑脚本即可换图）
import os
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "rings_comparison.png")
img_x, img_y, img_w = Inches(0.95), Inches(1.85), Inches(4.0)
add_rect(s, img_x - Pt(3), img_y - Pt(3), img_w + Pt(6), img_w + Pt(6), fill=GOLD)
s.shapes.add_picture(IMG, img_x, img_y, width=img_w, height=img_w)
# 左右 A/B 标签
for i, tag in enumerate(["A", "B"]):
    tx = img_x + Inches(0.55) + i * Inches(2.35)
    add_rect(s, tx, img_y + img_w - Inches(0.55), Inches(0.55), Inches(0.4), fill=NAVY,
             line=GOLD, line_w=Pt(1), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.5)
    add_text(s, tx, img_y + img_w - Inches(0.55), Inches(0.55), Inches(0.4),
             [(tag, 14, True, GOLD)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=0)
add_text(s, img_x, img_y + img_w + Inches(0.1), img_w, Inches(0.4),
         [("其中一颗是培育钻 —— 您能分辨吗？", 14, True, GOLD_LIGHT)],
         align=PP_ALIGN.CENTER, space_after=0)

# 右侧：三行对比
comp = [
    ("视觉 · 化学结构 · 硬度", "完全一致：同为碳晶体、莫氏硬度 10、同等火彩，肉眼与常规仪器无法区分", GREEN, "相同"),
    ("价格", "培育钻仅为天然钻的 1/3 ~ 1/5：同样预算，克拉数翻倍", GOLD, "1/3~1/5"),
    ("供给能力", "天然钻依赖矿产开采、储量有限；培育钻可规模化量产、成本持续下降", RED, "无上限"),
]
cx = Inches(5.5)
cw = Inches(7.2)
cy = Inches(1.85)
for t, d, c, tag in comp:
    add_rect(s, cx, cy, cw, Inches(0.62), fill=NAVY_LIGHT,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
    add_rect(s, cx, cy, Inches(1.35), Inches(0.62), fill=c,
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.18)
    add_text(s, cx + Inches(0.07), cy, Inches(1.22), Inches(0.62), [(tag, 13.5, True, WHITE)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, cx + Inches(1.5), cy, cw - Inches(1.6), Inches(0.62), [(t, 14.5, True, WHITE)],
             anchor=MSO_ANCHOR.MIDDLE, space_after=0)
    add_text(s, cx, cy + Inches(0.66), cw, Inches(0.55),
             [(d, 11.5, False, RGBColor(0xB9, 0xC5, 0xD4))], space_after=0, line_spacing=1.08)
    cy += Inches(1.32)

# 市场趋势一行
add_rect(s, cx, Inches(5.82), cw, Inches(0.52), fill=NAVY_LIGHT, line=GOLD, line_w=Pt(1),
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.25)
add_text(s, cx + Inches(0.25), Inches(5.82), cw - Inches(0.5), Inches(0.52),
         [[("美国市场信号：", 12.5, True, GOLD),
           ("培育钻在订婚戒中的渗透率逐年快速提升——年轻一代已用钱包投票", 12.5, False, WHITE)]],
         anchor=MSO_ANCHOR.MIDDLE, space_after=0)

add_rect(s, Inches(0.95), Inches(6.42), Inches(11.75), Inches(0.82), fill=GOLD,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.16)
add_text(s, Inches(1.25), Inches(6.42), Inches(11.2), Inches(0.82),
         [("同样的钻石 · 三分之一的价格 · 无上限的供给 —— 供给革命遇上婚戒刚需，新品牌的窗口打开了",
           16.5, True, NAVY)], anchor=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER)

# ================================================================
# 第 3 页 目录
# ================================================================
s = slide_base()
header(s, "目录", "对齐公司要求的六大要素", "03")
toc = [
    ("01", "项目介绍、产品及服务", "美国培育钻婚戒赛道 × 个性化定制"),
    ("02", "商业模式及市场策略", "五位一体模式 · 流媒体机会点 · 打法"),
    ("03", "3 年独立核算财务预算", "投入、收益与利润率测算"),
    ("04", "投资总额度与出资结构", "总投入 160 万 · 带头人及团队出资"),
    ("05", "团队成员及职责介绍", "投放 · 素材 · 供应链 · 定制服务"),
    ("06", "为什么总经理是我（必答题）", "被结果验证过的流媒体操盘手"),
]
for i, (n, t, d) in enumerate(toc):
    col, row = i % 2, i // 2
    x = Inches(0.75) + col * Inches(6.15)
    y = Inches(1.85) + row * Inches(1.66)
    card = add_rect(s, x, y, Inches(5.85), Inches(1.38), fill=WHITE,
                    line=LIGHTLINE, line_w=Pt(1), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    add_rect(s, x, y, Inches(0.09), Inches(1.38), fill=GOLD)
    add_text(s, x + Inches(0.32), y + Inches(0.18), Inches(0.9), Inches(1.0),
             [(n, 30, True, GOLD)], anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, x + Inches(1.25), y + Inches(0.18), Inches(4.45), Inches(1.05),
             [(t, 17.5, True, NAVY), (d, 12.5, False, GREY)],
             anchor=MSO_ANCHOR.MIDDLE, space_after=3)

# ================================================================
# 第 3 页 项目介绍
# ================================================================
s = slide_base()
header(s, "01 · 项目介绍：产品及服务", "在美国婚戒市场，用培育钻婚戒成品 + 顾问式服务切一块确定性增长的蛋糕", "04")

# 左侧：赛道
add_text(s, Inches(0.75), Inches(1.7), Inches(5.9), Inches(0.5),
         [("为什么是美国培育钻婚戒？", 19, True, NAVY)])
facts = [
    ("渗透率高速提升", "培育钻已成为美国婚戒主流选择之一，年轻一代接受度持续走高"),
    ("极致性价比", "同级品质价格约为天然钻的 1/3~1/5，同预算克拉数翻倍"),
    ("价值观契合", "环保、无开采争议，契合美国年轻婚恋人群的消费叙事"),
    ("情感品类高毛利", "婚戒是强情感品类，品牌与设计的溢价空间大"),
]
y = Inches(2.32)
for t, d in facts:
    diamond_mark(s, Inches(0.95), y + Inches(0.16), Inches(0.16))
    add_text(s, Inches(1.2), y - Inches(0.03), Inches(5.5), Inches(0.9),
             [[(t + "：", 14.5, True, DARK), (d, 13.5, False, GREY)]], space_after=0, line_spacing=1.08)
    y += Inches(0.98)

# 右侧：产品与服务
rx = Inches(7.0)
add_rect(s, rx, Inches(1.7), Inches(5.6), Inches(4.9), fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.05)
add_text(s, rx + Inches(0.4), Inches(2.0), Inches(4.8), Inches(0.5),
         [("我们卖什么", 19, True, GOLD)])
prods = [
    ("核心产品", "培育钻婚戒成品款式库（IGI·GIA 证书培育钻 + K 金戒托），客单价约 $450"),
    ("核心服务", "1v1 顾问服务：选款推荐 → 效果确认 → 大师手作 → 保险直邮"),
    ("增值服务", "个性化定制、免费刻字、改圈、终身保养（可选加购）"),
    ("销售渠道", "品牌独立站 DTC 直达消费者，一件一做、按单生产，不依赖平台与门店"),
]
y = Inches(2.62)
for t, d in prods:
    add_text(s, rx + Inches(0.4), y, Inches(4.85), Inches(0.95),
             [[(t + "  ", 14.5, True, GOLD_LIGHT)], [(d, 13, False, WHITE)]],
             space_after=2, line_spacing=1.05)
    y += Inches(0.98)

# ================================================================
# 第 4 页 商业模式
# ================================================================
s = slide_base()
header(s, "02 · 商业模式：五位一体 = 克拉先生", "全链路自控：供应链 → 设计 → 制造 → 服务 → 销售", "05")

# 公式条
items = ["印度一手\n钻石源头", "Tiffany 同源\n金工大师", "珠宝 AI\n设计模型", "个性化\n增值服务", "独立站\n销售"]
bx = Inches(0.62)
bw, bh = Inches(2.06), Inches(1.5)
gap = Inches(0.5)
yb = Inches(1.78)
for i, it in enumerate(items):
    x = bx + i * (bw + gap)
    add_rect(s, x, yb, bw, bh, fill=NAVY, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
    lines = it.split("\n")
    add_text(s, x + Inches(0.06), yb + Inches(0.12), bw - Inches(0.12), bh - Inches(0.24),
             [(l, 15.5, True, WHITE) for l in lines],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space_after=2, line_spacing=1.05)
    if i < 4:
        add_text(s, x + bw - Inches(0.04), yb + Inches(0.3), gap + Inches(0.08), Inches(0.9),
                 [("+", 30, True, GOLD)], align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

add_text(s, Inches(0.62), Inches(3.42), Inches(12.1), Inches(0.55),
         [[("＝  ", 24, True, GOLD), ("克拉先生 Mr. Karat：一件一做的美国培育钻婚戒品牌", 21, True, NAVY)]],
         align=PP_ALIGN.CENTER)

# 四大亮点
lights = [
    ("零库存压力", "一件一做、按单生产，无备货资金占用，天然低风险", GREEN),
    ("AI 设计赋能", "AI 模型秒级出图，个性化设计效率和素材产能同步放大", GOLD),
    ("大师级工艺", "Tiffany 同源体系金工大师手作，品质与品牌故事双背书", NAVY_LIGHT),
    ("顾问式服务", "1v1 顾问承接询单，定制/刻字等增值服务提客单，转化与复购的基石", RED),
]
for i, (t, d, c) in enumerate(lights):
    x = Inches(0.62) + i * Inches(3.14)
    yl = Inches(4.35)
    add_rect(s, x, yl, Inches(2.9), Inches(2.15), fill=WHITE, line=LIGHTLINE, line_w=Pt(1),
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08)
    add_rect(s, x, yl, Inches(2.9), Inches(0.14), fill=c)
    add_text(s, x + Inches(0.22), yl + Inches(0.34), Inches(2.46), Inches(0.5),
             [(t, 16.5, True, NAVY)])
    add_text(s, x + Inches(0.22), yl + Inches(0.92), Inches(2.46), Inches(1.1),
             [(d, 12.5, False, GREY)], line_spacing=1.15)

# ================================================================
# 第 5 页 市场分析：机会点
# ================================================================
s = slide_base()
header(s, "02 · 市场分析：竞品的流量盲区，就是我们的机会点", "头部品牌重搜索与门店，社媒信息流投放渗透率极低", "06")

# 对比表
tx, ty = Inches(0.62), Inches(1.78)
col_w = [Inches(2.5), Inches(2.34), Inches(2.34), Inches(2.34), Inches(2.54)]
rows = [
    ("流量打法", "BrilliantEarth", "Tiffany", "Cartier", "克拉先生"),
    ("线下品牌门店", "● 重投入", "●● 极重", "●● 极重", "— 无（轻资产）"),
    ("Google 搜索 / SEO", "●● 主阵地", "● 品牌词", "● 品牌词", "○ 辅助承接"),
    ("TT / FB / INS 信息流", "○ 渗透极低", "○ 几乎缺席", "○ 几乎缺席", "★ 主攻阵地"),
    ("KOL / 素材生态", "○ 零散", "○ 传统广告", "○ 传统广告", "★ 母公司平台赋能"),
]
row_h = Inches(0.74)
for r, row in enumerate(rows):
    x = tx
    for c, cell in enumerate(row):
        is_head = (r == 0)
        is_us = (c == 4)
        fill = NAVY if is_head else (GOLD_LIGHT if is_us else (WHITE if r % 2 else OFFWHITE))
        if is_head and is_us:
            fill = GOLD
        add_rect(s, x, ty + r * row_h, col_w[c], row_h, fill=fill, line=LIGHTLINE, line_w=Pt(0.75))
        color = WHITE if is_head else (NAVY if is_us else DARK)
        bold = is_head or is_us or c == 0
        add_text(s, x + Inches(0.12), ty + r * row_h, col_w[c] - Inches(0.24), row_h,
                 [(cell, 13 if not is_head else 14, bold, color)],
                 align=PP_ALIGN.CENTER if c > 0 else PP_ALIGN.LEFT,
                 anchor=MSO_ANCHOR.MIDDLE, space_after=0)
        x += col_w[c]

# 结论条
add_rect(s, Inches(0.62), Inches(5.7), Inches(12.1), Inches(0.95), fill=NAVY,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.15)
add_text(s, Inches(1.0), Inches(5.7), Inches(11.4), Inches(0.95),
         [[("机会点：", 17, True, GOLD),
           ("婚戒品类天然具备大克拉对比、定制过程等强视觉素材，正是社媒信息流最吃的内容——竞品未建立体系，我们先建。",
            15.5, True, WHITE)]],
         anchor=MSO_ANCHOR.MIDDLE, line_spacing=1.1)

# ================================================================
# 第 6 页 市场策略
# ================================================================
s = slide_base()
header(s, "02 · 市场策略：素材驱动的社媒打法 + 高客单信任体系", "把流量优势转化为高客单订单", "07")

# 漏斗（左）
funnel = [
    ("种草", "TT/FB/INS 信息流 + KOL 真实开箱、求婚场景素材", Inches(5.4)),
    ("留资", "独立站落地页 · AI 免费出图钩子 · 邮件/WhatsApp 私域", Inches(4.6)),
    ("转化", "1v1 顾问：选款推荐 → 效果图确认 → 分期支付", Inches(3.8)),
    ("裂变", "婚礼晒单返现 · 周年钻饰复购 · 好友推荐计划", Inches(3.0)),
]
fy = Inches(1.75)
for i, (t, d, w) in enumerate(funnel):
    x = Inches(0.75) + (Inches(5.4) - w) / 2
    colors = [NAVY, NAVY_LIGHT, GOLD, RGBColor(0x8A, 0x6D, 0x2F)]
    add_rect(s, x, fy, w, Inches(0.84), fill=colors[i], shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    add_text(s, x, fy, w, Inches(0.84), [(t, 17, True, WHITE)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    add_text(s, Inches(6.45), fy, Inches(0.35), Inches(0.84), [("—", 13, False, GREY)],
             anchor=MSO_ANCHOR.MIDDLE)
    fy += Inches(1.02)

# 漏斗说明放右侧上半
dy = Inches(1.75)
for t, d, w in funnel:
    add_text(s, Inches(6.85), dy + Inches(0.22), Inches(5.9), Inches(0.7),
             [[(t + "：", 14, True, NAVY), (d, 13, False, GREY)]], space_after=0, line_spacing=1.1)
    dy += Inches(1.02)

# 底部信任体系条
add_rect(s, Inches(0.75), Inches(6.05), Inches(11.85), Inches(0.78), fill=WHITE,
         line=GOLD, line_w=Pt(1.2), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.2)
add_text(s, Inches(1.1), Inches(6.05), Inches(11.3), Inches(0.78),
         [[("高客单信任体系：", 14.5, True, GOLD),
           ("IGI/GIA 权威证书 · 30 天无忧退换 · 保险物流直邮 · 真实客户评价库 · 终身保养承诺",
            13.5, True, NAVY)]],
         anchor=MSO_ANCHOR.MIDDLE)

# ================================================================
# 第 7 页 财务预算
# ================================================================
s = slide_base()
header(s, "03 · 3 年独立核算：投资与收益财务预算", "总投入 160 万（3 年储备） · 净利率 15%~20% · 客单价按 $450（约 3,200 元）测算，示例口径可复核", "08")

tx, ty = Inches(0.62), Inches(1.72)
cols = [Inches(3.3), Inches(2.9), Inches(2.9), Inches(2.98)]
frows = [
    ("科目（万元人民币）", "第 1 年 · 验证期", "第 2 年 · 放量期", "第 3 年 · 规模期"),
    ("GMV（销售额）", "500", "1,500", "3,600"),
    ("订单量（月均）", "约 1,560 单（月均 130）", "约 4,690 单（月均 390）", "约 11,250 单（月均 940）"),
    ("广告及营销投放（40%）", "200", "600", "1,440"),
    ("货品及履约成本（30%）", "150", "450", "1,080"),
    ("团队及运营费用（8%）", "40", "120", "288"),
    ("经营利润（约 22%）", "110", "330", "792"),
]
row_h = Inches(0.56)
for r, row in enumerate(frows):
    x = tx
    for c, cell in enumerate(row):
        is_head = (r == 0)
        is_profit = (r == len(frows) - 1)
        fill = NAVY if is_head else (GOLD_LIGHT if is_profit else (WHITE if r % 2 else OFFWHITE))
        add_rect(s, x, ty + r * row_h, cols[c], row_h, fill=fill, line=LIGHTLINE, line_w=Pt(0.75))
        color = WHITE if is_head else (NAVY if is_profit else DARK)
        add_text(s, x + Inches(0.15), ty + r * row_h, cols[c] - Inches(0.3), row_h,
                 [(cell, 13, is_head or is_profit or c == 0, color)],
                 align=PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER,
                 anchor=MSO_ANCHOR.MIDDLE, space_after=0)
        x += cols[c]

notes = [
    ("单量口径", "第一年月均约 130 单、日均 4~5 单即达标——对专业投放团队，这是保守的起步目标，可拆到每条广告线复核"),
    ("成本结构", "广告 40% + 货品 30% + 团队运营 8%，经营利润率约 22%；扣除支付手续费、物流保险等杂费后净利率 15%~20%"),
    ("零库存模型", "一件一做，货品成本随订单发生，160 万主要投向流量与团队，资金效率高"),
]
ny = Inches(5.78)
for t, d in notes:
    diamond_mark(s, Inches(0.82), ny + Inches(0.13), Inches(0.14))
    add_text(s, Inches(1.05), ny - Inches(0.02), Inches(11.7), Inches(0.4),
             [[(t + "：", 12.5, True, NAVY), (d, 12, False, GREY)]], space_after=0)
    ny += Inches(0.4)

# ================================================================
# 第 8 页 投资额度与出资结构
# ================================================================
s = slide_base()
header(s, "04 · 项目投资总额度 · 带头人及团队出资额度", "跟投绑定：我们自己先押上真金白银", "09")

# 左：总额度大数字
add_rect(s, Inches(0.75), Inches(1.85), Inches(4.7), Inches(4.7), fill=NAVY,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
add_text(s, Inches(0.95), Inches(2.25), Inches(4.3), Inches(0.5),
         [("项目投资总额度", 17, True, GOLD_LIGHT)], align=PP_ALIGN.CENTER)
add_text(s, Inches(0.95), Inches(2.85), Inches(4.3), Inches(1.2),
         [("160 万", 56, True, WHITE)], align=PP_ALIGN.CENTER)
add_text(s, Inches(0.95), Inches(4.15), Inches(4.3), Inches(0.5),
         [("3 年运营储备 · 独立核算", 14.5, False, GOLD_LIGHT)], align=PP_ALIGN.CENTER)
add_rect(s, Inches(1.35), Inches(4.85), Inches(3.5), Pt(1), fill=GOLD)
add_text(s, Inches(0.95), Inches(5.05), Inches(4.3), Inches(1.3),
         [("带头人出资：____ 万", 15.5, True, WHITE),
          ("核心团队合计：____ 万", 15.5, True, WHITE)],
         align=PP_ALIGN.CENTER, space_after=8)

# 右：资金用途
add_text(s, Inches(6.0), Inches(1.85), Inches(6.6), Inches(0.5),
         [("资金用途规划（示例占比）", 18, True, NAVY)])
uses = [
    ("流量投放与素材制作", 0.50, GOLD),
    ("团队薪酬与运营", 0.25, NAVY_LIGHT),
    ("独立站建设与工具", 0.10, GREEN),
    ("样品打版与认证", 0.08, RED),
    ("风险备用金", 0.07, GREY),
]
uy = Inches(2.5)
bar_max = Inches(4.1)
for t, pct, c in uses:
    add_text(s, Inches(6.0), uy, Inches(3.1), Inches(0.4), [(t, 13.5, True, DARK)], space_after=0)
    add_rect(s, Inches(6.0), uy + Inches(0.38), bar_max, Inches(0.26), fill=RGBColor(0xE7, 0xE3, 0xD9))
    add_rect(s, Inches(6.0), uy + Inches(0.38), Emu(int(bar_max * pct)), Inches(0.26), fill=c)
    add_text(s, Inches(6.0) + bar_max + Inches(0.15), uy + Inches(0.26), Inches(1.2), Inches(0.4),
             [(f"{int(pct*100)}%", 14, True, NAVY)], space_after=0)
    uy += Inches(0.83)

add_text(s, Inches(6.0), uy + Inches(0.1), Inches(6.6), Inches(0.5),
         [("注：出资额度以公司裂变机制要求为准，上台前填入实际数字。", 11.5, False, GREY)])

# ================================================================
# 第 9 页 团队
# ================================================================
s = slide_base()
header(s, "05 · 团队成员及职责介绍", "小而精的闭环作战单元：每个关键环节都有被验证过的人", "10")

teams = [
    ("总经理 / 流量操盘", "____（本人）",
     "六年打满整个业务链：从客服到投手到项目负责人，累计操盘 1,000 万美金投放，破站点 GMV 纪录。",
     "战略与经营 · 投放体系 · 广告操盘 · ROI 负责"),
    ("素材创作负责人", "____",
     "5 年跨境素材实战，从 0 搭建 2 个站点的拍摄剪辑团队，单条爆款素材带来超 50 万美金 GMV。",
     "拍摄与剪辑生态 · 素材测试迭代 · KOL 内容协同"),
    ("设计与供应链负责人", "____",
     "深耕珠宝供应链 8 年，直连印度源头钻石商与同源体系金工工坊，管理过年出货 3 万件的珠宝产线。",
     "AI 设计模型 · 印度源头选钻 · 金工排单与品控"),
    ("销售顾问 / 客服负责人", "____",
     "一线客服成长起来的转化专家，6 年高客单询单经验，历史询单转化率 30%、客诉率低于 1%。",
     "1v1 顾问服务 · 询单转化 · 售后与复购运营"),
]
for i, (role, name, intro, duty) in enumerate(teams):
    col, row = i % 2, i // 2
    x = Inches(0.75) + col * Inches(6.15)
    y = Inches(1.9) + row * Inches(2.3)
    add_rect(s, x, y, Inches(5.85), Inches(2.05), fill=WHITE, line=LIGHTLINE, line_w=Pt(1),
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.07)
    add_rect(s, x, y, Inches(0.09), Inches(2.05), fill=GOLD if i == 0 else NAVY)
    add_text(s, x + Inches(0.35), y + Inches(0.18), Inches(5.2), Inches(0.45),
             [[(role, 16, True, NAVY), ("   " + name, 13.5, True, GOLD)]])
    add_text(s, x + Inches(0.35), y + Inches(0.68), Inches(5.15), Inches(0.85),
             [(intro, 11.5, False, DARK)], line_spacing=1.15)
    add_text(s, x + Inches(0.35), y + Inches(1.6), Inches(5.15), Inches(0.4),
             [(duty, 10.5, False, GREY)], space_after=0)

add_text(s, Inches(0.75), Inches(6.45), Inches(12, ), Inches(0.4),
         [("注：成员姓名与出资额度上台前补充；母公司 KOL 平台与中后台（财务/法务/IT）共享支持。", 11.5, False, GREY)])

# ================================================================
# 第 10 页 为什么总经理是我（高潮页）
# ================================================================
s = slide_base(NAVY)
add_rect(s, 0, 0, SW, Pt(4), fill=GOLD)
add_text(s, Inches(0.75), Inches(0.5), Inches(11.8), Inches(0.7),
         [("06 · 必答题：为什么总经理是我？", 30, True, WHITE)])
add_text(s, Inches(0.75), Inches(1.32), Inches(11.8), Inches(0.55),
         [[("这个项目的胜负手是流媒体流量，而我，是公司里被结果验证过的流媒体操盘手。", 17.5, True, GOLD)]])

# 时间线
tl = [
    ("2020", "客服业务员", "月薪 3,500 起步\n吃透用户与询单"),
    ("", "营销部投手", "转型广告投放\n从 0 建立盘感"),
    ("", "站点营销负责人", "统筹素材+投放\n搭建创作生态团队"),
    ("至今", "项目负责人", "打破站点\nGMV 纪录"),
]
tlx, tly = Inches(0.95), Inches(2.75)
step = Inches(3.05)
add_rect(s, tlx + Inches(0.3), tly + Inches(0.12), step * 3, Pt(2.2), fill=GOLD)
for i, (yr, role, d) in enumerate(tl):
    cx = tlx + Inches(0.3) + i * step
    diamond_mark(s, cx, tly + Inches(0.13), Inches(0.3), GOLD)
    add_text(s, cx - Inches(1.35), tly + Inches(0.45), Inches(2.7), Inches(0.45),
             [(role, 15.5, True, WHITE)], align=PP_ALIGN.CENTER)
    add_text(s, cx - Inches(1.35), tly + Inches(0.95), Inches(2.7), Inches(0.9),
             [(ln, 12, False, RGBColor(0xB9, 0xC5, 0xD4)) for ln in d.split("\n")],
             align=PP_ALIGN.CENTER, space_after=2, line_spacing=1.1)
    if yr:
        add_text(s, cx - Inches(1.35), tly - Inches(0.42), Inches(2.7), Inches(0.4),
                 [(yr, 13, True, GOLD)], align=PP_ALIGN.CENTER)

# 三个硬数据
stats = [
    ("$1,000 万", "累计广告投放花费\n实战锤炼的投放体系"),
    ("素材生态团队", "拍摄 → 剪辑 → 投放\n双通道自建打通"),
    ("破站点 GMV 纪录", "操盘项目创下\n站点历史最高纪录"),
]
for i, (n, d) in enumerate(stats):
    x = Inches(0.95) + i * Inches(3.95)
    y2 = Inches(4.85)
    add_rect(s, x, y2, Inches(3.6), Inches(1.75), fill=NAVY_LIGHT, line=GOLD, line_w=Pt(1),
             shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.1)
    add_text(s, x + Inches(0.2), y2 + Inches(0.22), Inches(3.2), Inches(0.6),
             [(n, 21, True, GOLD)], align=PP_ALIGN.CENTER)
    add_text(s, x + Inches(0.2), y2 + Inches(0.88), Inches(3.2), Inches(0.8),
             [(ln, 12.5, False, WHITE) for ln in d.split("\n")],
             align=PP_ALIGN.CENTER, space_after=2, line_spacing=1.1)

add_text(s, Inches(0.95), Inches(6.85), Inches(11.5), Inches(0.45),
         [("＋ 母公司 KOL 平台完善支持，为新品牌冷启动持续赋能", 14.5, True, GOLD_LIGHT)],
         align=PP_ALIGN.CENTER)

# ================================================================
# 第 11 页 总结
# ================================================================
s = slide_base()
header(s, "总结：确定性的模型，配上被验证过的人", None, "12")

add_rect(s, Inches(0.75), Inches(1.75), Inches(5.85), Inches(3.3), fill=WHITE,
         line=LIGHTLINE, line_w=Pt(1), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
add_rect(s, Inches(0.75), Inches(1.75), Inches(5.85), Inches(0.14), fill=GREEN)
add_text(s, Inches(1.05), Inches(2.05), Inches(5.25), Inches(0.5),
         [("低风险产品结构", 19, True, NAVY)])
add_text(s, Inches(1.05), Inches(2.7), Inches(5.25), Inches(2.2),
         [("· 一件一做，零库存资金占用", 14, False, GREY),
          ("· 160 万投入覆盖 3 年独立核算", 14, False, GREY),
          ("· 源头供应链 + 大师工艺锁定成本与品质", 14, False, GREY),
          ("· 利润锚定品牌与设计溢价，15%~20%", 14, False, GREY)],
         space_after=10)

add_rect(s, Inches(6.85), Inches(1.75), Inches(5.85), Inches(3.3), fill=WHITE,
         line=LIGHTLINE, line_w=Pt(1), shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06)
add_rect(s, Inches(6.85), Inches(1.75), Inches(5.85), Inches(0.14), fill=GOLD)
add_text(s, Inches(7.15), Inches(2.05), Inches(5.25), Inches(0.5),
         [("专业流量投放体系", 19, True, NAVY)])
add_text(s, Inches(7.15), Inches(2.7), Inches(5.25), Inches(2.2),
         [("· 竞品社媒信息流空窗，先发卡位", 14, False, GREY),
          ("· $1,000 万投放经验 + 素材生态团队", 14, False, GREY),
          ("· 母公司 KOL 平台冷启动赋能", 14, False, GREY),
          ("· 破站点 GMV 纪录的操盘方法论复用", 14, False, GREY)],
         space_after=10)

add_rect(s, Inches(0.75), Inches(5.45), Inches(11.95), Inches(1.25), fill=NAVY,
         shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.12)
add_text(s, Inches(1.1), Inches(5.45), Inches(11.3), Inches(1.25),
         [[("目标：", 18, True, GOLD),
           ("第 1~3 年跑通单站模型，第 4~5 年复制多站点、多市场，冲击年收益 5,000 万美金量级。下有零库存保底，上有流量红利想象力。",
            16, True, WHITE)]],
         anchor=MSO_ANCHOR.MIDDLE, line_spacing=1.15)

# ================================================================
# 第 12 页 谢谢
# ================================================================
s = slide_base(NAVY)
add_rect(s, 0, Inches(6.9), SW, Inches(0.6), fill=GOLD)
diamond_mark(s, SW / 2, Inches(2.35), Inches(0.4), GOLD)
add_text(s, Inches(1.5), Inches(2.85), Inches(10.33), Inches(1.0),
         [("感谢聆听 · 请投出您的一票", 40, True, WHITE)], align=PP_ALIGN.CENTER)
add_text(s, Inches(1.5), Inches(4.05), Inches(10.33), Inches(0.6),
         [("克拉先生 Mr. Karat —— 让每一枚婚戒，都值得被认真定制", 18, False, GOLD_LIGHT)],
         align=PP_ALIGN.CENTER)
add_text(s, Inches(1.5), Inches(5.1), Inches(10.33), Inches(0.5),
         [("Q & A", 20, True, WHITE)], align=PP_ALIGN.CENTER)

out = "/workspace/ppt/克拉先生_裂变项目总经理竞选PPT.pptx"
prs.save(out)
print("saved:", out)
