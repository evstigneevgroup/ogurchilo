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


def code_of(entry):
    """Код из элемента пула: строка (старый формат) или {code, name, store}."""
    if isinstance(entry, dict):
        return entry.get('code')
    return entry


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
                           f"Твой код: <code>{code_of(mine[prize_id])}</code>")
        return

    queue = pool.get(prize_id) or []
    used = [code_of(v.get(prize_id)) for v in issued.values() if prize_id in v]
    free = [c for c in queue if code_of(c) not in used]
    if not free:
        send_text(chat_id, "Коды на этот приз пока закончились — загляни позже! 🥒")
        return

    entry = free[0]
    code = code_of(entry)
    if isinstance(entry, dict):
        name = entry.get('name') or TITLES[prize_id]
        store = entry.get('store') or ''
        link = entry.get('link') or ''
    else:
        name, store, link = TITLES[prize_id], '', ''

    mine[prize_id] = {'code': code, 'name': name, 'store': store}
    issued[key] = mine
    save_json(STATE_PATH, issued)
    head = f"🎁 <b>{name}</b>" + (f" — {store}" if store else '')
    tail = f"\n\n<a href=\"{link}\">Открыть магазин и применить купон</a>" if link else ''
    send_text(chat_id, f"{head}\n"
                       f"Твой промокод: <code>{code}</code>\n"
                       f"{tail}\n"
                       f"Спасибо, что чистишь огурцы!")


def handle_addcode(user_id: int, chat_id: int, args: list) -> None:
    """Только для админа: /addcode <слот> <КОД> [Название купона...]"""
    admin = os.environ.get('ADMIN_ID') or ''
    if not admin:
        if ENV.exists():
            for line in ENV.read_text(encoding='utf-8').splitlines():
                if line.startswith('ADMIN_ID='):
                    admin = line.split('=', 1)[1].strip()
    if str(user_id) != admin:
        send_text(chat_id, 'Эта команда только для владельца бота.')
        return
    if len(args) < 2:
        send_text(chat_id, 'Формат: /addcode <слот: coffee|food|cinema|merch> <КОД> [Название купона…]')
        return
    slot, code = args[0], args[1]
    name = ' '.join(args[2:]) or 'Купон партнёра'
    if slot not in THRESHOLDS:
        send_text(chat_id, 'Слоты: coffee | food | cinema | merch')
        return
    pool = load_json(POOL_PATH, {})
    pool.setdefault(slot, []).append({'code': code.strip(), 'name': name[:90], 'store': 'Запрошен вручную'})
    save_json(POOL_PATH, pool)
    free_count = len(pool[slot])
    send_text(chat_id, f'✅ Добавил в пул «{TITLES[slot]}»: <code>{code.strip()}</code>\n'
                       f'Всего кодов в слоте: {free_count}')


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

    if os.environ.get('OGUR_LOG_UIDS') == '1':
        print(f"[uid] {user_id} @{username} chat:{chat_id}", flush=True)

    text = msg.get("text") or ""
    if text.startswith("/admin"):
        code = text.split()[1] if len(text.split()) > 1 else ''
        expected = os.environ.get('ADMIN_PASSCODE', '')
        if expected and code == expected:
            if os.environ.get('ADMIN_ID') and os.environ.get('ADMIN_ID') != str(user_id):
                send_text(chat_id, 'Админ уже назначен.')
            else:
                env_path = HERE / '.env'
                lines = env_path.read_text(encoding='utf-8').splitlines() if env_path.exists() else []
                if not any(l.startswith('ADMIN_ID=') for l in lines):
                    lines.append('ADMIN_ID=' + str(user_id))
                    env_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
                    os.environ['ADMIN_ID'] = str(user_id)
                send_text(chat_id, '👑 Ты админ. Теперь /addcode <слот> <КОД> [Название] — пополнение пула.')
        else:
            send_text(chat_id, 'Не то слово.')
        return
    if text.startswith("/start claim_"):
        # глубокая ссылка из мини-аппа: /start claim_<prize>_<cukes>
        payload = text.split(" ", 1)[1]
        prize_id = payload.replace("claim_", "").split("_")[0]
        handle_claim(user_id, chat_id, username, prize_id)
        return
    if text.startswith("/addcode"):
        handle_addcode(user_id, chat_id, text.split()[1:] if len(text.split()) > 1 else [])
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
    # .env целиком в окружение (systemd не передаёт его сам)
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    TOKEN = os.environ.get("BOT_TOKEN", "").strip()
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
