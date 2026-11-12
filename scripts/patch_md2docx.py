"""把 C 的 md2docx.py 改成接受命令行参数（源 md 与目标 docx）。只改路径定义，其余逻辑不动。"""
import io
import sys

src = r"C:\Users\hjr\Desktop\食鉴-C角色交付包_v1.0\食鉴-C角色交付包\07_工具\md2docx.py"
dst = r"C:\Users\hjr\Desktop\czb比赛\scripts\md2docx.py"

s = io.open(src, encoding="utf-8").read()

old_src = 'SRC = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.md")'
old_dst = 'DST = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.docx")'

if old_src not in s:
    print("anchor not found")
    sys.exit(1)

new = """if len(sys.argv) >= 3:
    SRC = sys.argv[1]
    DST = sys.argv[2]
else:
    SRC = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.md")
    DST = os.path.join(ROOT, "05_文档", "技术文档_食鉴_v1.0.docx")"""

s = s.replace(old_src + "\n" + old_dst, new, 1)
io.open(dst, "w", encoding="utf-8").write(s)
print("patched ->", dst)
