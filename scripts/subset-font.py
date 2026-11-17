"""
从系统字体里裁出项目实际用到的字，生成 woff2，放到 public/fonts/。

为什么用可变字体而不是单一字重：
  裁的是 NotoSerifSC-VF，保留 200–900 整段字重轴。单一 900 撑不起大刊头
  （60px 的 900 重得像砖），而 400 才有旧书题签的轻。有轴就不用二选一。

为什么不直接用系统字体：
  评委和手机上没有装思源宋体，CSS 只会回退到宋体并伪粗，
  标题会糊成一团。打包一份子集，换谁打开都长一样。

用法（在项目根目录）：
  python scripts/subset-font.py

依赖：pip install fonttools brotli
"""

import os
import re
import sys

SRC_FONT = r"C:\Windows\Fonts\NotoSerifSC-VF.ttf"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "fonts")
OUT_FILE = os.path.join(OUT_DIR, "han.woff2")

SKIP_DIRS = {"node_modules", ".nuxt", ".output", "_tools", ".git", "data", "docs"}
EXTS = (".vue", ".ts", ".js", ".json", ".md", ".html", ".css")

# 除了项目里出现的字，再补一批常用字和标点，避免新写一句话就掉回宋体
EXTRA = (
    "，。、；：？！（）《》【】「」『』“”‘’—…·￥%"
    "0123456789"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "abcdefghijklmnopqrstuvwxyz"
)


def collect_chars(root: str) -> str:
    chars = set()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith(EXTS):
                continue
            path = os.path.join(dirpath, name)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            chars.update(re.findall(r"[\u4e00-\u9fff]", text))
    return "".join(sorted(chars))


def main() -> int:
    if not os.path.exists(SRC_FONT):
        print(f"[!] 找不到源字体：{SRC_FONT}")
        return 1

    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    han = collect_chars(root)
    text = han + EXTRA
    print(f"[i] 项目用字 {len(han)} 个，连同标点共 {len(text)} 个")

    os.makedirs(OUT_DIR, exist_ok=True)
    text_file = os.path.join(OUT_DIR, "_chars.txt")
    with open(text_file, "w", encoding="utf-8") as f:
        f.write(text)

    from fontTools import subset

    args = [
        SRC_FONT,
        f"--text-file={text_file}",
        f"--output-file={OUT_FILE}",
        "--flavor=woff2",
        "--layout-features=*",
        "--no-hinting",
        "--desubroutinize",
    ]
    subset.main(args)

    os.remove(text_file)
    size = os.path.getsize(OUT_FILE)
    print(f"[ok] {OUT_FILE}  {size / 1024:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
