#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
把 05_文档/技术文档_食鉴_v1.0.md 转成排版好的 DOCX（A4 / 小四 / 1.5 倍行距 / 页脚页码）。

用法：
    python 07_工具/md2docx.py
依赖：python-docx（DSH 运行时已内置）
说明：这是 C 角色的交付工具，不追求完整的 Markdown 支持，只覆盖技术文档里用到的语法：
      标题、段落、无序/有序列表、表格、代码块、引用块、行内加粗与行内代码。
"""

import os
import re
import sys

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) >= 3:
    SRC = sys.argv[1]
    DST = sys.argv[2]
else:
    SRC = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.md")
    DST = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.docx")

BODY_FONT_CN = "宋体"
BODY_FONT_EN = "Times New Roman"
CODE_FONT = "Consolas"
GRAY = RGBColor(0x59, 0x59, 0x59)
HEAD_COLOR = RGBColor(0x1F, 0x3A, 0x5F)


def set_run_font(run, cn=BODY_FONT_CN, en=BODY_FONT_EN, size=None, bold=None,
                 italic=None, color=None):
    run.font.name = en
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:eastAsia"), cn)
    rfonts.set(qn("w:ascii"), en)
    rfonts.set(qn("w:hAnsi"), en)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color


def shade(cell_or_para_element, hex_fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    cell_or_para_element.append(shd)


def add_inline(paragraph, text, size=12, base_bold=False):
    """解析 **加粗** 与 `代码`，其余按普通文本。"""
    tokens = re.split(r"(\*\*.+?\*\*|`[^`]+`)", text)
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**") and len(tok) > 4:
            run = paragraph.add_run(tok[2:-2])
            set_run_font(run, size=size, bold=True)
        elif tok.startswith("`") and tok.endswith("`") and len(tok) > 2:
            run = paragraph.add_run(tok[1:-1])
            set_run_font(run, cn=CODE_FONT, en=CODE_FONT, size=size - 1.5)
        else:
            run = paragraph.add_run(tok)
            set_run_font(run, size=size, bold=base_bold)


def add_footer_page_number(section):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run._r.append(fld_begin)
    run._r.append(instr)
    run._r.append(fld_end)
    set_run_font(run, size=9)


def style_document(doc):
    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT_EN
    normal.font.size = Pt(12)
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT_CN)
    pf = normal.paragraph_format
    pf.line_spacing_rule = WD_LINE_SPACING.ONE_POINT_FIVE
    pf.space_before = Pt(0)
    pf.space_after = Pt(4)

    for name, size in (("Heading 1", 18), ("Heading 2", 15), ("Heading 3", 13), ("Heading 4", 12)):
        st = doc.styles[name]
        st.font.name = BODY_FONT_EN
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = HEAD_COLOR
        st.element.rPr.rFonts.set(qn("w:eastAsia"), "黑体")
        st.paragraph_format.space_before = Pt(12 if name != "Heading 4" else 8)
        st.paragraph_format.space_after = Pt(6)
        st.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE


def parse_table(lines, start):
    """返回 (rows, next_index)；rows 为二维字符串数组（已去掉分隔行）。"""
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        raw = lines[i].strip().strip("|")
        cells = [c.strip() for c in raw.split("|")]
        if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            rows.append(cells)
        i += 1
    return rows, i


def build():
    with open(SRC, "r", encoding="utf-8") as f:
        lines = f.read().split("\n")

    doc = Document()
    style_document(doc)

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.top_margin = Cm(2.4)
    sec.bottom_margin = Cm(2.2)
    sec.left_margin = Cm(2.6)
    sec.right_margin = Cm(2.4)
    add_footer_page_number(sec)

    i = 0
    in_code = False
    code_buf = []
    first_h1_done = False

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # 代码块
        if stripped.startswith("```"):
            if not in_code:
                in_code, code_buf = True, []
            else:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.6)
                p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(6)
                shade(p._p.get_or_add_pPr(), "F4F6F8")
                for idx, cl in enumerate(code_buf):
                    run = p.add_run(cl)
                    set_run_font(run, cn=CODE_FONT, en=CODE_FONT, size=9)
                    if idx < len(code_buf) - 1:
                        run.add_break()
                in_code = False
            i += 1
            continue
        if in_code:
            code_buf.append(line.rstrip())
            i += 1
            continue

        # 分隔线
        if re.fullmatch(r"-{3,}", stripped):
            i += 1
            continue

        # 表格
        if stripped.startswith("|"):
            rows, i = parse_table(lines, i)
            if not rows:
                continue
            ncol = max(len(r) for r in rows)
            table = doc.add_table(rows=0, cols=ncol)
            table.style = "Table Grid"
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            for ri, row in enumerate(rows):
                cells = table.add_row().cells
                for ci in range(ncol):
                    text = row[ci] if ci < len(row) else ""
                    cell = cells[ci]
                    para = cell.paragraphs[0]
                    para.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
                    para.paragraph_format.space_after = Pt(1)
                    add_inline(para, text, size=9, base_bold=(ri == 0))
                    if ri == 0:
                        shade(cell._tc.get_or_add_tcPr(), "E8EEF6")
            doc.add_paragraph().paragraph_format.space_after = Pt(2)
            continue

        # 标题
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            level = len(m.group(1))
            text = m.group(2).strip()
            if level == 1 and not first_h1_done:
                p = doc.add_paragraph()
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_before = Pt(60)
                p.paragraph_format.space_after = Pt(18)
                run = p.add_run(text.replace("·", " · "))
                set_run_font(run, cn="黑体", size=24, bold=True, color=HEAD_COLOR)
                first_h1_done = True
            elif level == 1:
                doc.add_page_break()
                h = doc.add_heading(level=1)
                add_inline(h, text, size=18)
                for r in h.runs:
                    set_run_font(r, cn="黑体", size=18, bold=True, color=HEAD_COLOR)
            else:
                h = doc.add_heading(level=level)
                add_inline(h, text, size={2: 15, 3: 13, 4: 12}[level])
                for r in h.runs:
                    r.font.color.rgb = HEAD_COLOR
                    r.font.bold = True
            i += 1
            continue

        # 引用
        if stripped.startswith(">"):
            text = stripped.lstrip("> ").strip()
            if text:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.8)
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(6)
                add_inline(p, text, size=10.5)
                for r in p.runs:
                    r.font.color.rgb = GRAY
                    r.font.italic = True
            i += 1
            continue

        # 列表
        m = re.match(r"^[-*]\s+(.*)$", stripped)
        if m:
            p = doc.add_paragraph(style="List Bullet")
            add_inline(p, m.group(1))
            i += 1
            continue
        m = re.match(r"^\d+[.、]\s+(.*)$", stripped)
        if m:
            p = doc.add_paragraph(style="List Number")
            add_inline(p, m.group(1))
            i += 1
            continue

        # 空行
        if not stripped:
            i += 1
            continue

        # 普通段落
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Cm(0)
        add_inline(p, stripped)
        i += 1

    doc.save(DST)
    print("OK ->", DST)


if __name__ == "__main__":
    build()
