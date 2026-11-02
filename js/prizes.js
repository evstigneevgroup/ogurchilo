/* prizes.js — ступени призов от партнёрской сети.
   Демо-конфиг: коды вымышленные. На проде список и выдача кодов — через бэкенд,
   поэтому структура данных повторяет будущий API (id, needCukes, code, state). */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var LIST = [
    { id: 'coffee', needCukes: 3,  title: 'Хрустящий старт',   desc: 'Кофе в подарок',              partner: 'БодриКофе', code: 'OGUR-CAF-2026' },
    { id: 'food',   needCukes: 10, title: 'Чистильщик',        desc: 'Промокод на 300 ₽',           partner: 'Едаля',     code: 'OGUR-EDAL-300' },
    { id: 'cinema', needCukes: 25, title: 'Шкуродёр',          desc: 'Два билета в кино',           partner: 'Кинобаза',  code: 'OGUR-CIN-2X1' },
    { id: 'merch',  needCukes: 50, title: 'Огуречная легенда', desc: 'Футболка «Я чищу огурцы»',    partner: 'Огурчило',  code: null }
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

  window.Prizes = { list: LIST, statuses: statuses, progress: progress, byId: byId };
})();
