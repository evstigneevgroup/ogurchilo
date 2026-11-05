#!/usr/bin/env python3
"""Импортёр купонов Admitad/Mitgo -> пул бота «Огурчило».

Что делает:
  1. Берёт client_id/client_secret из .env (или окружения).
  2. Получает OAuth-токен (client_credentials).
  3. Тянет купоны фида, фильтрует: есть промокод, не истёк.
  4. Раскладывает по слотам игры (coffee/food/cinema/merch) по ключевым словам
     магазина; остатки — по кругу.
  5. Пишет codes.json в формате {"слот": [{"code","name","store"}, ...]}.

Запуск вручную:  python3 importer.py
Cron: каждые 6 часов (см. установку).
"""
import base64
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV = HERE / '.env'
CODES_PATH = HERE / 'codes.json'
SLOTS = ['coffee', 'food', 'cinema', 'merch']
PER_SLOT = 8

KEYWORDS = {
    'coffee': ['кофе', 'coffee', 'напиток', 'ресторан', 'пекарн', 'кофейн'],
    'food': ['еда', 'доставк', 'пицц', 'суши', 'продукт', 'маркетплейс', 'супермаркет', 'вкусвилл', 'самокат'],
    'cinema': ['кино', 'cinema', 'кинотеатр', 'ivi', 'окко', 'кино1', 'фильм', 'стрим'],
    'merch': ['одежд', 'футболк', 'мерч', 'shop', 'мод', 'обув', 'принт'],
}


def env_val(name: str):
    if name in os.environ:
        return os.environ[name].strip()
    if ENV.exists():
        for line in ENV.read_text(encoding='utf-8').splitlines():
            if line.startswith(name + '='):
                return line.split('=', 1)[1].strip()
    return None


def http_json(url: str, data=None, headers=None, timeout: int = 30):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))


def get_token() -> str:
    cid = env_val('ADMITAD_CLIENT_ID')
    csec = env_val('ADMITAD_CLIENT_SECRET')
    if not cid or not csec:
        raise SystemExit('Нет ADMITAD_CLIENT_ID / ADMITAD_CLIENT_SECRET в .env')
    basic = base64.b64encode(f'{cid}:{csec}'.encode()).decode()
    body = urllib.parse.urlencode({'grant_type': 'client_credentials'}).encode()
    data = http_json('https://api.admitad.com/token/', data=body, headers={
        'Authorization': 'Basic ' + basic,
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    return data['access_token']


def fetch_coupons(token: str, website_id: str):
    """Пробуем фид купонов площадки; при 404 — общий фид купонов."""
    headers = {'Authorization': 'Bearer ' + token}
    urls = [
        f'https://api.admitad.com/coupons/website/{website_id}/?limit=100',
        'https://api.admitad.com/coupons/?limit=100',
    ]
    for url in urls:
        try:
            data = http_json(url, headers=headers)
            if isinstance(data, dict) and 'results' in data:
                return data['results']
        except Exception as e:
            print(f'[!] {url} -> {e}')
    return []


def not_expired(c: dict) -> bool:
    de = c.get('date_end')
    if not de:
        return True
    try:
        return datetime.fromisoformat(de.replace('Z', '+00:00')) > datetime.now(timezone.utc)
    except Exception:
        return True


def slot_for(coupon: dict, index: int) -> str:
    text = (coupon.get('name', '') + ' ' +
            (coupon.get('campaign') or {}).get('name', '')).lower()
    for slot, words in KEYWORDS.items():
        if any(w in text for w in words):
            return slot
    return SLOTS[index % len(SLOTS)]


def main() -> int:
    website_id = env_val('ADMITAD_WEBSITE_ID') or '3018210'
    token = get_token()
    coupons = [c for c in fetch_coupons(token, website_id)
               if c.get('promo_code') and not_expired(c)]
    print(f'купонов с кодами: {len(coupons)}')

    pools = {s: [] for s in SLOTS}
    seen = set()
    idx = 0
    for c in coupons:
        code = (c.get('promo_code') or '').strip()
        if not code or code in seen:
            continue
        seen.add(code)
        camp = c.get('campaign') or {}
        entry = {
            'code': code,
            'name': (c.get('name') or 'Купон партнёра').strip()[:90],
            'store': (camp.get('name') or '').strip()[:40],
        }
        pools[slot_for(c, idx)].append(entry)
        idx += 1

    out = {s: pools[s][:PER_SLOT] for s in SLOTS}
    CODES_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print('записан', CODES_PATH, ':', {k: len(v) for k, v in out.items()})
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
