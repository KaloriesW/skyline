// The skyline under the Home hero: layered mountains and towers that fade into haze as PM2.5 rises
// (Koschmieder visibility), with each city's landmark drawn from its real proportions.
// window.Horizon.mount(el, { city, pm, lit, day, reduce }) draws into el; colours come from the sky CSS variables.
(function () {
  'use strict';
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }); }
  function hex(a) { return '#' + a.map(function (v) { return clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'); }).join(''); }
  function mix(a, b, k) { var A = rgb(a), B = rgb(b); return hex(A.map(function (v, i) { return v + (B[i] - v) * k; })); }
  function rgba(h, a) { var c = rgb(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function surface(W, H, dpr) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr)); var g = c.getContext('2d'); g.scale(dpr, dpr); return { c: c, g: g }; }
  // CSS colours in the sky variables are hex; fall back if a value is missing
  function cssHex(name, fallback) { var v = getComputedStyle(document.body).getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback; }

  function ridge(seed, base, amp) {
    var r = rng(seed), ph = [], fr = [], i;
    for (i = 0; i < 5; i++) { ph.push(r() * 6.283); fr.push((0.7 + r() * 0.8) * Math.pow(2.05, i)); }
    return function (x) {
      var y = 0, a = 1, s = 0, j;
      for (j = 0; j < 5; j++) { y += Math.sin(x / 1200 * fr[j] * 6.283 + ph[j]) * a; s += a; a *= 0.48; }
      return base - (y / s * 0.5 + 0.5) * amp;
    };
  }
  function fillRidge(g, f, W, H, col) { g.beginPath(); g.moveTo(0, H); for (var x = 0; x <= W + 4; x += 4) g.lineTo(x, f(x)); g.lineTo(W, H); g.closePath(); g.fillStyle = col; g.fill(); }

  function genBlds(seed, W, o) {
    var r = rng(seed), out = [], x = -30;
    while (x < W + 30) {
      var w = o.wMin + r() * (o.wMax - o.wMin), h = o.hMin + Math.pow(r(), 1.7) * (o.hMax - o.hMin), t = r();
      out.push({ x: x, w: w, h: h, type: t < 0.5 ? 'flat' : t < 0.72 ? 'set' : t < 0.86 ? 'spire' : t < 0.94 ? 'slant' : 'round' });
      x += w + r() * o.gap;
    }
    return out;
  }
  function bldPath(g, b, base) {
    var top = base - b.h, x = b.x, w = b.w;
    g.moveTo(x, base);
    if (b.type === 'set') { var sh = b.h * 0.16, sx = x + w * 0.18, sw = w * 0.64; g.lineTo(x, top + sh); g.lineTo(sx, top + sh); g.lineTo(sx, top); g.lineTo(sx + sw, top); g.lineTo(sx + sw, top + sh); g.lineTo(x + w, top + sh); }
    else if (b.type === 'spire') { var cx = x + w / 2; g.lineTo(x, top); g.lineTo(cx - 1, top); g.lineTo(cx - 0.6, top - b.h * 0.2); g.lineTo(cx + 0.6, top - b.h * 0.2); g.lineTo(cx + 1, top); g.lineTo(x + w, top); }
    else if (b.type === 'slant') { g.lineTo(x, top + w * 0.3); g.lineTo(x + w, top); }
    else if (b.type === 'round') { g.lineTo(x, top + w / 2); g.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0); }
    else { g.lineTo(x, top); g.lineTo(x + w, top); }
    g.lineTo(x + w, base); g.closePath();
  }
  function windowsFor(blds, base, share, r, minA, maxA, out) {
    blds.forEach(function (b) {
      if (b.h < 18) return;
      var top = base - b.h + (b.type === 'set' ? b.h * 0.2 : 6);
      for (var y = top + 3; y < base - 4; y += 6.5) for (var x = b.x + 3; x <= b.x + b.w - 5; x += 5) if (r() < share) out.push({ x: x, y: y, a: minA + r() * (maxA - minA), f: r() < 0.03 });
    });
  }
  function paintWindows(g, wins, W, H, dpr, glow) {
    var s = surface(W, H, dpr);
    wins.forEach(function (w) { s.g.fillStyle = 'rgba(255,212,140,' + w.a + ')'; s.g.fillRect(w.x, w.y, 2, 2.6); });
    if (glow) { g.save(); g.filter = 'blur(' + glow + 'px)'; g.globalAlpha = 0.9; g.drawImage(s.c, 0, 0, W, H); g.restore(); }
    g.drawImage(s.c, 0, 0, W, H);
  }
  function blink(ctx, p, t, phase) {
    if (!p) return;
    var a = Math.pow((Math.sin(t / 520 + (phase || 0)) + 1) / 2, 3), gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    gr.addColorStop(0, 'rgba(255,70,60,' + (0.9 * a) + ')'); gr.addColorStop(1, 'rgba(255,70,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 6.283); ctx.fill();
  }

  // ---------------- landmarks ----------------
  // Offsets and heights are fractions of the landmark's height h (mast included), from the centre line and the ground.
  function profileShape(pts, cx, base, h) { // mirror a left-side profile [[halfWidth, y], ...] (bottom to top)
    var p = new Path2D(), i;
    p.moveTo(cx - pts[0][0] * h, base - pts[0][1] * h);
    for (i = 1; i < pts.length; i++) p.lineTo(cx - pts[i][0] * h, base - pts[i][1] * h);
    for (i = pts.length - 1; i >= 0; i--) p.lineTo(cx + pts[i][0] * h, base - pts[i][1] * h);
    p.closePath(); return p;
  }
  var LANDMARKS = {
    // Taipei 101: eight flared modules stacked like a pagoda, a stepped crown, a long mast, a stepped podium.
    taipei101: (function () {
      var pts = [[0.118, 0], [0.118, 0.04], [0.092, 0.04], [0.092, 0.072], [0.056, 0.072], [0.056, 0.10]], y = 0.10, MH = 0.082, i;
      for (i = 0; i < 8; i++) { var ht = 0.068 * (1 - 0.024 * i); pts.push([ht * 0.72, y], [ht, y + MH]); y += MH; }
      pts.push([0.034, y], [0.034, y + 0.035], [0.024, y + 0.035], [0.024, y + 0.07], [0.015, y + 0.07], [0.015, y + 0.105],
        [0.005, y + 0.105], [0.005, 0.93], [0.0018, 0.93], [0.0018, 1]);
      return {
        aspect: 0.236,
        beacon: function (cx, base, h) { return { x: cx, y: base - h }; },
        draw: function (g, cx, base, h, P) {
          var o = profileShape(pts, cx, base, h), hw = 0.118 * h, k = clamp(P.lit / 0.4, 0, 1), d = P.detail, j;
          var gr = g.createLinearGradient(cx - 0.07 * h, 0, cx + 0.07 * h, 0);
          gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.col); gr.addColorStop(1, P.lo);
          g.fillStyle = gr; g.fill(o);
          g.save(); g.clip(o);
          if (k) { g.fillStyle = rgba('#ffd69a', 0.07 * k); g.fillRect(cx - hw, base - 0.756 * h, 2 * hw, 0.656 * h); }
          for (j = 0; j < 8; j++) {
            var yb = base - (0.10 + MH * j) * h, yt = yb - MH * h;
            g.fillStyle = rgba(P.lo, 0.55 * d); g.fillRect(cx - hw, yb - 1.2, 2 * hw, 1.2);
            g.fillStyle = rgba('#ffffff', (P.day ? 0.3 : 0.1) * d); g.fillRect(cx - hw, yt, 2 * hw, 1);
            if (k) { var gl = g.createLinearGradient(0, yt, 0, yt + 0.035 * h); gl.addColorStop(0, rgba('#ffd69a', 0.7 * k)); gl.addColorStop(1, rgba('#ffd69a', 0)); g.fillStyle = gl; g.fillRect(cx - hw, yt, 2 * hw, 0.035 * h); }
          }
          if (k) { var r = rng(5); for (var py = base - 0.066 * h; py < base - 0.006 * h; py += 5) for (var px = cx - 0.11 * h; px < cx + 0.11 * h; px += 5) if (r() < 0.55 * k) { g.fillStyle = 'rgba(255,214,150,.8)'; g.fillRect(px, py, 2, 2.4); } }
          g.restore();
        }
      };
    })(),

    // Kaohsiung 85 Sky Tower: two splayed legs with an arched gap, a tapering body, a forked crown around a mast.
    sky85: (function () {
      var side = [[0.2, 0], [0.2, 0.04], [0.125, 0.04], [0.095, 0.42], [0.092, 0.70], [0.078, 0.72], [0.075, 0.80], [0.062, 0.82], [0.062, 0.88],
        [0.05, 0.935], [0.018, 0.895], [0.006, 0.895], [0.0025, 1]];
      function outline(cx, base, h) {
        var p = new Path2D(), i, X = function (u) { return cx + u * h; }, Y = function (v) { return base - v * h; };
        p.moveTo(X(-side[0][0]), Y(0));
        for (i = 1; i < side.length; i++) p.lineTo(X(-side[i][0]), Y(side[i][1]));
        for (i = side.length - 1; i >= 0; i--) p.lineTo(X(side[i][0]), Y(side[i][1]));
        p.lineTo(X(0.04), Y(0)); p.lineTo(X(0.032), Y(0.33)); p.quadraticCurveTo(X(0), Y(0.47), X(-0.032), Y(0.33)); p.lineTo(X(-0.04), Y(0));
        p.closePath(); return p;
      }
      return {
        aspect: 0.4,
        beacon: function (cx, base, h) { return { x: cx, y: base - h }; },
        draw: function (g, cx, base, h, P) {
          var o = outline(cx, base, h), k = clamp(P.lit / 0.4, 0, 1), d = P.detail, hw = 0.2 * h, v;
          var gr = g.createLinearGradient(cx - 0.1 * h, 0, cx + 0.1 * h, 0);
          gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.col); gr.addColorStop(1, P.lo);
          g.fillStyle = gr; g.fill(o);
          g.save(); g.clip(o);
          for (v = 0.05; v < 0.88; v += 0.024) { g.fillStyle = rgba(P.lo, 0.2 * d); g.fillRect(cx - hw, base - v * h, 2 * hw, 0.7); }
          [0.42, 0.70, 0.80, 0.82].forEach(function (b) { g.fillStyle = rgba('#ffffff', (P.day ? 0.26 : 0.1) * d); g.fillRect(cx - hw, base - b * h, 2 * hw, 1); });
          if (k) { var r = rng(11); for (v = 0.06; v < 0.86; v += 0.024) for (var u = -0.095; u < 0.095; u += 0.02) if (r() < 0.4 * k) { g.fillStyle = 'rgba(255,214,150,.78)'; g.fillRect(cx + u * h, base - v * h, 1.7, 2.2); } }
          g.restore();
        }
      };
    })(),

    // National Taichung Theater (Toyo Ito): a stepped, rounded concrete box cut by overlapping oval "sound caves".
    theater: (function () {
      var roof = [[-0.64, 0], [-0.64, 0.86], [-0.22, 0.86], [-0.22, 1], [0.30, 1], [0.30, 0.92], [0.64, 0.92], [0.64, 0]];
      // [centre x, centre y, half width, half height]
      var caves = [[-0.52, 0.36, 0.085, 0.23], [-0.40, 0.58, 0.06, 0.2], [-0.30, 0.34, 0.1, 0.3], [-0.12, 0.62, 0.075, 0.24], [-0.02, 0.42, 0.115, 0.36],
        [0.15, 0.66, 0.07, 0.2], [0.22, 0.36, 0.09, 0.28], [0.38, 0.58, 0.085, 0.26], [0.47, 0.3, 0.07, 0.2], [0.56, 0.5, 0.055, 0.2]];
      function outline(cx, base, h) {
        var p = new Path2D(), i, R = 0.05 * h;
        p.moveTo(cx + roof[0][0] * h, base);
        for (i = 1; i < roof.length - 1; i++) p.arcTo(cx + roof[i][0] * h, base - roof[i][1] * h, cx + roof[i + 1][0] * h, base - roof[i + 1][1] * h, R);
        p.lineTo(cx + roof[roof.length - 1][0] * h, base); p.closePath(); return p;
      }
      return {
        aspect: 1.28, beacon: null,
        draw: function (g, cx, base, h, P) {
          var o = outline(cx, base, h), k = clamp(P.lit / 0.4, 0, 1), d = P.detail, hw = 0.64 * h, v;
          var gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0);
          gr.addColorStop(0, P.hi); gr.addColorStop(0.55, P.col); gr.addColorStop(1, P.lo);
          g.fillStyle = gr; g.fill(o);
          g.save(); g.clip(o);
          for (v = 0.14; v < 1; v += 0.14) { g.fillStyle = rgba('#ffffff', (P.day ? 0.1 : 0.05) * d); g.fillRect(cx - hw, base - v * h, 2 * hw, 0.8); }
          caves.forEach(function (c) {
            var x = cx + c[0] * h, y = base - c[1] * h, rx = c[2] * h, ry = c[3] * h, cp = new Path2D();
            cp.ellipse(x, y, rx, ry, 0, 0, 6.2832);
            var cg = g.createLinearGradient(0, y - ry, 0, y + ry);
            cg.addColorStop(0, rgba(P.lo, 0.9)); cg.addColorStop(1, mix(P.lo, '#ffd69a', 0.75 * k));
            g.fillStyle = cg; g.fill(cp);
            g.strokeStyle = rgba('#ffffff', (P.day ? 0.2 : 0.08) * d); g.lineWidth = 1; g.stroke(cp);
          });
          g.restore();
        }
      };
    })(),

    // Tainan's Chihkan Tower: two storeys of red walls under hip roofs with swept-up eaves, on a stone platform.
    chihkan: (function () {
      var pts = [[0.34, 0], [0.34, 0.07], [0.22, 0.07], [0.22, 0.24], [0.30, 0.245], [0.34, 0.29], [0.27, 0.285], [0.20, 0.30], [0.14, 0.335], [0.10, 0.37],
        [0.12, 0.37], [0.12, 0.52], [0.22, 0.525], [0.25, 0.575], [0.20, 0.57], [0.13, 0.60], [0.07, 0.66], [0.045, 0.72], [0.05, 0.77], [0.0, 0.74]];
      return {
        aspect: 0.7, beacon: null,
        draw: function (g, cx, base, h, P) {
          var o = profileShape(pts, cx, base, h), k = clamp(P.lit / 0.4, 0, 1), d = P.detail;
          var gr = g.createLinearGradient(cx - 0.25 * h, 0, cx + 0.25 * h, 0);
          gr.addColorStop(0, P.hi); gr.addColorStop(0.5, P.col); gr.addColorStop(1, P.lo);
          g.fillStyle = gr; g.fill(o);
          g.save(); g.clip(o);
          [[0.07, 0.24, 0.2], [0.37, 0.52, 0.1]].forEach(function (w) {
            var x = cx - w[2] * h, y0 = base - w[1] * h, hh = (w[1] - w[0]) * h;
            if (k) { var gl = g.createLinearGradient(0, y0, 0, y0 + hh); gl.addColorStop(0, rgba('#ffd69a', 0.55 * k)); gl.addColorStop(1, rgba('#ffd69a', 0.2 * k)); g.fillStyle = gl; g.fillRect(x, y0, 2 * w[2] * h, hh); }
            g.fillStyle = rgba(P.lo, 0.5 * d);
            for (var i = -3; i <= 3; i++) g.fillRect(cx + i * w[2] * h / 3.4 - 0.6, y0, 1.2, hh);
          });
          [0.245, 0.525].forEach(function (y) { g.fillStyle = rgba('#ffffff', (P.day ? 0.22 : 0.08) * d); g.fillRect(cx - 0.34 * h, base - y * h, 0.68 * h, 1); });
          g.restore();
        }
      };
    })()
  };

  // City -> how its skyline is built. `mountains` raises the ridges, `towers` thins out the city.
  var CITIES = {
    Taipei: { landmark: 'taipei101', h: 1, mountains: 1, towers: 1 },
    Taichung: { landmark: 'theater', h: 0.64, mountains: 1, towers: 1 },
    Tainan: { landmark: 'chihkan', h: 0.5, mountains: 0.35, towers: 0.55 },
    Kaohsiung: { landmark: 'sky85', h: 0.95, mountains: 0.8, towers: 1 },
    Hualien: { landmark: null, h: 0, mountains: 1.7, towers: 0.3 },
    World: { landmark: null, h: 0, mountains: 0.8, towers: 1 }
  };

  // ---------------- one skyline image + its animated overlay ----------------
  var cache = { key: '', built: null };
  function build(o, W, H, dpr) {
    var cfg = CITIES[o.city] || CITIES.World, lm = cfg.landmark ? LANDMARKS[cfg.landmark] : null;
    var sil = cssHex('--sil', '#0B1B3F'), horizon = cssHex('--sky3', '#2A5AA8');
    var pm = o.pm, lit = o.lit, day = o.day;
    var vis = Math.max(1.5, 75 * Math.exp(-pm / 38));                       // visibility in km from PM2.5
    var hc = mix(horizon, '#b49c7c', clamp((pm - 20) / 70, 0, 0.85));       // haze colour
    var veil = function (d) { return 1 - Math.exp(-3.9 * d / vis); };
    var col = function (d) { return mix(sil, hc, clamp(veil(d) * 0.95 + 0.04, 0, 1)); };
    var img = surface(W, H, dpr), g = img.g;
    var sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, rgba(hc, 0)); sky.addColorStop(1, rgba(hc, clamp((pm - 20) / 120, 0, 0.6)));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    fillRidge(g, ridge(13, H * 0.6, H * 0.45 * cfg.mountains), W, H, col(32));
    fillRidge(g, ridge(17, H * 0.74, H * 0.3 * (0.5 + cfg.mountains / 2)), W, H, col(16));
    var cx = W * 0.6, r = rng(5), wins = [], T = null, t = cfg.towers;
    [{ seed: 81, d: 7, base: H * 0.9, o: { wMin: 12, wMax: 30, hMin: H * 0.12 * t, hMax: H * 0.46 * t, gap: 3 / t } },
     { seed: 91, d: 2.5, base: H * 0.96, o: { wMin: 16, wMax: 40, hMin: H * 0.1 * t, hMax: H * 0.42 * t, gap: 6 / t }, lm: true },
     { seed: 99, d: 0.6, base: H, o: { wMin: 26, wMax: 60, hMin: H * 0.05 * t, hMax: H * 0.22 * t, gap: 3 / t } }].forEach(function (L) {
      var c = col(L.d), blds = genBlds(L.seed, W, L.o);
      if (L.lm && lm) {
        T = { cx: cx, base: L.base, h: H * 0.92 * cfg.h, w: lm.aspect * H * 0.92 * cfg.h };
        blds = blds.filter(function (b) { return Math.abs(b.x + b.w / 2 - cx) > T.w / 2 + b.w / 2 + 2 || b.h < H * 0.2; });
        lm.draw(g, T.cx, T.base, T.h, { col: c, hi: mix(c, '#ffffff', day && !lit ? 0.14 : 0.06), lo: mix(c, '#000000', 0.2), day: day && !lit, lit: lit, detail: clamp(1 - veil(L.d), 0, 1) });
      }
      g.fillStyle = c; blds.forEach(function (b) { g.beginPath(); bldPath(g, b, L.base); g.fill(); });
      if (lit && L.d < 8) windowsFor(blds, L.base, lit * 0.45, r, 0.25 * (1 - veil(L.d)), 0.9 * (1 - veil(L.d)), wins);
    });
    if (wins.length) paintWindows(g, wins, W, H, dpr, 2.5);
    var bp = T && lm.beacon ? lm.beacon(T.cx, T.base, T.h) : null;
    return { img: img.c, ground: col(0.6), frame: function (ctx, tm) { if (lit) blink(ctx, bp, tm); } };
  }

  var loop = { raf: 0, stop: function () { cancelAnimationFrame(this.raf); this.raf = 0; } };
  var ro = null, mounted = null;

  function paint(canvas, o) {
    var W = canvas.clientWidth, H = canvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!W || !H) return;
    var key = [o.city, Math.round(o.pm), o.lit, o.day ? 1 : 0, W, H, dpr, cssHex('--sil', ''), cssHex('--sky3', '')].join('|');
    if (cache.key !== key) cache = { key: key, built: build(o, W, H, dpr) };
    var b = cache.built, ctx = canvas.getContext('2d');
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.parentNode.style.setProperty('--ground', b.ground);
    loop.stop();
    var lastT = -1e9;
    function draw(t) {
      if (!canvas.isConnected) return;
      if (t - lastT >= 120 && canvas.getBoundingClientRect().bottom > 0) {
        lastT = t;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        ctx.drawImage(b.img, 0, 0, W, H); b.frame(ctx, t);
      }
      if (!o.reduce && !document.hidden) loop.raf = requestAnimationFrame(draw);
    }
    draw(0);
  }

  window.Horizon = {
    // el is the .skyline-wrap placeholder; its canvas is created here
    mount: function (el, o) {
      if (!el) return;
      var canvas = document.createElement('canvas');
      canvas.className = 'skyline'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', o.label || 'City skyline');
      el.innerHTML = ''; el.appendChild(canvas);
      mounted = { canvas: canvas, o: o };
      paint(canvas, o);
      if (window.ResizeObserver) {
        if (ro) ro.disconnect();
        var timer; ro = new ResizeObserver(function () { clearTimeout(timer); timer = setTimeout(function () { if (mounted && mounted.canvas.isConnected) paint(mounted.canvas, mounted.o); }, 120); });
        ro.observe(el);
      }
    }
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden && mounted && mounted.canvas.isConnected) paint(mounted.canvas, mounted.o); });
})();
