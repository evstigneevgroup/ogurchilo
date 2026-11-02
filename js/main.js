/* main.js — точка входа. Порядок: площадка -> хранилище -> UI */
(function () {
  'use strict';

  /* Видимая аварийная строка: в обёртках площадок (Telegram/VK/OK/Yandex)
     консоль недоступна — если игра падает, показываем текст прямо на экране. */
  window.addEventListener('error', function (e) {
    var line = document.getElementById('crash-line');
    if (!line) {
      line = document.createElement('div');
      line.id = 'crash-line';
      line.setAttribute('role', 'alert');
      document.body.appendChild(line);
    }
    var msg = (e && e.message) ? e.message : String(e && e.error || e || 'неизвестная ошибка');
    line.textContent = 'Ошибка игры: ' + msg + (e && e.lineno ? ' (файл ' + (e.filename || '').split('/').pop() + ', строка ' + e.lineno + ')' : '');
  });

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
