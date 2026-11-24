      // 色は data-bg-color="r,g,b"。途中で書き換えると約1秒かけてなめらかに変わる
      var cur = null, BLUE;
/*!
 * N.DESIGN 背景アニメーション (bg-anim.js)
 * 使い方: 対象要素に data-bg-anim="dots|net|pixel|radar|dotcloud" を付ける
 *   任意: data-bg-amount="1"（濃さ 0.3〜2） data-bg-speed="1"（速さ 0.3〜2）
 * お試し切替: URLに ?bg=net&bgamt=0.8&bgspd=1.2 を付けると上書き
 */
(function () {
  'use strict';
  var INK = '0,22,56', BLUE = '77,159,232';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var NP = []; for (var n = 0; n < 512; n++) NP.push(Math.random());
  function hsh(i, j) { return NP[(((i * 73856093) ^ (j * 19349663)) >>> 0) % 512]; }
  function sm(v) { return v * v * (3 - 2 * v); }
  function vnoise(px, py) {
    var i = Math.floor(px), j = Math.floor(py), fx = sm(px - i), fy = sm(py - j);
    var a = hsh(i, j), b = hsh(i + 1, j), c = hsh(i, j + 1), d = hsh(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(px, py) { return vnoise(px, py) * .6 + vnoise(px * 2.1, py * 2.1) * .3 + vnoise(px * 4.3, py * 4.3) * .1; }

  var FX = {
    dots: function (st) {
      var g = 26;
      return function (t) {
        var x = st.x, w = st.w, h = st.h; x.clearRect(0, 0, w, h);
        var cx1 = w * (.3 + .15 * Math.sin(t * .00011)), cy1 = h * (.4 + .2 * Math.cos(t * .00013));
        var cx2 = w * (.75 + .1 * Math.cos(t * .00009)), cy2 = h * (.7 + .15 * Math.sin(t * .0001));
        for (var yy = g / 2; yy < h; yy += g) for (var xx = g / 2; xx < w; xx += g) {
          var d1 = Math.hypot(xx - cx1, yy - cy1), d2 = Math.hypot(xx - cx2, yy - cy2);
          var v = Math.max(0, Math.sin(d1 * .025 - t * .0015)) * .6 + Math.max(0, Math.sin(d2 * .03 - t * .0012)) * .4;
          x.fillStyle = 'rgba(' + INK + ',' + ((.05 + v * .16) * st.amt) + ')';
          x.beginPath(); x.arc(xx, yy, 1.1 + v * .9, 0, 7); x.fill();
        }
      };
    },
    net: function (st) {
      var BLUE = st.col || '77,159,232'; // data-bg-color="255,255,255" で色を変えられる
      var P = [];
      st.init = function () {
        var cnt = Math.round(st.w * st.h / 15000); P = [];
        for (var i = 0; i < cnt; i++) P.push({ x: rnd(0, st.w), y: rnd(0, st.h), vx: rnd(-.18, .18), vy: rnd(-.18, .18) });
      };
      return function (t, dt) {
        var x = st.x, w = st.w, h = st.h, k = dt / 16 * st.spd, R = 130, i, j, p;
        var tg = (st.el.getAttribute('data-bg-color') || '77,159,232').split(',').map(Number);
        if (!cur) cur = tg.slice(); else for (i = 0; i < 3; i++) cur[i] += (tg[i] - cur[i]) * Math.min(1, .05 * dt / 16);
        BLUE = Math.round(cur[0]) + ',' + Math.round(cur[1]) + ',' + Math.round(cur[2]);
        x.clearRect(0, 0, w, h);
        for (i = 0; i < P.length; i++) { p = P[i]; p.x += p.vx * k; p.y += p.vy * k; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
        x.lineWidth = 1;
        for (i = 0; i < P.length; i++) for (j = i + 1; j < P.length; j++) {
          var a = P[i], b = P[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < R) { x.strokeStyle = 'rgba(' + BLUE + ',' + ((1 - d / R) * .22 * st.amt) + ')'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
        }
        x.fillStyle = 'rgba(' + BLUE + ',' + (.35 * st.amt) + ')';
        for (i = 0; i < P.length; i++) { x.beginPath(); x.arc(P[i].x, P[i].y, 1.6, 0, 7); x.fill(); }
      };
    },
    // ドットの地球儀：フィボナッチ球面上の点を回転・投影し、手前ほど濃く大きく描く（右下に1つ。右端は画面外にはみ出す）
    dotglobe: function (st) {
      var pts = [];
      st.init = function () {
        var N = 900, ga = Math.PI * (3 - Math.sqrt(5)); pts = [];
        for (var i = 0; i < N; i++) {
          var y = 1 - 2 * (i + .5) / N, r = Math.sqrt(1 - y * y), th = ga * i;
          pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
        }
      };
      return function (t) {
        var x = st.x, w = st.w, h = st.h, sp = w < 768; x.clearRect(0, 0, w, h);
        var R = Math.min(w * (sp ? .5 : .3), h * .45), gx = w - R * .55, gy = h - R * 1.05;
        var ay = t * .00012, ax = .38, ca = Math.cos(ay), sa = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i], X = p[0] * ca + p[2] * sa, Z1 = -p[0] * sa + p[2] * ca;
          var Y = p[1] * cx - Z1 * sx, Z = p[1] * sx + Z1 * cx, d = (Z + 1) / 2;
          x.fillStyle = 'rgba(' + (d > .55 ? BLUE : INK) + ',' + ((.04 + d * d * .42) * st.amt) + ')';
          x.beginPath(); x.arc(gx + X * R, gy + Y * R, .6 + d * 1.9, 0, 7); x.fill();
        }
      };
    },
    pixel: function (st) {
      var C = [], p = 12;
      st.init = function () { C = []; };
      return function (t, dt) {
        var x = st.x, w = st.w, h = st.h, k = dt / 16 * st.spd; x.clearRect(0, 0, w, h);
        if (C.length < Math.round(w * h / 9000) && Math.random() < .5 * st.spd) {
          var bx = Math.floor(rnd(0, w / p)), by = Math.floor(rnd(0, h / p)), m = Math.random() < .5 ? Math.floor(rnd(2, 5)) : 1;
          for (var i = 0; i < m; i++) C.push({ x: (bx + Math.floor(rnd(-1, 2))) * p, y: (by + Math.floor(rnd(-1, 2))) * p, a: 0, dir: 1, v: rnd(.006, .018), b: Math.random() < .35, hold: rnd(20, 90) });
        }
        C = C.filter(function (c) {
          if (c.dir === 1) { c.a += c.v * k; if (c.a >= 1) { c.a = 1; c.dir = 0; } }
          else if (c.dir === 0) { c.hold -= k; if (c.hold <= 0) c.dir = -1; }
          else c.a -= c.v * k;
          x.fillStyle = 'rgba(' + (c.b ? BLUE : INK) + ',' + (Math.max(0, c.a) * (c.b ? .28 : .12) * st.amt) + ')';
          x.fillRect(c.x + 1, c.y + 1, p - 2, p - 2);
          return c.a > 0 || c.dir === 1;
        });
      };
    },
    radar: function (st) {
      var R = [];
      st.init = function () { R = []; };
      return function (t, dt) {
        var x = st.x, w = st.w, h = st.h; x.clearRect(0, 0, w, h);
        if (R.length < 6 * st.cnt && Math.random() < .012 * st.spd * st.cnt) R.push({ x: rnd(0, w), y: rnd(0, h), r: 0, m: rnd(160, 320) });
        R = R.filter(function (o) {
          o.r += .45 * dt / 16 * st.spd;
          for (var k = 0; k < 3; k++) {
            var rr = o.r - k * 26; if (rr <= 0) continue; var a = 1 - rr / o.m; if (a <= 0) continue;
            x.strokeStyle = 'rgba(' + (k ? INK : BLUE) + ',' + (a * (k ? .12 : .3) * st.amt) + ')'; x.lineWidth = 1;
            x.beginPath(); x.arc(o.x, o.y, rr, 0, 7); x.stroke();
          }
          x.fillStyle = 'rgba(' + BLUE + ',' + (Math.max(0, 1 - o.r / 80) * .4 * st.amt) + ')';
          x.beginPath(); x.arc(o.x, o.y, 2.5, 0, 7); x.fill();
          return o.r - 52 < o.m;
        });
      };
    },
    dotcloud: function (st) {
      var g = 14;
      st.fps = 30;
      return function (t) {
        var x = st.x, w = st.w, h = st.h, ox = t * .012; x.clearRect(0, 0, w, h);
        for (var yy = g / 2; yy < h; yy += g) for (var xx = g / 2; xx < w; xx += g) {
          var v = fbm((xx - ox) * .006, yy * .009 + t * .00002); v = Math.max(0, (v - .48) / .52); if (v <= .02) continue;
          x.fillStyle = 'rgba(' + BLUE + ',' + ((.08 + v * .35) * st.amt) + ')';
          x.beginPath(); x.arc(xx, yy, .6 + v * 3.6, 0, 7); x.fill();
        }
      };
    }
  };

  function clampNum(v, d) { v = parseFloat(v); return isFinite(v) ? Math.min(2, Math.max(.3, v)) : d; }

  function setup(el) {
    var qs = new URLSearchParams(location.search);
    var type = qs.get('bg') || el.getAttribute('data-bg-anim');
    if (!FX[type]) return;
    var st = {
      amt: clampNum(qs.get('bgamt') || el.getAttribute('data-bg-amount'), 1),
      spd: clampNum(qs.get('bgspd') || el.getAttribute('data-bg-speed'), 1),
      el: el,
      cnt: Math.min(30, Math.max(.3, parseFloat(qs.get('bgcnt') || el.getAttribute('data-bg-count')) || 1)) // 数の倍率（radar用）
    };
    var cv = document.createElement('canvas');
    cv.className = 'bg-anim-canvas'; cv.setAttribute('aria-hidden', 'true');
    var ref = el.firstElementChild;
    while (ref && ref.hasAttribute('data-bg-under')) ref = ref.nextElementSibling;
    el.insertBefore(cv, ref);
    st.x = cv.getContext('2d');
    var trig = el.getAttribute('data-bg-trigger'), trigEl = trig && document.querySelector(trig), active = !trigEl;
    if (!trigEl) cv.classList.add('is-on');
    var draw = FX[type](st), visible = false, last = 0, acc = 0, raf = 0;

    function fit() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      if (!r.width || !r.height) return;
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
      st.x.setTransform(d, 0, 0, d, 0, 0); st.w = r.width; st.h = r.height;
      if (st.init) st.init();
      if (reduce) draw(0, 16);
    }
    function loop(now) {
      raf = 0;
      if (!visible || !active || document.hidden) return;
      var dt = Math.min(50, now - (last || now)); last = now;
      if (st.fps) { acc += dt; if (acc < 1000 / st.fps) { raf = requestAnimationFrame(loop); return; } dt = acc; acc = 0; }
      draw(now * st.spd, dt);
      raf = requestAnimationFrame(loop);
    }
    function start() { if (!reduce && visible && active && !raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } }

    // data-bg-cut-from / -to: 2つの要素の間の余白の中央でグラデーションで消す（上端もフェード）
    var cf = el.getAttribute('data-bg-cut-from'), ct = el.getAttribute('data-bg-cut-to');
    var cfEl = cf && document.querySelector(cf), ctEl = ct && document.querySelector(ct), cut = null;
    var ft = parseFloat(el.getAttribute('data-bg-fade-top'));
    if (!(cfEl && ctEl) && ft > 0) {
      // data-bg-fade-top="260": 上端から指定pxでじわっと出す（パララックスで動いても位置を合わせる）
      cut = function () {
        var top = el.getBoundingClientRect().top - cv.getBoundingClientRect().top;
        var g = 'linear-gradient(to bottom, transparent ' + top + 'px, #000 ' + (top + ft) + 'px)';
        cv.style.webkitMaskImage = g; cv.style.maskImage = g;
      };
      window.addEventListener('resize', cut); new ResizeObserver(cut).observe(el); cut();
    }
    if (cfEl && ctEl) {
      cut = function () {
        var c = cv.getBoundingClientRect(), z = el.getBoundingClientRect();
        var mid = (cfEl.getBoundingClientRect().bottom + ctEl.getBoundingClientRect().top) / 2 - c.top;
        var top = z.top - c.top, F = Math.min(260, Math.max(80, mid * .25));
        var g = 'linear-gradient(to bottom, transparent ' + top + 'px, #000 ' + (top + 260) + 'px, #000 ' + (mid - F) + 'px, transparent ' + mid + 'px)';
        cv.style.webkitMaskImage = g; cv.style.maskImage = g;
      };
      window.addEventListener('resize', cut); new ResizeObserver(cut).observe(el); cut();
    }
    // パララックス: data-bg-parallax がある時、スクロールに合わせてキャンバスを上下にずらす（±20vh）
    if (el.hasAttribute('data-bg-parallax') && !reduce) {
      var pf = parseFloat(el.getAttribute('data-bg-parallax')) || 1; // 強さ（1で±20vh、2で±40vh。CSSのはみ出し量もそろえる）
      var px = function () {
        var r = el.getBoundingClientRect(), vh = window.innerHeight;
        var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        cv.style.transform = 'translate3d(0,' + ((0.5 - p) * 0.4 * pf * vh).toFixed(1) + 'px,0)';
        if (cut) cut();
      };
      window.addEventListener('scroll', px, { passive: true }); window.addEventListener('resize', px); px();
    }
    // data-bg-trigger: 指定要素が画面中央より上に来たら表示・再生（戻ると消える）
    if (trigEl) {
      var chk = function () {
        var r = trigEl.getBoundingClientRect(), on = r.top + r.height / 2 <= window.innerHeight / 2;
        if (on === active) return; active = on; cv.classList.toggle('is-on', on);
        if (on) { if (st.init) st.init(); start(); }
      };
      window.addEventListener('scroll', chk, { passive: true }); window.addEventListener('resize', chk); chk();
    }
    new ResizeObserver(fit).observe(cv);
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; start(); }).observe(el);
    document.addEventListener('visibilitychange', start);
  }

  function init() { var els = document.querySelectorAll('[data-bg-anim]'); for (var i = 0; i < els.length; i++) setup(els[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
