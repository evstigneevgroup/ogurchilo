/* storage.js — локальное сохранение прогресса (позже заменится бэкендом) */
(function () {
  'use strict';

  var KEY = 'ogurchilo:v1';
  var DEFAULTS = {
    best: 0,        // лучший результат за раунд
    totalScore: 0,  // очки за всё время
    totalCukes: 0,  // огурцов очищено за всё время (топливо для призов)
    rounds: 0,
    lastScore: 0,
    lastCukes: 0,
    claimed: {},    // id приза -> true
    sound: true
  };

  var Store = {
    KEY: KEY,
    state: null,

    load: function () {
      var s = null;
      try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
      var merged = Object.assign({}, DEFAULTS, s || {});
      if (!merged.claimed || typeof merged.claimed !== 'object') merged.claimed = {};
      Store.state = merged;
      return merged;
    },

    save: function () {
      try { localStorage.setItem(KEY, JSON.stringify(Store.state)); } catch (e) { /* приватный режим */ }
    }
  };

  window.Store = Store;
})();
