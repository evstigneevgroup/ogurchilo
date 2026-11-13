# HANDOFF — Огурчило 🥒 (для восстановления контекста)

Дата последнего обновления: 2026-11-05
Фраза продолжения: **«продолжаем огурчило»** → прочитать этот файл целиком.

---

## 1. Что это за проект
Telegram Mini App игра-кликер: тапами чистим огурец (рука ходит вверх-вниз), соревнуемся с друзьями/случайными игроками, за цели получаем реальные промикоды от партнёрской сети (Mitgo/Admitad). HTML5 без зависимостей, один файл в проде.

## 2. Артефакты и доступы
| Что | Где |
|---|---|
| Локальная папка | `/Users/romanevstigneev/Documents/Проект по умолчанию/ogurchilo/` |
| Git | `git@github.com:evstigneevgroup/ogurchilo.git` (SSH-ключ `~/.ssh/id_ed25519_github`, работает) |
| Прод (основной) | https://evstigneevgroup.github.io/ogurchilo/ |
| Прод (резерв) | https://ogurchilo-odrvd.netlify.app/ — netlify-cli отдает `Forbidden`, токен протух |
| VPS | `root@89.208.106.212` (ключ `~/.ssh/aeza_vnb_key`), бот: `/opt/ogurchilo-bot/`, systemd-юнит `ogurchilo-bot.service`, лог: `journalctl -u ogurchilo-bot` |
| Бот TG | @ogurchilo_bot, `BOT_TOKEN` в `ogurchilo/.env` и `/opt/ogurchilo-bot/.env` |
| Mitgo | сайт 3018210; OAuth-секрет (`ADMITAD_BASE64_HEADER`) в `/opt/ogurchilo-bot/.env`; scope: `advcampaigns_for_website coupons_for_website` |
| Верификация Mitgo | код «2aab» стоит на главной игры — НЕ удалять до апрува модерации |
| Аватар бота | `ogurchilo/branding/bot-avatar.png` (генератор: `branding/make_avatar.py`) — юзер ставит через BotFather /setuserpic |
| Кнопка бота | ведёт на ПРЯМОЙ `index.html?v=5` (shell.html убран — initData не доезжает в iframe) |

## 3. Как собирать и деплоить (важно!)
1. **Единственный исходник фронтенда — `index.src.html`** (многофайловый). Прод-файл `index.html` генерируется: `python3 tools/build_inline.py` (css+js инлайн, ~197КБ). index.html руками не править!
2. Деплой фронта: build → клон gh-репо во временный каталог → rsync → commit → push. Pages пересобирается ~1 мин, проверять **маркером** в served-файле.
3. shell.html грузит игру с динамическим cache-buster `?nc=Date.now()` (вебвью любит кэш; одиночный bump v=N помогает один раз).
4. Деплой бота: `rsync bot.py root@89.208.106.212:/opt/ogurchilo-bot/` → `systemctl restart ogurchilo-bot`.
5. Проверка синтаксиса после правок: `node --check js/*.js`, `python3 -m py_compile bot/*.py`.
6. Пушить через SSH (GitHub-ключ); если «Connection closed» — ретрай через 15-30с.

## 4. Технические ловушки (ЗАПОМНИТЬ)
1. **`WebApp.sendData` не работает из menu-button** — выдача призов сделана через deep link `t.me/ogurchilo_bot?start=claim_<приз>_<прогресс>`, бот парсит payload.
2. **initData не доезжает в iframe** — поэтому shell.html был убран; мини-апп должен открываться топ-левел (кнопка бота → index.html).
3. **Desktop-TG не поддерживает CloudStorage** (v<6.9, `WebAppMethodUnsupported`) — в ui.js обёрнуто isVersionAtLeast-guard'ом: просто играем без облачной синхронизации.
4. **Нулевая геометрия канваса → вечный цикл отрисовки** (полоски шкурки с шагом 0) — это было «зависание» в вебвью. Guard: layout() fallback на window.innerWidth/innerHeight + ранний return в drawCucumber.
5. **Поле купона в API называется `promocode`** (не `promo_code`!). Персональные купоны (Store, «Запросить код») в общий фид `/coupons/website/{id}/` НЕ попадают — пул пополняется командой `/addcode` в боте.
6. **systemd не подставляет .env** в окружение — bot.py сам читает .env в os.environ в main().
7. **Вкладки агентского браузера спят** (rAF/таймеры замораживаются между CDP-вызовами) — игровые таймеры тестируются форсом `Game.start(2)` (принимает секунды).
8. **api.telegram.org периодически молчит из РФ** (пустые ответы) — ретраи с паузами.
9. Токены, светившиеся в чате (BOT_TOKEN бота, ADMITAD_BASE64_HEADER) — **перевыпустить** после стабилизации: BotFather /revoke и «Сбросить данные» в Mitgo, обновить оба `.env`.

