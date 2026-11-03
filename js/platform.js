/* platform.js — абстракция площадки: Telegram / VK / Одноклассники / веб.
   Игровое ядро и UI не знают, где запущены; здесь только интеграции. */
(function () {
  'use strict';

  function detect() {
    if (typeof window === 'undefined') return 'web';
    if (window.Telegram && window.Telegram.WebApp) return 'telegram';
    if (window.vkBridge) return 'vk';
    if (window.FAPI) return 'ok';
    return 'web';
  }

  /* безопасный вызов: интеграции не должны ронять игру */
  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  var Platform = {
    name: detect(),

    init: function () {
      if (window.__MARK) window.__MARK('площадка: ' + this.name);
      if (this.name === 'telegram') {
        safe(function () {
          var w = window.Telegram.WebApp;
          w.ready();
          w.expand();
          if (w.setHeaderColor) w.setHeaderColor('#59b93c');
          if (w.setBackgroundColor) w.setBackgroundColor('#59b93c');
        });
      } else if (this.name === 'vk') {
        safe(function () { window.vkBridge.send('VKWebAppInit'); });
      } else if (this.name === 'ok') {
        safe(function () {
          if (window.FAPI && window.FAPI.UI && window.FAPI.UI.setLoadingProgress) {
            window.FAPI.UI.setLoadingProgress(100);
          }
        });
      }
    },

    /* style: 'light' | 'success' */
    haptic: function (style) {
      if (this.name === 'telegram') {
        safe(function () {
          var H = window.Telegram.WebApp.HapticFeedback;
          if (!H) return;
          if (style === 'success') H.notificationOccurred('success');
          else H.impactOccurred('light');
        });
      }
      safe(function () {
        if (navigator.vibrate) navigator.vibrate(style === 'success' ? [30, 40, 30] : 12);
      });
    },

    /* мы реально внутри Telegram-вебвью (есть initData)? */
    inTG: function () {
      try {
        var tg = window.Telegram && window.Telegram.WebApp;
        return !!(tg && tg.initData && String(tg.initData).length > 0);
      } catch (e) { return false; }
    },

    /* шаринг результата: в Telegram — выбор чата, в браузере — системный шеринг,
       на десктопе — копирование. onDone(status): tg | shared | copied | failed */
    share: function (text, onDone) {
      var done = onDone || function () {};
      var self = this;
      var tg = window.Telegram && window.Telegram.WebApp;

      if (self.inTG() && tg && tg.openTelegramLink) {
        var opened = safe(function () {
          tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/ogurchilo_bot') +
            '&text=' + encodeURIComponent(text));
          return true;
        }, false);
        done(opened ? 'tg' : 'failed');
        return;
      }

      if (navigator.share) {
        try {
          navigator.share({ title: 'Огурчило', text: text, url: 'https://evstigneevgroup.github.io/ogurchilo/' })
            .then(function () { done('shared'); })
            .catch(function () { done('failed'); });
        } catch (e) { done('failed'); }
        return;
      }

      var copied = safe(function () {
        var ta = document.createElement('textarea');
        ta.value = text + ' — https://t.me/ogurchilo_bot';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }, false);
      done(copied ? 'copied' : 'failed');
    }
  };

  window.Platform = Platform;
})();
