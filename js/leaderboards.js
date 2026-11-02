/* leaderboards.js — рейтинги «друзей» и «случайных соперников».
   Демо-режим: генерируются локально. На проде заменяется API площадки
   (VK Bridge / Telegram initData + бэкенд / ODKL API), интерфейс тот же. */
(function () {
  'use strict';

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  var NAMES = [
    'Тимоха', 'Клава', 'Дед Гоша', 'Света Р.', 'Костя', 'Лёха Кочерыжка',
    'Марья Ивана', 'Нина П.', 'Фёдор', 'Оля', 'Петька', 'Зина',
    'Валера', 'Саня', 'Люся', 'Дядя Витя'
  ];
  var EMOJI = ['🥒', '🥷', '🐻', '🚀', '🐈', '🦊', '👽', '🧙', '🐸', '🦄', '🐹', '🎃'];

  function avatar(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    return EMOJI[Math.abs(h) % EMOJI.length];
  }

  /* подмешать игрока и отсортировать */
  function combine(myScore, list) {
    var rows = list.map(function (r) {
      return { name: r.name, score: r.score, emoji: avatar(r.name), you: false };
    });
    rows.push({ name: 'Ты', score: myScore, emoji: '😎', you: true });
    rows.sort(function (a, b) { return b.score - a.score; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    var you = rows.filter(function (r) { return r.you; })[0];
    return { rows: rows, rank: you ? you.rank : 1, total: rows.length };
  }

  /* seed меняется каждую минуту — соперники «живут» */
  function minuteSeed() {
    return Math.floor(Date.now() / 60000) % 1000000;
  }

  function buildFriends(myScore) {
    var rng = mulberry(minuteSeed() * 7 + 13 + myScore);
    var start = Math.floor(rng() * (NAMES.length - 5));
    var list = [];
    for (var i = 0; i < 5; i++) {
      var f = 0.35 + rng() * 0.95; /* 35%..130% от счёта игрока */
      list.push({ name: NAMES[(start + i) % NAMES.length], score: Math.round(myScore * f) + Math.floor(rng() * 30) });
    }
    /* «Дед Гоша» стабильно чуть сильнее — есть кого обгонять */
    list[0] = { name: 'Дед Гоша', score: Math.round(Math.max(myScore * (1.03 + rng() * 0.3), myScore + 40)) };
    return combine(Math.max(myScore, 0), list);
  }

  function buildOpponents(myScore) {
    var rng = mulberry(minuteSeed() * 3 + 7 + myScore * 5);
    var list = [];
    for (var i = 0; i < 8; i++) {
      var r = rng();
      var f = r < 0.62 ? 0.2 + r * 1.0 : 0.85 + r * 0.35; /* часть случайных — сильнее */
      list.push({
        name: NAMES[Math.floor(rng() * NAMES.length)],
        score: Math.round(myScore * f) + Math.floor(rng() * 40)
      });
    }
    return combine(Math.max(myScore, 0), list);
  }

  window.Leaderboards = { buildFriends: buildFriends, buildOpponents: buildOpponents };
})();
