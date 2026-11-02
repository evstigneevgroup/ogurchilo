/* main.js — точка входа. Порядок: площадка -> хранилище -> UI */
(function () {
  'use strict';

  /* Сигнал жизни для обёртки shell.html (когда игра открыта в рамке) */
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage('ogurchilo:alive', '*');
    }
  } catch (e) { /* без обёртки — ничего не делаем */ }

  /* Режим ?diag=N: шаги загрузки рисуются плашками на экране —
     способ поймать «тихие» зависания в вебвью площадок. */
  function makeMark() {
    var box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:60px;left:10px;right:10px;z-index:70';
    document.body.appendChild(box);
    window.__MARK = function (text) {
      var d = document.createElement('div');
      d.style.cssText = 'margin:6px 0;padding:8px 12px;border-radius:10px;background:#dfe9d0;color:#1d3a12;font:700 12px -apple-system,system-ui,sans-serif;white-space:pre-wrap';
      d.textContent = '✓ ' + text;
      box.appendChild(d);
    };
  }
  if (location.search.indexOf('diag') !== -1) {
    if (document.body) makeMark(); else document.addEventListener('DOMContentLoaded', makeMark);
  } else {
    window.__MARK = function () {};
  }

  /* Видимая аварийная строка: в обёртках площадок (Telegram/VK/OK/Yandex)
     консоль недоступна — если игра падает, показываем текст прямо на экране. */
  function reportGameError(text) {
    var line = document.getElementById('crash-line');
    if (!line) {
      line = document.createElement('div');
      line.id = 'crash-line';
      line.setAttribute('role', 'alert');
      document.body.appendChild(line);
    }
    line.textContent = 'Ошибка игры: ' + text;
    if (window.console && console.error) console.error('[Огурчило] ' + text);
  }
  window.reportGameError = reportGameError;

  window.addEventListener('error', function (e) {
    var msg = e && e.message ? e.message : String((e && e.error) || e || 'неизвестная ошибка');
    var suffix = e && e.lineno ? ' — ' + (e.filename || '').split('/').pop() + ':' + e.lineno : '';
    reportGameError(msg + suffix);
  });

  /* Диагностический уголок: показывает загрузку, каждый контакт с пальцем
     (в фазе перехвата — видно даже если клик «съесть» какой-то слой)
     и каждый подтверждённый клик. Помогает искать «молчащие» клики
     в вебвью площадок, где консоль недоступна. */
  function makeDiag() {
    var d = document.createElement('div');
    d.id = 'diag';
    d.setAttribute('aria-hidden', 'true');
    document.body.appendChild(d);
  }
  makeDiag();
  window.__diag = function (text) {
    var d = document.getElementById('diag');
    if (d) d.textContent = text;
  };
  window.__clicks = 0;

  function pressCapture(e) {
    try {
      var t = e.target;
      var label = t && t.id ? '#' + t.id : (t && t.tagName ? t.tagName.toLowerCase() : '?');
      window.__diag('контакт ' + e.type + ' → ' + label);
    } catch (err) { /* диагностика не должна ничего ломать */ }
  }
  window.addEventListener('pointerdown', pressCapture, true);
  window.addEventListener('touchstart', pressCapture, { capture: true, passive: true });

  function boot() {
    window.__MARK('boot: площадка');
    Platform.init();
    window.__MARK('boot: хранилище');
    Store.load();
    window.__MARK('boot: интерфейс');
    UI.init();
    console.log('OGURCHILO: демо-прототип готов. Площадка: ' + Platform.name);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
