#!/usr/bin/env python3
"""Сборка boot.html — диагностической лестницы для Telegram-вебвью.

Генерирует ogurchilo/boot.html: та же игра, но каждый слой подключается
по параметру ?stage=N, и каждый пройденный этап рисует плашку.

  stage=0   — только HTML + плашки (рендер-трубопровод)
  stage=1   — + весь CSS
  stage=2   — + SDK Telegram (локальный)
  stage=3   — + platform/storage/leaderboards/prizes
  stage=4   — + game.js (движок, без UI)
  stage=5   — + ui/main (полный boot)
  full      — всё сразу, как в продовой index.html

Запуск: python3 tools/build_boot.py   (из папки ogurchilo/)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def main() -> int:
    css = read("css/style.css")
    sdk = read("js/telegram-web-app.js")
    platform = read("js/platform.js")
    storage = read("js/storage.js")
    leaderboards = read("js/leaderboards.js")
    prizes = read("js/prizes.js")
    game = read("js/game.js")
    ui = read("js/ui.js")
    main_js = read("js/main.js")

    def safe_inject(marker: str, js_list) -> str:
        """document.write с блочками; "</" экранируем, чтобы не рвать скрипт."""
        parts = []
        for src in js_list:
            src = src.replace("</", "<\\/")
            parts.append("document.write('<scr' + 'ipt>' + \"%s\" + '</scr' + 'ipt>');"
                         % src.replace('"', '\\"').replace("\n", "\\n"))
        return marker + "\n" + "\n".join(parts)

    page = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#59b93c">
<title>Лестница стадий — Огурчило</title>
<script>
var PARAMS = new URLSearchParams(location.search);
var STAGE = PARAMS.get('stage') || 'full';
function at(n) {
  if (STAGE === 'full') return true;
  return parseInt(STAGE, 10) >= n;
}
</script>
<script>
window.__MARKS = [];
function mark(text, color) {
  var box = document.getElementById('log');
  if (!box) { window.__MARKS.push([text, color]); return; }
  var d = document.createElement('div');
  d.style.cssText = 'margin:8px 0;padding:10px 14px;border-radius:12px;color:#1d3a12;font:800 15px -apple-system,system-ui,sans-serif;background:' + color;
  d.textContent = text;
  box.appendChild(d);
}
window.onerror = function (m, s, l) {
  mark('ОШИБКА: ' + m + ' (' + (s || '').split('/').pop() + ':' + l + ')', '#ffb0a0');
};
</script>
<script>
window.addEventListener('DOMContentLoaded', function () {
  var box = document.getElementById('log');
  for (var i = 0; i < window.__MARKS.length; i++) mark(window.__MARKS[i][0], window.__MARKS[i][1]);
  window.__MARKS = [];
});
</script>
<style>
  body { margin: 0; background: #fffdf5; font-family: -apple-system, system-ui, sans-serif; }
  #hd { padding: 16px 18px 4px; }
  #hd h1 { font-size: 18px; margin: 0 0 4px; }
  #hd p { margin: 0; color: #4a6b3a; font-weight: 600; font-size: 14px; }
  #app { position: fixed; inset: 0; overflow: hidden; }
  #log { padding: 8px 18px 24px; position: absolute; inset: 0; overflow-y: auto; box-sizing: border-box; }
</style>
__CSS_BLOCK__
__JS_BLOCKS__
</head>
<body>
  <div id="hd"><h1>Лестница стадий (stage=__STAGE_DISPLAY__)</h1>
  <p>Плашки показывают, что успело выполниться до зависания.</p></div>
  <div id="app"><canvas id="game-canvas"></canvas></div>
  <div id="log"></div>
<script>
mark('HTML отрисован (stage=' + STAGE + ')', '#ffe9a8');
</script>
</body>
</html>"""

    # CSS на stage >= 1
    if True:
        css_block_script = (
            "<script>\n"
            "if (at(1)) {\n"
            "  var s = document.createElement('style');\n"
            "  s.textContent = \"" + css.replace('"', '\\"').replace("\n", "\\n").replace("</", "<\\/") + "\";\n"
            "  document.head.appendChild(s);\n"
            "  mark('1 · CSS применён', '#ffe9c8');\n"
            "}\n"
            "</script>\n"
        )
        page = page.replace("__CSS_BLOCK__", "") .replace("__JS_BLOCKS__", "")  # заглушку не пишем повторно
        # простая вставка: CSS и JS блоки добавим отдельными строками ниже
        page = page.replace("</head>", css_block_script + "__JS_BLOCKS__\n</head>", 1)

    js_blocks = []

    # SDK на stage >= 2
    sdk_inject = (
        "<script>\n"
        "if (at(2)) {\n"
        "  try {\n"
        "    var t = document.createElement('script');\n"
        "    t.textContent = " + repr(sdk).replace("</", "<\\/") + ";\n"
        "    document.head.appendChild(t);\n"
        "    mark('2 · SDK добавлен: ' + (window.Telegram && window.Telegram.WebApp ? 'есть' : 'нет'), '#a8ffcf');\n"
        "  } catch (e) { mark('2 · SDK упал: ' + e, '#ffb0a0'); }\n"
        "}\n"
        "</script>\n"
    )
    js_blocks.append(sdk_inject)

    # Наши модули на stage >= 3
    for label, name, src in [
        ('3 · platform.js выполнен', 'js/platform.js', platform),
        ('3 · storage.js выполнен', 'js/storage.js', storage),
        ('3 · leaderboards.js выполнен', 'js/leaderboards.js', leaderboards),
        ('3 · prizes.js выполнен', 'js/prizes.js', prizes),
    ]:
        src_e = src.replace('"', '\\"').replace("\n", "\\n").replace("</", "<\\/")
        js_blocks.append(
            "<script>\n"
            "if (at(3)) {\n"
            "  try {\n"
            "    var s = document.createElement('script');\n"
            "    s.textContent = \"" + src_e + "\";\n"
            "    document.head.appendChild(s);\n"
            "    mark('" + label + "', '#c8ffd0');\n"
            "  } catch (e) { mark('" + label.replace('выполнен', 'УПАЛ') + ": ' + e, '#ffb0a0'); }\n"
            "}\n"
            "</script>\n"
        )

    # game.js на stage >= 4 (создаёт канвас-движок)
    game_e = game.replace('"', '\\"').replace("\n", "\\n").replace("</", "<\\/")
    js_blocks.append(
        "<script>\n"
        "if (at(4)) {\n"
        "  try {\n"
        "    var s = document.createElement('script');\n"
        "    s.textContent = \"" + game_e + "\";\n"
        "    document.head.appendChild(s);\n"
        "    mark('4 · game.js выполнен, Game=' + (window.Game ? 'есть' : 'нет'), '#b8e0ff');\n"
        "    if (window.Game) { Game.init(); mark('4 · Game.init() прошёл', '#b8e0ff'); }\n"
        "  } catch (e) { mark('4 · game.js УПАЛ: ' + e, '#ffb0a0'); }\n"
        "}\n"
        "</script>\n"
    )

    # ui + main на stage >= 5 (полный boot)
    ui_e = ui.replace('"', '\\"').replace("\n", "\\n").replace("</", "<\\/")
    main_e = main_js.replace('"', '\\"').replace("\n", "\\n").replace("</", "<\\/")
    js_blocks.append(
        "<script>\n"
        "if (at(5)) {\n"
        "  try {\n"
        "    var u = document.createElement('script');\n"
        "    u.textContent = \"" + ui_e + "\";\n"
        "    document.head.appendChild(u);\n"
        "    mark('5 · ui.js выполнен (UI есть: ' + !!window.UI + ')', '#e0c8ff');\n"
        "  } catch (e) { mark('5 · ui.js УПАЛ: ' + e, '#ffb0a0'); }\n"
        "  try {\n"
        "    var m = document.createElement('script');\n"
        "    m.textContent = \"" + main_e + "\";\n"
        "    document.head.appendChild(m);\n"
        "    mark('5 · main.js выполнен (boot завершён)', '#ffd0e0');\n"
        "  } catch (e) { mark('5 · main.js УПАЛ: ' + e, '#ffb0a0'); }\n"
        "}\n"
        "</script>\n"
    )

    page = page.replace("__JS_BLOCKS__", "\n".join(js_blocks))
    page = page.replace("__STAGE_DISPLAY__", "\" + STAGE + \"")

    (ROOT / "boot.html").write_text(page, encoding="utf-8")
    print("OK: boot.html создан, %d байт" % (ROOT / "boot.html").stat().st_size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
