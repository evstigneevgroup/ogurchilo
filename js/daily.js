/* daily.js — ежедневное задание и стрик дней.
   Задание детерминировано от даты: у всех в этот день — одно и то же. */
(function () {
  'use strict';

  var QUEST_POOL = [
    { type: 'cukes',  n: [4, 8],       text: 'Почисти {n} огурцов за раунд' },
    { type: 'score',  n: [1500, 3500], text: 'Набери {n} очков за раунд' },
    { type: 'combo',  n: [6, 10],      text: 'Дотяни комбо до ×{n}' },
    { type: 'golden', n: [1, 2],       text: 'Почисти {n} золотых огурцов за раунд' }
  ];

  function pad2(x) { return (x < 10 ? '0' : '') + x; }
  function dateToStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function todayStr() { return dateToStr(new Date()); }
  function yesterdayStr() { return dateToStr(new Date(Date.now() - 86400000)); }

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function questFor(dateStr) {
    var seed = 0;
    for (var i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) | 0;
    var rng = mulberry(seed);
    var q = QUEST_POOL[Math.floor(rng() * QUEST_POOL.length)];
    var n = q.n[0] + Math.floor(rng() * (q.n[1] - q.n[0] + 1));
    if (q.type === 'score') n = Math.round(n / 100) * 100;
    return { type: q.type, n: n, text: q.text.replace('{n}', n) };
  }

  function check(quest, res) {
    if (!quest) return false;
    if (quest.type === 'cukes') return res.cukes >= quest.n;
    if (quest.type === 'score') return res.score >= quest.n;
    if (quest.type === 'combo') return (res.maxCombo || 0) >= quest.n;
    if (quest.type === 'golden') return (res.golden || 0) >= quest.n;
    return false;
  }

  window.Daily = { todayStr: todayStr, yesterdayStr: yesterdayStr, questFor: questFor, check: check };
})();
