#!/usr/bin/env python3
"""Сборка «Огурчило» в один файл.

Читает ogurchilo/index.html, инлайнит css/style.css и все js/* (в порядке
подключения) и перезаписывает index.html. Зачем: Telegram-вебвью на части
сетей подвисает на пачке подресурсов; страница без внешних файлов
(ts-диагностика tgtest.html) работает. Один файл = один запрос = нулевые
проблемы с кэшем и сетью.

Запуск:  python3 tools/build_inline.py   (из папки ogurchilo/)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    original = html

    # CSS: <link rel="stylesheet" href="css/style.css??v=N">
    link_re = re.compile(
        r'[ \t]*<link rel="stylesheet" href="css/(style\.css)(?:\?[^"]*)?">[ \t]*\n?'
    )

    def inline_css(match: re.Match) -> str:
        css = (ROOT / "css" / match.group(1)).read_text(encoding="utf-8")
        return "<style>\n" + css + "\n</style>\n"

    html = link_re.sub(inline_css, html)

    # JS: <script src="js/имя.js??v=N"></script> — в порядке следования
    script_re = re.compile(
        r'<script src="js/([A-Za-z0-9_\-\.]+\.js)(?:\?[^"]*)?"></script>'
    )

    def inline_js(match: re.Match) -> str:
        name = match.group(1)
        js = (ROOT / "js" / name).read_text(encoding="utf-8")
        return "<script>\n" + js + "\n</script>"

    html = script_re.sub(inline_js, html)

    leftovers = re.findall(r'<(?:script src|link rel="stylesheet")[^>]*>', html)
    if leftovers:
        print("ВНИМАНИЕ: не все ресурсы инлайнены:", *leftovers, sep="\n  ")
        return 1

    html_path.write_text(html, encoding="utf-8")
    print("OK: index.html пересобран в один файл")
    print("  размер: %d -> %d байт" % (len(original), len(html)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