## 5. Текущее состояние (на 2026-11-05)
Работает:
- Игра во всех трёх средах (TG Desktop, iPhone, браузер): раунд 15с, ~12 тапов/огурец, золотой каждый 3-й (×2), комбо до ×12, тики финала + гудок, финиш-кадр (5 слоганов, 1.5с), панель результата с count-up и мёртвыми зонами по краям.
- Титулы (10/30/70/140 огурцов) с прогресс-баром, задание дня (детерминированное от даты) + стрик дней, живой фон, шаринг результата (TG — выбор чата, веб — системный шеринг/копирование).
- Бот на VPS: /start, /codes (остатки пула), /admin krust-72aa-ogur (назначить админа), /addcode <слот> <код> [название] (админ), выдача призов по deep link с учётом «один код — один игрок», повторное «Забрать» возвращает твой код.
- Прогресс игрока: localStorage + Telegram CloudStorage (где поддерживается).
- Mitgo: площадка 3018210, API-токен работает, но фид купонов пуст (см. ниже).

Не доделано / открыто:
1. **Юзер не написал боту `/admin krust-72aa-ogur`** — ждали подтверждения. После этого `/addcode` активен.
2. **Реальные купоны** — юзер запрашивает коды в Store («Запросить код» у подключённых программ) и вносит через `/addcode`. Автоматический фид: у подключённых кампаний (KASSIR, afisha) в `/coupons/website/3018210/` сейчас 0 купонов — персональные коды не попадают в фид; можно изучить Store API «промо-предложения» позже.
3. **Модерация Mitgo** — ждём апрува (2–72ч), код 2aab на главной.
4. **Netlify** — обновить авторизацию (`npx netlify-cli login`) при необходимости.
5. **Безопасность** — перевыпустить BOT_TOKEN и ADMITAD (см. ловушки).
6. **Идеи на рост**: настоящие рейтинги друзей (бэкенд на VPS + initData-валидация), «идеальные тапы» по полоске, молния «+5 сек», типы огурцов, ежедневный автопостинг, каталог Telegram (Apps Center), рефералка («пригласи друга — промик обоим»).

## 6. Хранение данных
- Прогресс игрока: localStorage `ogurchilo:v2` (v2 = формат под 15-секундные раунды) + CloudStorage ключ `ogurchilo_progress`.
- Пул призов: `/opt/ogurchilo-bot/codes.json` — формат `{"coffee": [{"code","name","store","link"}, ...]}` (строки старого формата тоже поддержаны).
- Выданные коды: `/opt/ogurchilo-bot/issued.json` (user_id → {prize: {...}}).
- Призовые ступени (в `js/prizes.js`): 2/6/15/30 огурцов; титулы там же (RANKS).

## 7. Быстрые команды
```bash
# фронт: пересобрать и выложить
cd ogurchilo && python3 tools/build_inline.py
# GitHub: клон во временный каталог, rsync, commit, push (SSH)
# bot: обновить и перезапустить
rsync bot/bot.py root@89.208.106.212:/opt/ogurchilo-bot/ && ssh root@89.208.106.212 systemctl restart ogurchilo-bot
# логи бота
ssh root@89.208.106.212 journalctl -u ogurchilo-bot -n 20 --no-pager
# импортёр вручную
ssh root@89.208.106.212 cd /opt/ogurchilo-bot && python3 importer.py
```
