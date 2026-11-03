#!/usr/bin/env python3
"""Огурчило — бот-выдаватель промокодов.

Работает на long polling (домен и HTTPS не нужны). Логика:
- /start                — приветствие и подсказка;
- web_app_data          — мини-апп прислал заявку на приз: выдать код из пула;
- пул кодов             — файл codes.json рядом ({"coffee": ["CODE1", ...], ...});
- учёт выдачи           — issued.json (user_id -> {prize_id: code}), один код на игрока на приз.

Запуск: python3 bot.py   (рекомендуется через systemd, см. deploy)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://api.telegram.org"

TOKEN = ""
STATE_PATH = HERE / "issued.json"
POOL_PATH = HERE / "codes.json"

# Сколько кодов выдаём за раз и тексты ответов
THRESHOLDS = {"coffee": 3, "food": 10, "cinema": 25, "merch": 50}
TITLES = {
    "coffee": "Хрустящий старт (кофе)",
    "food": "Чистильщик (промокод 300 ₽)",
    "cinema": "Шкуродёр (кино)",
    "merch": "Огуречная легенда (футболка)",
}


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def call(method: str, payload=None, timeout: int = 35):
    url = f"{API}/bot{TOKEN}/{method}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def send_text(chat_id: int, text: str) -> None:
    try:
        call("sendMessage", {"chat_id": chat_id, "text": text, "parse_mode": "HTML"})
    except Exception as e:
        print(f"[!] sendMessage error: {e}", flush=True)


def handle_claim(user_id: int, chat_id: int, username: str, prize_id: str) -> None:
    pool = load_json(POOL_PATH, {})
    issued = load_json(STATE_PATH, {})
    key = str(user_id)
    mine = issued.get(key, {})

    if prize_id not in THRESHOLDS:
        send_text(chat_id, "Неизвестный приз — загляни в игру ещё раз 🥒")
        return

    if prize_id in mine:
        send_text(chat_id, f"Ты уже забирал «{TITLES[prize_id]}».\n"
                           f"Твой код: <code>{mine[prize_id]}</code>")
        return

    queue = pool.get(prize_id) or []
    used = [v.get("code") for v in issued.values() if prize_id in v]
    free = [c for c in queue if c not in used]
    if not free:
        send_text(chat_id, "Коды на этот приз пока закончились — загляни позже! 🥒")
        return

    code = free[0]
    mine[prize_id] = code
    issued[key] = mine
    save_json(STATE_PATH, issued)
    send_text(chat_id, f"🎁 <b>{TITLES[prize_id]}</b>\n"
                       f"Твой промокод: <code>{code}</code>\n\n"
                       f"Спасибо, что чистишь огурцы!")


def handle_update(u: dict) -> None:
    msg = u.get("message") or u.get("edited_message")
    if not msg:
        return
    chat_id = msg.get("chat", {}).get("id")
    from_user = msg.get("from") or {}
    user_id = from_user.get("id")
    if not chat_id or not user_id:
        return
    username = from_user.get("username") or from_user.get("first_name") or "огурчанин"

    text = msg.get("text") or ""
    if text.startswith("/start claim_"):
        # глубокая ссылка из мини-аппа: /start claim_<prize>_<cukes>
        payload = text.split(" ", 1)[1]
        prize_id = payload.replace("claim_", "").split("_")[0]
        handle_claim(user_id, chat_id, username, prize_id)
        return
    if text.startswith("/start"):
        send_text(chat_id, "🥒 <b>Огурчило</b> — ты на базе!\n\n"
                           "Чисти огурцы в мини-приложении (кнопка «Играть» внизу), "
                           "а промокоды за цели забирай в игре — код пришлю сюда, в чат.")
        return
    if text.startswith("/codes"):
        pool = load_json(POOL_PATH, {})
        issued = load_json(STATE_PATH, {})
        used = {}
        for v in issued.values():
            for pid, code in v.items():
                used[pid] = used.get(pid, 0) + 1
        lines = ["<b>Пул кодов</b>"]
        for pid, queue in pool.items():
            lines.append(f"{pid}: свободно {max(0, len(queue) - used.get(pid, 0))} из {len(queue)}")
        send_text(chat_id, "\n".join(lines))
        return

    web_app = msg.get("web_app_data")
    if web_app:
        raw = web_app.get("data") or ""
        try:
            data = json.loads(raw)
        except Exception:
            send_text(chat_id, "Не понял заявку из игры — попробуй ещё раз 🥒")
            return
        prize_id = str(data.get("prize") or data.get("action") or "")
        handle_claim(user_id, chat_id, username, prize_id)


def main() -> int:
    global TOKEN
    env_path = HERE / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("BOT_TOKEN="):
                TOKEN = line.split("=", 1)[1].strip()
    if not TOKEN and os.environ.get("BOT_TOKEN"):
        TOKEN = os.environ["BOT_TOKEN"].strip()
    if not TOKEN:
        print("BOT_TOKEN не найден (.env или окружение)", flush=True)
        return 1

    offset = 0
    print("long polling запущен", flush=True)
    while True:
        try:
            resp = call("getUpdates", {
                "offset": offset,
                "timeout": 30,
                "allowed_updates": ["message", "edited_message"],
            })
            for u in resp.get("result", []):
                offset = max(offset, u["update_id"] + 1)
                try:
                    handle_update(u)
                except Exception as e:
                    print(f"[!] handle_update error: {e}", flush=True)
        except Exception as e:
            print(f"[!] polling error: {e}", flush=True)
            time.sleep(3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
