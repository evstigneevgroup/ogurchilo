/* game.js — ядро игры: огурец, чистящая рука, частицы, очки, звук.
   Рендер процедурный (без внешних ассетов), аудитория площадок — мобилы. */
(function () {
  'use strict';

  var ROUND_TIME = 30; /* секунд на раунд */

  var canvas = null;
  var ctx = null;
  var last = 0;
  var rafLast = 0; /* метка последнего тика (rAF или watchdog) */
  var hooks = { hud: null, roundEnd: null };

  var S = {
    mode: 'idle',          /* idle | play | paused */
    tLeft: ROUND_TIME,
    score: 0,
    cukes: 0,              /* огурцов за раунд */
    peel: 0,               /* прогресс шкурки 0..1 */
    seed: 0,               /* номер огурца — затравка для узора */
    golden: false,         /* золотой огурец (каждый 5-й): ×2 очки */
    spawn: 0,              /* 1 -> 0: анимация появления огурца */
    maxCombo: 0,           /* максимальное комбо за раунд */
    goldenCount: 0,        /* золотых очищено за раунд */
    combo: 0,
    comboLeft: 0,          /* остаток окна комбо (для полосы) */
    lastTapAt: 0,
    lastSec: -1,           /* для тиков последних секунд */
    recordShown: false,    /* «рекорд побит» уже поздравил */
    squash: 0,
    shake: 0,
    flash: 0,
    handBurst: 0,          /* 1 -> 0: рывок руки на тапе */
    particles: [],
    floaters: []
  };

  var CRUNCH_WORDS = ['хрусть!', 'щёлк!', 'вжух!', 'чище!', 'ещё!', 'хрум!'];

  var W = 0, H = 0, DPR = 1;
  var geo = { cx: 0, top: 0, h: 0, w: 0 };

  /* ---------- утилиты ---------- */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function TAU() { return Math.PI * 2; }

  /* ---------- звук: синтез без ассетов ---------- */
  var Sfx = (function () {
    var actx = null, noiseBuf = null, on = true;

    function ensure() {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!actx) { try { actx = new AC(); } catch (e) { actx = null; } }
      if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
      return actx;
    }
    function noise() {
      if (noiseBuf) return noiseBuf;
      var len = Math.floor(actx.sampleRate * 0.09);
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return noiseBuf;
    }
    /* хруст шкурки: короткий шум + падающий тон */
    function crunch(power) {
      if (!on) return;
      var a = ensure(); if (!a) return;
      var t = a.currentTime;
      var src = a.createBufferSource();
      src.buffer = noise();
      var bp = a.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1400 + power * 320; bp.Q.value = 0.9;
      var g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      src.connect(bp); bp.connect(g); g.connect(a.destination);
      src.start(t); src.stop(t + 0.12);
      var o = a.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(170 + power * 40, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      var g2 = a.createGain();
      g2.gain.setValueAtTime(0.22, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g2); g2.connect(a.destination);
      o.start(t); o.stop(t + 0.12);
    }
    /* почищенный огурец: три ноты */
    function fanfare() {
      if (!on) return;
      var a = ensure(); if (!a) return;
      var t = a.currentTime;
      var notes = [523.25, 659.25, 783.99];
      for (var i = 0; i < notes.length; i++) {
        (function (f, idx) {
          var o = a.createOscillator();
          o.type = 'square'; o.frequency.value = f;
          var g = a.createGain();
          var st = t + idx * 0.09;
          g.gain.setValueAtTime(0.0001, st);
          g.gain.exponentialRampToValueAtTime(0.16, st + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.14);
          o.connect(g); g.connect(a.destination);
          o.start(st); o.stop(st + 0.15);
        })(notes[i], i);
      }
    }
    /* тик последних секунд */
    function tick() {
      if (!on) return;
      var a = ensure(); if (!a) return;
      var t = a.currentTime;
      var o = a.createOscillator();
      o.type = 'sine'; o.frequency.value = 1150;
      var g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.08);
    }
    /* блип на пороге комбо */
    function comboUp() {
      if (!on) return;
      var a = ensure(); if (!a) return;
      var t = a.currentTime;
      var o = a.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(990, t + 0.09);
      var g = a.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.13);
    }
    /* гудок конца раунда */
    function buzz() {
      if (!on) return;
      var a = ensure(); if (!a) return;
      var t = a.currentTime;
      var o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.4);
      var g = a.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + 0.46);
    }
    return {
      crunch: crunch, fanfare: fanfare, tick: tick, comboUp: comboUp, buzz: buzz, ensure: ensure,
      setOn: function (v) { on = v; }
    };
  })();

  /* ---------- геометрия ---------- */
  function layout() {
    if (!canvas || !ctx) return;
    /* экран игры может быть скрыт (display:none): тогда размеров нет — ждём показ.
       Но если размеры всё же нулевые (особенности вебвью) — берём окно целиком,
       чтобы геометрия никогда не оставалась нулевой. */
    var cw = canvas.clientWidth || window.innerWidth || 320;
    var ch = canvas.clientHeight || window.innerHeight || 480;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cw; H = ch;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    geo.w = clamp(W * 0.24, 96, 150);
    geo.top = Math.max(88, H * 0.14);
    geo.h = clamp(H - geo.top - 90, H * 0.4, H * 0.72);
    geo.cx = W / 2;
  }

  /* граница чистки: сверху вниз */
  function frontierY() { return geo.top + S.peel * (geo.h * 0.9); }
  function handH() { return geo.w * 1.12; }

  /* позиция руки: у границы чистки, качается вверх-вниз */
  function handY(t) {
    var hh = handH();
    var min = geo.top + hh * 0.32;
    var max = geo.top + geo.h - hh * 0.25;
    var y = clamp(frontierY(), min, max);
    var off;
    if (S.handBurst > 0) {
      var p = 1 - S.handBurst; /* 0..1 прогресс рывка */
      off = -Math.abs(Math.sin(p * Math.PI * 2)) * geo.h * 0.075; /* два маха вверх */
    } else {
      off = Math.sin(t * 2.1) * 7;
    }
    return clamp(y + off, min, max);
  }

  /* ---------- ввод и механика ---------- */
  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (S.mode !== 'play') return;
      Sfx.ensure();
      tap();
    });
  }

  function tap() {
    var now = performance.now();
    if (now - S.lastTapAt < 700) S.combo = Math.min(S.combo + 1, 12); else S.combo = 0;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;
    if (S.combo === 4 || S.combo === 8 || S.combo === 12) Sfx.comboUp();
    S.lastTapAt = now;
    S.comboLeft = 0.7;

    var mult = (1 + S.combo * 0.2) * (S.golden ? 2 : 1);
    var pts = Math.round(12 * mult);
    S.score += pts;

    /* огурцы в раунде прокачиваются медленнее — лёгкий рост сложности */
    var step = Math.max(0.038, 0.055 * Math.pow(0.96, S.cukes));
    S.peel += step;

    S.squash = 1;
    S.shake = Math.min(S.shake + 2, 5);
    S.handBurst = 1;

    var fy = frontierY();
    spawnCrunch(fy);
    addFloater('+' + pts, geo.cx + rnd(-24, 24), fy - 34, S.golden ? '#ffe08a' : '#ffffff', 21);
    if (S.combo >= 3) addFloater('КОМБО ×' + S.combo, geo.cx, fy - 80, '#f4b942', 24);
    else if (Math.random() < 0.25) {
      var word = CRUNCH_WORDS[Math.floor(Math.random() * CRUNCH_WORDS.length)];
      addFloater(word, geo.cx + rnd(-30, 30), fy - 78, '#d7f0b2', 19);
    }

    /* одноразовое поздравление с личным рекордом посреди раунда */
    var best = (window.Store && Store.state && Store.state.best) || 0;
    if (best > 0 && S.score > best && !S.recordShown) {
      S.recordShown = true;
      addFloater('🏆 Рекорд побит!', geo.cx, geo.top + geo.h * 0.25, '#f4b942', 24);
      Sfx.fanfare();
    }

    Sfx.crunch(Math.min(S.combo, 6));
    if (window.Platform && Platform.haptic) Platform.haptic('light');

    if (S.peel >= 1) completeCucumber();
  }

  function completeCucumber() {
    var bonus = S.golden ? 120 : 60;
    S.cukes++;
    S.peel = 0;
    S.seed++;
    S.score += bonus;
    S.flash = 1;
    addFloater(S.golden ? 'ЗОЛОТОЙ! +' + bonus : 'ЧИСТО! +' + bonus, geo.cx, geo.top + geo.h * 0.42, S.golden ? '#ffe08a' : '#8ed46f', 26);
    burstConfetti(geo.cx, geo.top + geo.h * 0.3);
    Sfx.fanfare();
    if (window.Platform && Platform.haptic) Platform.haptic('success');

    /* новый огурец: спавн-анимация; каждый 5-й — золотой */
    S.spawn = 1;
    S.golden = (S.cukes % 5 === 0);
    if (S.golden) { S.goldenCount++; addFloater('✨ ЗОЛОТОЙ ОГУРЕЦ! ×2', geo.cx, geo.top + geo.h * 0.2, '#ffe08a', 22); }
  }

  /* ---------- частицы и надписи ---------- */
  function spawnCrunch(fy) {
    var i;
    for (i = 0; i < 9; i++) {
      S.particles.push({
        kind: 'flake',
        x: geo.cx + rnd(-geo.w * 0.55, geo.w * 0.55),
        y: fy + rnd(-8, 14),
        vx: rnd(-140, 140), vy: rnd(-210, -50),
        g: 700, rot: rnd(0, TAU()), vr: rnd(-12, 12),
        s: rnd(5, 11), life: rnd(0.55, 0.9), t: 0,
        col: Math.random() < 0.5 ? '#6faf3d' : '#4c8f2a'
      });
    }
    for (i = 0; i < 3; i++) {
      S.particles.push({
        kind: 'drop',
        x: geo.cx + rnd(-geo.w * 0.4, geo.w * 0.4), y: fy,
        vx: rnd(-40, 40), vy: rnd(-120, -30),
        g: 500, s: rnd(2.5, 4.5), life: 0.6, t: 0,
        col: '#dff39b'
      });
    }
  }

  function burstConfetti(x, y) {
    var cols = ['#f4b942', '#e2543f', '#8ed46f', '#59b93c', '#fffdf5'];
    for (var i = 0; i < 18; i++) {
      S.particles.push({
        kind: 'conf',
        x: x + rnd(-40, 40), y: y + rnd(-20, 20),
        vx: rnd(-260, 260), vy: rnd(-340, -80),
        g: 760, rot: rnd(0, TAU()), vr: rnd(-16, 16),
        s: rnd(6, 12), life: rnd(0.7, 1.1), t: 0,
        col: cols[i % cols.length]
      });
    }
  }

  function addFloater(text, x, y, col, size) {
    S.floaters.push({ text: text, x: x, y: y, col: col, size: size, t: 0, life: 0.85 });
  }

  /* ---------- цикл ---------- */
  function update(dt) {
    var t = performance.now() / 1000;

    S.squash = Math.max(0, S.squash - dt * 6);
    S.shake = Math.max(0, S.shake - dt * 24);
    S.flash = Math.max(0, S.flash - dt * 2);
    if (S.handBurst > 0) S.handBurst = Math.max(0, S.handBurst - dt * 3.4);
    if (S.comboLeft > 0) S.comboLeft = Math.max(0, S.comboLeft - dt);
    if (S.spawn > 0) S.spawn = Math.max(0, S.spawn - dt * 2.4);

    if (S.mode === 'play') {
      S.tLeft -= dt;
      var sec = Math.ceil(Math.max(0, S.tLeft));
      if (sec !== S.lastSec) {
        S.lastSec = sec;
        if (sec <= 5 && sec > 0) Sfx.tick();
      }
      if (S.tLeft <= 0) endRound();
    }

    var i;
    for (i = S.particles.length - 1; i >= 0; i--) {
      var p = S.particles[i];
      p.t += dt;
      if (p.t >= p.life) { S.particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
    }
    for (i = S.floaters.length - 1; i >= 0; i--) {
      var f = S.floaters[i];
      f.t += dt;
      f.y -= 46 * dt;
      if (f.t >= f.life) S.floaters.splice(i, 1);
    }
  }

  function endRound() {
    S.tLeft = 0;
    S.mode = 'idle';
    Sfx.buzz();
    if (hooks.roundEnd) hooks.roundEnd({
      score: S.score,
      cukes: S.cukes,
      maxCombo: S.maxCombo,
      golden: S.goldenCount
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackdrop();
    ctx.save();
    if (S.shake > 0) ctx.translate(rnd(-S.shake, S.shake) * 0.5, rnd(-S.shake, S.shake) * 0.5);
    drawShadow();
    drawCucumber();
    drawHand();
    drawParticles();
    drawFloaters();
    ctx.restore();
    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (S.flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* живой фон: мягкие плавающие пятна за огурцом */
  function drawBackdrop() {
    if (!(W > 0) || !(H > 0)) return;
    var t = performance.now() / 1000;
    var blobs = [
      { x: 0.18, y: 0.22, r: 0.34, dx: 0.05, dy: 0.04, col: 'rgba(142,212,111,0.13)' },
      { x: 0.85, y: 0.30, r: 0.28, dx: -0.04, dy: 0.06, col: 'rgba(244,185,66,0.10)' },
      { x: 0.30, y: 0.85, r: 0.38, dx: 0.06, dy: -0.05, col: 'rgba(89,185,60,0.09)' },
      { x: 0.75, y: 0.80, r: 0.25, dx: -0.05, dy: -0.04, col: 'rgba(142,212,111,0.10)' }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var bx = (b.x + Math.sin(t * 0.13 + i * 1.7) * b.dx) * W;
      var by = (b.y + Math.cos(t * 0.11 + i * 2.1) * b.dy) * H;
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.arc(bx, by, b.r * Math.min(W, H), 0, TAU());
      ctx.fill();
    }
  }

  function drawShadow() {
    ctx.save();
    ctx.fillStyle = 'rgba(29,58,18,0.16)';
    ctx.beginPath();
    ctx.ellipse(geo.cx, geo.top + geo.h + 14, geo.w * 0.62, geo.w * 0.13, 0, 0, TAU());
    ctx.fill();
    ctx.restore();
  }

  /* огурец: капсула, кожа с узором, чистая часть сверху, граница чистки */
  function drawCucumber() {
    var x0 = geo.cx - geo.w / 2, y0 = geo.top, w = geo.w, h = geo.h;
    var t = performance.now() / 1000;

    /* страховка от нулевой геометрии: любой цикл с шагом 0 зависает намертво */
    if (!(w > 0) || !(h > 0)) return;

    ctx.save();
    /* появление нового огурца (спавн-анимация) + squash при тапе */
    var sq = S.squash;
    var sp = S.spawn;
    var grow = 1 - 0.35 * sp * sp;          /* из 0.65 в 1 с замедлением */
    var rise = sp * 46;                     /* спуск сверху */
    ctx.translate(geo.cx, y0 + h / 2);
    ctx.scale((1 + sq * 0.05) * grow, (1 - sq * 0.055) * grow);
    ctx.translate(-geo.cx, -(y0 + h / 2) - rise);

    rr(x0, y0, w, h, w / 2);
    ctx.save();
    ctx.clip();

    /* кожа: цилиндр (золотой огурец — золотая палитра) */
    var g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    if (S.golden) {
      g.addColorStop(0, '#8a5f14'); g.addColorStop(0.3, '#d9a825');
      g.addColorStop(0.5, '#f7cf5c'); g.addColorStop(0.7, '#d9a825');
      g.addColorStop(1, '#7a5410');
    } else {
      g.addColorStop(0, '#2e6b1c'); g.addColorStop(0.3, '#57a833');
      g.addColorStop(0.5, '#6fc23f'); g.addColorStop(0.7, '#57a833');
      g.addColorStop(1, '#245716');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);

    /* золотой: мерцающие искры */
    if (S.golden) {
      var sg = mulberry(7 + S.seed * 17);
      for (var spark = 0; spark < 7; spark++) {
        var sxp = x0 + sg() * w, syp = y0 + sg() * h;
        var tw = 0.5 + 0.5 * Math.sin(t * 5 + spark * 2.3);
        ctx.fillStyle = 'rgba(255,244,200,' + (0.25 + 0.55 * tw).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(sxp, syp, w * 0.035 * (0.6 + tw), 0, TAU());
        ctx.fill();
      }
    }

    /* волнистые полосы шкурки */
    ctx.strokeStyle = 'rgba(20,48,8,0.35)';
    ctx.lineWidth = w * 0.075;
    ctx.lineCap = 'round';
    var si, yy, k, sx;
    for (si = 0; si < 4; si++) {
      sx = x0 + w * (0.18 + si * 0.22);
      ctx.beginPath();
      ctx.moveTo(sx, y0 + h * 0.04);
      k = 0;
      for (yy = y0 + h * 0.04; yy <= y0 + h * 0.96; yy += h * 0.12, k++) {
        ctx.quadraticCurveTo(sx + w * 0.05, yy + h * 0.06, sx + (k % 2 ? w * 0.02 : -w * 0.02), yy + h * 0.12);
      }
      ctx.stroke();
    }

    /* блики */
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rr(x0 + w * 0.16, y0 + h * 0.08, w * 0.14, h * 0.84, w * 0.07);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(x0 + w * 0.36, y0 + h * 0.1, w * 0.05, h * 0.8, w * 0.025);
    ctx.fill();

    /* пупырышки — свои для каждого огурца */
    var rng = mulberry(900 + S.seed * 131);
    var bi;
    for (bi = 0; bi < 26; bi++) {
      var bx = x0 + w * 0.06 + rng() * w * 0.88;
      var by = y0 + h * 0.05 + rng() * h * 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath(); ctx.arc(bx, by, w * 0.032, 0, TAU()); ctx.fill();
      ctx.fillStyle = 'rgba(10,30,4,0.22)';
      ctx.beginPath(); ctx.arc(bx + 1.2, by + 1.4, w * 0.022, 0, TAU()); ctx.fill();
    }

    /* чистая часть */
    var fy = frontierY();
    if (S.peel > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - 4, y0 - 6, w + 8, fy - y0 + 6);
      ctx.clip();
      var pg = ctx.createLinearGradient(0, y0, 0, fy);
      pg.addColorStop(0, '#e6f6c3'); pg.addColorStop(1, '#bfe18a');
      ctx.fillStyle = pg;
      ctx.fillRect(x0, y0, w, fy - y0 + 4);
      /* волокна мякоти */
      ctx.strokeStyle = 'rgba(140,170,100,0.5)';
      ctx.lineWidth = 2;
      var fi;
      var spans = Math.max(1, fy - y0);
      for (fi = 0; fi < 3; fi++) {
        var fx0 = x0 + w * (0.25 + fi * 0.25);
        ctx.beginPath();
        ctx.moveTo(fx0, y0 + 4);
        ctx.bezierCurveTo(fx0 - 4, y0 + spans * 0.33, fx0 + 4, y0 + spans * 0.66, fx0, fy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      rr(x0 + w * 0.18, y0 + 6, w * 0.12, Math.max(14, spans - 12), w * 0.06);
      ctx.fill();
      ctx.restore();
    }

    /* граница чистки: рваный край + висящие обрывки шкурки */
    if (S.peel > 0 && S.peel < 1) {
      ctx.strokeStyle = 'rgba(36,87,22,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      var n = 9, amp = w * 0.09, i2;
      ctx.moveTo(x0, fy);
      for (i2 = 1; i2 <= n; i2++) {
        ctx.lineTo(x0 + (w / n) * i2, fy + ((i2 % 2) ? -amp : 0) + amp * 0.5);
      }
      ctx.stroke();
      var rng2 = mulberry(50 + S.seed * 31);
      var f2;
      for (f2 = 0; f2 < 3; f2++) {
        var hx = x0 + w * (0.2 + rng2() * 0.6);
        ctx.save();
        ctx.translate(hx, fy + 2);
        ctx.rotate(Math.sin(t * 2 + f2 * 2) * 0.25);
        ctx.fillStyle = 'rgba(79,143,45,0.9)';
        ctx.fillRect(-3, 0, 6, 10 + rng2() * 8);
        ctx.restore();
      }
    }

    ctx.restore(); /* unclip капсулы */

    /* обводка огурца */
    rr(x0, y0, w, h, w / 2);
    ctx.strokeStyle = 'rgba(18,44,8,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    /* хвостик и листик сверху */
    ctx.fillStyle = '#3c5f2a';
    rr(geo.cx - w * 0.09, y0 - 12, w * 0.18, 20, 6);
    ctx.fill();
    ctx.save();
    ctx.translate(geo.cx + w * 0.1, y0 - 8);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#6fbb4a';
    ctx.beginPath(); ctx.ellipse(9, 0, 12, 5, 0, 0, TAU()); ctx.fill();
    ctx.restore();

    ctx.restore(); /* squash */
  }

  /* рука: кулак, обхвативший огурец, из «лент»-пальцев */
  function drawHand() {
    var y = handY();
    var hh = handH();
    var w = geo.w * 1.28;
    var x0 = geo.cx - w / 2;
    var fh = hh / 4;
    var y0 = y - hh / 2;
    var t = performance.now() / 1000;
    var i;

    ctx.save();

    /* запястье (сзади, правее) */
    ctx.fillStyle = '#e8a877';
    rr(x0 + w * 0.42, y + hh * 0.34, w * 0.62, hh * 0.5, fh * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,33,15,0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    /* пальцы-ленты снизу вверх */
    for (i = 0; i < 4; i++) {
      var fy0 = y0 + i * fh * 0.92;
      var short = i === 3;
      ctx.fillStyle = i % 2 ? '#f3bd94' : '#eab183';
      rr(x0 + (short ? w * 0.05 : 0), fy0, w - (short ? w * 0.1 : 0), fh * 1.05, fh / 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,33,15,0.65)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rr(x0 + w * 0.06, fy0 + fh * 0.18, w * 0.14, fh * 0.4, fh * 0.2);
      ctx.fill();
    }

    /* большой палец сверху */
    ctx.fillStyle = '#f3bd94';
    rr(x0 - fh * 0.14, y0 - fh * 0.28, w * 0.3, fh * 1.5, fh * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,33,15,0.65)';
    ctx.stroke();

    /* линии движения во время рывка */
    if (S.handBurst > 0.15) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2.5;
      var j;
      for (j = 0; j < 3; j++) {
        var ly = y0 + hh * (0.2 + j * 0.3);
        var m = 4;
        ctx.beginPath();
        ctx.moveTo(x0 + w + 8, ly);
        ctx.lineTo(x0 + w + 8 + m * 3, ly - m);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x0 - 8, ly);
        ctx.lineTo(x0 - 8 - m * 3, ly - m);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawParticles() {
    var i, p, a;
    for (i = 0; i < S.particles.length; i++) {
      p = S.particles[i];
      a = 1 - p.t / p.life;
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.col;
      if (p.kind === 'drop') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU()); ctx.fill();
      } else {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.kind === 'conf') {
          ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        } else {
          /* обрывок шкурки */
          ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
          ctx.fillStyle = 'rgba(20,48,8,0.5)';
          ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.2);
        }
      }
      ctx.restore();
    }
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = 'center';
    var i, f, a, scale;
    var font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
    for (i = 0; i < S.floaters.length; i++) {
      f = S.floaters[i];
      a = Math.max(0, 1 - f.t / f.life);
      scale = 1 + (1 - a) * 0.15;
      ctx.globalAlpha = a;
      ctx.font = '800 ' + Math.round(f.size * scale) + 'px ' + font;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(18,44,8,0.9)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function tick(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    rafLast = ts;
    update(dt);
    draw();
    if (hooks.hud) {
      hooks.hud({
        mode: S.mode,
        tLeft: Math.max(0, S.tLeft),
        score: S.score,
        cukes: S.cukes,
        combo: S.combo,
        comboLeft: S.comboLeft
      });
    }
  }

  function frame(ts) {
    tick(ts);
    requestAnimationFrame(frame);
  }

  /* Страховка: в перекрытых/скрытых окнах платформ-обёрток rAF может замереть,
     тогда раунд и таймер так и «зависнут». Пока раунд идёт и вкладка видима,
     догоняем тиками без rAF. В невидимой вкладке не рисуем — экономим батарею. */
  function watchdog() {
    if (S.mode !== 'play') return;
    if (document.visibilityState !== 'visible') return;
    if (performance.now() - rafLast > 250) tick(performance.now());
  }

  /* ---------- публичный API ---------- */
  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    layout();
    window.addEventListener('resize', layout);
    bindInput();
    setInterval(watchdog, 200);
    last = performance.now();
    rafLast = last;
    requestAnimationFrame(frame);
  }

  function start() {
    layout(); /* на момент запуска игровой экран уже показан */
    S.mode = 'play';
    S.tLeft = ROUND_TIME;
    S.score = 0; S.cukes = 0; S.peel = 0;
    S.combo = 0; S.comboLeft = 0;
    S.maxCombo = 0; S.goldenCount = 0;
    S.handBurst = 0; S.flash = 0;
    S.spawn = 1;               /* первый огурец выезжает */
    S.golden = false;
    S.lastSec = ROUND_TIME;
    S.recordShown = false;
  }

  function pause() { if (S.mode === 'play') S.mode = 'paused'; }
  function resume() { if (S.mode === 'paused') S.mode = 'play'; }

  function toIdle() {
    S.mode = 'idle';
    S.tLeft = ROUND_TIME;
    S.score = 0; S.cukes = 0; S.peel = 0;
    S.combo = 0; S.comboLeft = 0;
  }

  function setSound(v) {
    Sfx.setOn(v);
    if (v && Sfx.ensure) Sfx.ensure();
  }

  window.Game = {
    init: init,
    start: start,
    pause: pause,
    resume: resume,
    toIdle: toIdle,
    setSound: setSound,
    relayout: layout,
    onHud: function (fn) { hooks.hud = fn; },
    onRoundEnd: function (fn) { hooks.roundEnd = fn; },
    ROUND_TIME: ROUND_TIME
  };
})();
