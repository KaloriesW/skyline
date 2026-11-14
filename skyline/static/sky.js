// Animated sky behind the dashboard: clouds, rain, stars, sun glare, lightning, fog and haze.
(function () {
  const canvas = document.getElementById('fx');
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, DPR = 1, raf = 0, last = 0;
  let cfg = { mood: 'clear-day', haze: 0, wind: 0 };
  let clouds = [], drops = [], stars = [], motes = [], fogBands = [];
  let flash = 0, nextFlash = 0, bolt = null, shooting = null;

  const rand = (a, b) => a + Math.random() * (b - a);
  const has = (...m) => m.includes(cfg.mood);

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Pre-render each cloud into its own small canvas: a cluster of soft radial puffs.
  function makeCloud(dark, scale) {
    const w = 420 * scale, h = 180 * scale;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const puffs = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < puffs; i++) {
      const r = rand(45, 85) * scale;
      const x = rand(r, w - r), y = rand(h * 0.45, h - r * 0.6);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const base = dark ? '70,80,98' : '255,255,255';
      grd.addColorStop(0, `rgba(${base},${dark ? 0.55 : 0.5})`);
      grd.addColorStop(1, `rgba(${base},0)`);
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  function build() {
    const m = cfg.mood;
    const nClouds = { 'clear-day': 2, 'clear-night': 1, 'partly-day': 6, 'partly-night': 5, 'cloudy-day': 11, 'cloudy-night': 10,
      rain: 12, storm: 13, fog: 6, dusk: 4, dawn: 4 }[m] ?? 4;
    const dark = has('rain', 'storm', 'cloudy-night', 'partly-night');
    clouds = Array.from({ length: nClouds }, () => {
      const s = rand(0.7, 1.5);
      return { img: makeCloud(dark, s), x: rand(-300, W), y: rand(-40, H * 0.55), v: rand(4, 12) * (cfg.wind >= 0 ? 1 : -1), a: rand(0.35, 0.85) };
    });
    const nDrops = has('storm') ? 420 : has('rain') ? 260 : 0;
    drops = Array.from({ length: nDrops }, () => newDrop(true));
    stars = has('clear-night', 'partly-night') ? Array.from({ length: 170 }, () => ({
      x: rand(0, W), y: rand(0, H * 0.75), r: rand(0.3, 1.4), p: rand(0, Math.PI * 2), s: rand(0.5, 2) })) : [];
    motes = Array.from({ length: Math.round(cfg.haze * 160) }, () => ({ x: rand(0, W), y: rand(0, H), r: rand(0.6, 2), vx: rand(-6, 6), vy: rand(-3, 3), a: rand(0.1, 0.35) }));
    fogBands = has('fog') ? Array.from({ length: 5 }, (_, i) => ({ y: H * (0.3 + i * 0.14), x: rand(-W, 0), v: rand(6, 14), h: rand(90, 160) })) : [];
    nextFlash = performance.now() + rand(2500, 6000);
  }

  function newDrop(anywhere) {
    return { x: rand(-100, W + 100), y: anywhere ? rand(-H, H) : rand(-120, -10), l: rand(12, 26), v: rand(700, 1100), a: rand(0.15, 0.4) };
  }

  function sunGlow(t) {
    const x = W * 0.8, y = H * 0.08;
    const pulse = 1 + Math.sin(t / 2200) * 0.04;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 380 * pulse);
    g.addColorStop(0, 'rgba(255,248,220,0.55)');
    g.addColorStop(0.25, 'rgba(255,230,160,0.18)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // lens flare: soft discs along the line from the sun through the screen centre
    const cx = W / 2, cy = H / 2;
    [[0.35, 26, 0.10], [0.62, 12, 0.14], [0.9, 48, 0.06], [1.25, 18, 0.09]].forEach(([k, r, a]) => {
      const fx = x + (cx - x) * k * 2, fy = y + (cy - y) * k * 2;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
      fg.addColorStop(0, `rgba(255,240,200,${a})`); fg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
    });
  }

  function moonGlow() {
    const x = W * 0.78, y = H * 0.12;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 260);
    g.addColorStop(0, 'rgba(220,230,255,0.22)'); g.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function makeBolt() {
    const pts = [[rand(W * 0.15, W * 0.85), 0]];
    while (pts[pts.length - 1][1] < H * rand(0.45, 0.7)) {
      const [px, py] = pts[pts.length - 1];
      pts.push([px + rand(-40, 40), py + rand(20, 50)]);
    }
    return pts;
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    ctx.clearRect(0, 0, W, H);

    if (has('clear-day', 'partly-day', 'dawn', 'dusk')) sunGlow(t);
    if (has('clear-night', 'partly-night')) moonGlow();

    for (const s of stars) {
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.p + t / 1000 * s.s));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (stars.length) {
      if (!shooting && Math.random() < dt * 0.08) shooting = { x: rand(W * 0.2, W), y: rand(0, H * 0.3), life: 1 };
      if (shooting) {
        const s = shooting;
        const grd = ctx.createLinearGradient(s.x, s.y, s.x + 120, s.y - 50);
        grd.addColorStop(0, `rgba(255,255,255,${s.life})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grd; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + 120, s.y - 50); ctx.stroke();
        s.x -= 600 * dt; s.y += 250 * dt; s.life -= dt * 1.4;
        if (s.life <= 0) shooting = null;
      }
    }

    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.v > 0 && c.x > W + 50) c.x = -c.img.width;
      if (c.v < 0 && c.x < -c.img.width) c.x = W + 50;
      ctx.globalAlpha = c.a; ctx.drawImage(c.img, c.x, c.y);
    }
    ctx.globalAlpha = 1;

    for (const f of fogBands) {
      f.x += f.v * dt; if (f.x > W) f.x = -W;
      const g = ctx.createLinearGradient(0, f.y - f.h, 0, f.y + f.h);
      g.addColorStop(0, 'rgba(235,240,245,0)'); g.addColorStop(0.5, 'rgba(235,240,245,0.16)'); g.addColorStop(1, 'rgba(235,240,245,0)');
      ctx.fillStyle = g; ctx.fillRect(f.x, f.y - f.h, W * 2, f.h * 2);
    }

    if (drops.length) {
      const slant = Math.max(-0.35, Math.min(0.35, cfg.wind * 0.015));
      ctx.lineCap = 'round'; ctx.lineWidth = 1.1;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.y += d.v * dt; d.x += d.v * slant * dt;
        if (d.y > H + 30) drops[i] = newDrop(false);
        ctx.strokeStyle = `rgba(200,220,255,${d.a})`;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * slant, d.y - d.l); ctx.stroke();
      }
    }

    if (has('storm')) {
      if (t > nextFlash) { flash = 1; bolt = Math.random() < 0.6 ? makeBolt() : null; nextFlash = t + rand(3500, 9000); }
      if (flash > 0) {
        ctx.fillStyle = `rgba(220,230,255,${flash * 0.35})`; ctx.fillRect(0, 0, W, H);
        if (bolt) {
          ctx.strokeStyle = `rgba(255,255,255,${flash})`; ctx.lineWidth = 2.2; ctx.shadowColor = '#cfe0ff'; ctx.shadowBlur = 18;
          ctx.beginPath(); bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
          ctx.shadowBlur = 0;
        }
        flash -= dt * 2.6;
      }
    }

    for (const m of motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < 0) m.x = W; if (m.x > W) m.x = 0; if (m.y < 0) m.y = H; if (m.y > H) m.y = 0;
      ctx.fillStyle = `rgba(255,236,200,${m.a})`; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }

    if (!reduce) raf = requestAnimationFrame(frame);
  }

  window.Sky = {
    start(opts) {
      cfg = { ...cfg, ...opts };
      document.documentElement.style.setProperty('--haze', String(cfg.haze));
      cancelAnimationFrame(raf);
      resize(); build(); last = 0;
      raf = requestAnimationFrame(frame);
    },
  };
  addEventListener('resize', () => { resize(); build(); });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = 0; raf = requestAnimationFrame(frame); }
  });
})();
