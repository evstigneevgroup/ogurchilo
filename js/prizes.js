/* prizes.js — ступени призов от партнёрской сети.
   Демо-конфиг: коды вымышленные. На проде список и выдача кодов — через бэкенд,
   поэтому структура данных повторяет будущий API (id, needCukes, code, state). */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var LIST = [
    { id: 'coffee', needCukes: 2,  title: 'Хрустящий старт',   desc: 'Купон на кофе от партнёра',        partner: 'Mitgo · Admitad', code: 'OGUR-CAF-2026' },
    { id: 'food',   needCukes: 6,  title: 'Чистильщик',        desc: 'Купон на доставку/продукты',      partner: 'Mitgo · Admitad', code: 'OGUR-EDAL-300' },
    { id: 'cinema', needCukes: 15, title: 'Шкуродёр',          desc: 'Купоны на кино и стриминги',       partner: 'Mitgo · Admitad', code: 'OGUR-CIN-2X1' },
    { id: 'merch',  needCukes: 30, title: 'Огуречная легенда', desc: 'Футболка «Я чищу огурцы»',         partner: 'Огурчило',        code: null }
  ];

  function statuses(totalCukes, claimedMap) {
    var map = claimedMap || {};
    return LIST.map(function (p) {
      var isClaimed = !!map[p.id];
      var state = isClaimed ? 'claimed' : (totalCukes >= p.needCukes ? 'ready' : 'locked');
      return {
        id: p.id,
        title: p.title,
        desc: p.desc,
        partner: p.partner,
        needCukes: p.needCukes,
        code: isClaimed ? (p.code || 'мерч в боте') : '? ? ?',
        state: state
      };
    });
  }

  function progress(totalCukes) {
    var next = LIST.filter(function (p) { return totalCukes < p.needCukes; })[0] || null;
    var pct = 1;
    if (next) {
      var prevNeed = 0;
      for (var i = 0; i < LIST.length; i++) {
        if (LIST[i] === next) break;
        prevNeed = LIST[i].needCukes;
      }
      pct = clamp((totalCukes - prevNeed) / (next.needCukes - prevNeed), 0, 1);
    }
    return { next: next, pct: pct, allDone: !next };
  }

  function byId(id) {
    return LIST.filter(function (p) { return p.id === id; })[0] || null;
  }

  /* ---------- титулы игрока (растут от общего числа огурцов) ---------- */
  var RANKS = [
    { need: 0,   title: 'Новичок грядки',      emoji: '🌱' },
    { need: 10,  title: 'Хрустящий',           emoji: '🥒' },
    { need: 30,  title: 'Чистильщик',          emoji: '✨' },
    { need: 70,  title: 'Мастер шкуродёр',     emoji: '🏆' },
    { need: 140, title: 'Огуречный легенда',   emoji: '👑' }
  ];

  function rankFor(totalCukes) {
    var cur = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (totalCukes >= RANKS[i].need) cur = RANKS[i];
      else { next = RANKS[i]; break; }
    }
    var pct = next ? clamp((totalCukes - cur.need) / (next.need - cur.need), 0, 1) : 1;
    return { title: cur.title, emoji: cur.emoji, need: cur.need, next: next, pct: pct };
  }

  window.Prizes = { list: LIST, statuses: statuses, progress: progress, byId: byId, rankFor: rankFor };
})();
