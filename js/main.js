/* main.js — точка входа. Порядок: площадка -> хранилище -> UI */
(function () {
  'use strict';

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
    Platform.init();
    Store.load();
    UI.init();
    console.log('OGURCHILO: демо-прототип готов. Площадка: ' + Platform.name);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
