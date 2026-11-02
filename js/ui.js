/* ui.js — экраны, HUD, таблицы лидеров, призы, тосты */
(function () {
  'use strict';

  var el = {};

  function q(id) { return document.getElementById(id); }

  /* носитель ошибок на экран (main.js переопределяет) */
  var report = window.reportGameError || function (t) { if (window.console) console.error(t); };

  /* навешивание кликов: обработчик в try/catch — любая ошибка видна на экране,
     а угловой диагностический хвост (main.js) показывает подтверждённый клик */
  function wire(id, fn) {
    var node = document.getElementById(id);
    if (!node) { report('не найден элемент #' + id); return; }
    node.addEventListener('click', function (ev) {
      try {
        fn(ev);
        window.__clicks = (window.__clicks || 0) + 1;
        window.__diag('кнопка ✓ ' + id + ' · клик ' + window.__clicks);
      } catch (e) {
        report('клик по «' + id + '»: ' + ((e && e.message) || String(e)));
      }
    });
  }

  /* ---------- навигация ---------- */
  var current = 'start';

  function show(name) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('active', s.id === 'screen-' + name);
    });
    current = name;
    Game.pause();
    if (name === 'leaders') renderLeaders('friends');
    if (name === 'prizes') renderPrizes();
    if (name === 'start') renderStart();
  }

  /* ---------- HUD ---------- */
  var lastHud = { t: -1, s: -1, combo: -1 };

  function hudHook(h) {
    var t = Math.ceil(h.tLeft);
    if (t !== lastHud.t) { el.hudTimer.textContent = t; lastHud.t = t; }
    if (h.score !== lastHud.s) { el.hudScore.textContent = h.score; lastHud.s = h.score; }
    if (h.combo !== lastHud.combo) {
      if (h.combo >= 2) {
        el.comboBox.hidden = false;
        el.comboLabel.textContent = 'КОМБО ×' + h.combo;
      } else {
        el.comboBox.hidden = true;
      }
      lastHud.combo = h.combo;
    }
    el.comboFill.style.width = h.comboLeft > 0 ? ((h.comboLeft / 0.7) * 100).toFixed(0) + '%' : '0%';
  }

  /* ---------- тосты и модалка ---------- */
  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2400);
  }

  function modal(title, body) {
    el.modalTitle.textContent = title;
    el.modalBody.textContent = body;
    el.modal.classList.add('show');
  }

  /* ---------- таблицы лидеров ---------- */
  function rowHtml(r) {
    var medal = r.rank === 1 ? '🥇' : (r.rank === 2 ? '🥈' : (r.rank === 3 ? '🥉' : ''));
    return '<div class="lb-row' + (r.you ? ' you' : '') + '">' +
      '<div class="lb-rank">' + (medal || r.rank) + '</div>' +
      '<div class="lb-ava">' + r.emoji + '</div>' +
      '<div class="lb-name">' + r.name + '</div>' +
      '<div class="lb-score">' + r.score + '</div></div>';
  }

  function renderLeaders(tab) {
    var base = Math.max(Store.state.lastScore, Math.round(Store.state.best * 0.6));
    var data = tab === 'friends' ? Leaderboards.buildFriends(base) : Leaderboards.buildOpponents(base);
    el.leadersList.innerHTML = data.rows.map(rowHtml).join('');
    el.tabFriends.classList.toggle('active', tab === 'friends');
    el.tabRandom.classList.toggle('active', tab === 'random');
    el.leadersNote.textContent = 'Демо: ' + (tab === 'friends' ? 'друзья' : 'соперники') +
      ' сгенерированы локально. На проде — рейтинг из API площадки.';
  }

  /* ---------- призы ---------- */
  function refreshBadge(count) {
    if (count === undefined) {
      count = Prizes.statuses(Store.state.totalCukes, Store.state.claimed)
        .filter(function (p) { return p.state === 'ready'; }).length;
    }
    el.badgePrizes.hidden = count === 0;
    el.badgePrizes.textContent = count;
  }

  function renderPrizes() {
    var store = Store.state;
    var st = Prizes.statuses(store.totalCukes, store.claimed);
    var pr = Prizes.progress(store.totalCukes);

    if (pr.next) {
      el.prizesProgress.innerHTML = 'Очищено огурцов: <b>' + store.totalCukes +
        '</b> · до «' + pr.next.title + '» — <b>' + (pr.next.needCukes - store.totalCukes) + '</b>';
      el.prizesBar.style.width = (pr.pct * 100).toFixed(0) + '%';
    } else {
      el.prizesProgress.innerHTML = 'Все призы разобраны! Дождись нового завоза 🥒';
      el.prizesBar.style.width = '100%';
    }

    el.prizesList.innerHTML = st.map(function (p) {
      var side;
      if (p.state === 'ready') {
        side = '<button class="btn btn-primary btn-small" data-claim="' + p.id + '">Забрать</button>';
      } else if (p.state === 'claimed') {
        side = '<span class="code" data-copy="' + p.code + '">' + p.code + '</span>';
      } else {
        side = '<span class="lock">🔒 ' + p.needCukes + ' огурцов</span>';
      }
      var icon = p.state === 'claimed' ? '✅' : (p.state === 'ready' ? '🎁' : '🔒');
      return '<div class="prize-card ' + p.state + '">' +
        '<div class="prize-emoji">' + icon + '</div>' +
        '<div class="prize-info">' +
        '<div class="prize-title">' + p.title + '</div>' +
        '<div class="prize-desc">' + p.desc + '</div>' +
        '<div class="prize-partner">' + (p.partner ? 'Партнёр: ' + p.partner : '') + '</div>' +
        '</div><div class="prize-side">' + side + '</div></div>';
    }).join('');
  }

  function copyCode(code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { toast('Скопировано: ' + code); }, fallbackCopy);
    } else {
      fallbackCopy();
      toast('Скопировано: ' + code);
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      toast('Скопировано: ' + code);
    }
  }

  function claimPrize(id) {
    var p = Prizes.byId(id);
    if (!p) return;
    Store.state.claimed[id] = true;
    Store.save();
    Platform.haptic('success');
    if (p.code) {
      copyCode(p.code);
      modal(p.title, 'Промокод «' + p.code + '» скопирован.\n\nДемо: код вымышленный. На проде — выдача от партнёрской сети.');
    } else {
      modal(p.title, 'Мерч оформляется в боте (демо-режим).');
    }
    renderPrizes();
    refreshBadge();
  }

  /* ---------- главное меню ---------- */
  function renderStart() {
    el.statBest.textContent = Store.state.best;
    el.statCukes.textContent = Store.state.totalCukes;
    refreshBadge();
    el.btnSound.textContent = Store.state.sound ? '🔊' : '🔇';
  }

  /* ---------- конец раунда ---------- */
  Game.onRoundEnd(function (res) {
    var store = Store.state;
    var isRecord = res.score > store.best;
    if (isRecord) store.best = res.score;
    store.lastScore = res.score;
    store.lastCukes = res.cukes;
    store.totalScore += res.score;
    store.totalCukes += res.cukes;
    store.rounds += 1;
    Store.save();

    var lb = Leaderboards.buildOpponents(res.score);

    var st = Prizes.statuses(store.totalCukes, store.claimed);
    var freshReady = st.filter(function (p) { return p.state === 'ready'; }).length;

    el.resScore.textContent = res.score;
    el.resCukes.textContent = res.cukes;
    el.resBest.textContent = isRecord ? '🏆 Новый рекорд!' : ('Рекорд: ' + store.best);
    el.resRank.textContent = lb.rank + '-е место из ' + lb.total + ' соперников';
    el.resMini.innerHTML = lb.rows.slice(0, 4).map(rowHtml).join('');

    el.overlayResult.classList.add('show');

    refreshBadge(freshReady);
    if (freshReady > 0) toast('🎁 Доступен новый приз — загляни в «Призы»!');
  });

  /* ---------- шаринг ---------- */
  function shareResult() {
    var s = Store.state;
    Platform.share('Я почистил ' + s.lastCukes + ' огурцов и набрал ' + s.lastScore +
      ' очков в «Огурчиле» 🥒 Побьёшь?');
  }

  /* ---------- инициализация ---------- */
  function init() {
    el = {
      hudScore: q('hud-score'),
      hudTimer: q('hud-timer'),
      comboBox: q('combo-box'),
      comboLabel: q('combo-label'),
      comboFill: q('combo-fill'),
      statBest: q('stat-best'),
      statCukes: q('stat-cukes'),
      badgePrizes: q('badge-prizes'),
      btnSound: q('btn-sound'),
      leadersList: q('leaders-list'),
      leadersNote: q('leaders-note'),
      tabFriends: q('tab-friends'),
      tabRandom: q('tab-random'),
      prizesList: q('prizes-list'),
      prizesProgress: q('prizes-progress'),
      prizesBar: q('prizes-bar'),
      overlayResult: q('overlay-result'),
      resScore: q('res-score'),
      resCukes: q('res-cukes'),
      resBest: q('res-best'),
      resRank: q('res-rank'),
      resMini: q('res-mini'),
      modal: q('modal'),
      modalTitle: q('modal-title'),
      modalBody: q('modal-body'),
      toast: q('toast')
    };

    /* кнопки: через wire — ошибка клика всплывает на экран, не в недоступную консоль */
    wire('btn-play', function () { show('game'); Game.start(); });
    wire('btn-leaders', function () { show('leaders'); });
    wire('btn-prizes', function () { show('prizes'); });
    wire('btn-sound', function () {
      Store.state.sound = !Store.state.sound;
      Store.save();
      Game.setSound(Store.state.sound);
      el.btnSound.textContent = Store.state.sound ? '🔊' : '🔇';
      Platform.haptic('light');
    });
    wire('btn-back-leaders', function () { show('start'); });
    wire('btn-back-prizes', function () { show('start'); });
    wire('tab-friends', function () { renderLeaders('friends'); });
    wire('tab-random', function () { renderLeaders('random'); });

    wire('btn-pause', function () {
      Game.pause();
      q('overlay-pause').classList.add('show');
    });
    wire('btn-resume', function () {
      q('overlay-pause').classList.remove('show');
      Game.resume();
    });
    wire('btn-quit', function () {
      q('overlay-pause').classList.remove('show');
      Game.toIdle();
      show('start');
    });

    wire('btn-again', function () {
      el.overlayResult.classList.remove('show');
      Game.start();
    });
    wire('btn-share', shareResult);
    wire('btn-res-prizes', function () {
      el.overlayResult.classList.remove('show');
      show('prizes');
    });

    wire('modal-btn', function () { el.modal.classList.remove('show'); });

    wire('prizes-list', function (e) {
      var claim = e.target.closest ? e.target.closest('[data-claim]') : null;
      if (claim) { claimPrize(claim.getAttribute('data-claim')); return; }
      var copy = e.target.closest ? e.target.closest('[data-copy]') : null;
      if (copy) copyCode(copy.getAttribute('data-copy'));
    });

    /* хуки игры */
    Game.onHud(hudHook);
    Game.init();
    Game.setSound(Store.state.sound);

    show('start');
  }

  window.UI = {
    init: init,
    show: show,
    toast: toast,
    get current() { return current; }
  };
})();
