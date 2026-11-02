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

    /* шаринг результата в ленту/чаты площадки */
    share: function (text) {
      var self = this;
      if (self.name === 'telegram') {
        var ok = safe(function () {
          var w = window.Telegram.WebApp;
          if (w.openTelegramLink) {
            w.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent('https://t.me/') +
              '&text=' + encodeURIComponent(text));
            return true;
          }
          return false;
        }, false);
        if (ok) return;
      } else if (self.name === 'vk') {
        safe(function () { window.vkBridge.send('VKWebAppShare', { link: location.href }); });
        return;
      }
      /* веб-фолбэк: navigator.share либо копирование в буфер */
      if (navigator.share) {
        navigator.share({ title: 'Огурчило', text: text, url: location.href }).catch(function () {});
        return;
      }
      safe(function () {
        var ta = document.createElement('textarea');
        ta.value = text + ' ' + location.href;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        if (window.UI && UI.toast) UI.toast('Текст скопирован — вставь в чат!');
      });
    }
  };

  window.Platform = Platform;
})();
