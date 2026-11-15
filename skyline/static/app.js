// Skyline dashboard: data loading, tiles, widget gallery, edit mode and model sheet.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const grid = $('#grid');
  const STORE = 'skyline.layout.v1';
  const DEFAULT_LAYOUT = ['hourly', 'tomorrow', 'daily', 'aqi', 'advice', 'pmtrend', 'wind', 'uv', 'sunrise', 'feels',
    'map', 'pm25', 'pm10', 'precip', 'humidity', 'visibility', 'pressure', 'model'];
  const S = { w: null, a: null, station: null, pred: null, metrics: null, layout: [], editing: false, hourlyMode: 'temp', mapLayer: 'rain', loaded: false };

  // ---------- helpers ----------
  const fmt = (v, d = 0) => (v == null || isNaN(v) ? '--' : Number(v).toFixed(d));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sum = (arr) => arr.reduce((s, v) => s + (v || 0), 0);
  const P = (s) => {
    const [d, t = '00:00'] = s.split('T');
    const [y, m, dd] = d.split('-').map(Number);
    const [hh, mm] = t.split(':').map(Number);
    return { y, m, d: dd, hh, mm, date: d, mins: hh * 60 + mm, ts: Date.UTC(y, m - 1, dd, hh, mm) };
  };
  const hourLabel = (hh) => `${hh % 12 || 12}${hh < 12 ? 'AM' : 'PM'}`;
  const timeLabel = (s) => { const p = P(s); return `${p.hh % 12 || 12}:${String(p.mm).padStart(2, '0')}${p.hh < 12 ? 'AM' : 'PM'}`; };
  const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekday = (date) => { const p = P(date); return WEEK[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()]; };
  const niceDate = (date) => { const p = P(date); return `${weekday(date)}, ${MONTHS[p.m - 1]} ${p.d}`; };
  const cardinal = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

  const CATS = [[50, 'Good', '#3ad06e', 'Clean air. Enjoy the outdoors.'],
    [100, 'Moderate', '#f5d33b', 'Acceptable for most people.'],
    [150, 'Unhealthy for Sensitive Groups', '#ff8c32', 'Sensitive groups: limit long exertion.'],
    [200, 'Unhealthy', '#ff4545', 'Everyone: cut back outdoor exertion.'],
    [300, 'Very Unhealthy', '#a35cd6', 'Avoid outdoor exertion.'],
    [1e9, 'Hazardous', '#8a1538', 'Stay indoors.']];
  const aqiCat = (v) => CATS.find((c) => v <= c[0]);
  const shortCat = (name) => (name === 'Unhealthy for Sensitive Groups' ? 'Unhealthy (Sens.)' : name);
  const PM25_BP = [[0, 9, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150], [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500]];
  const PM10_BP = [[0, 54, 0, 50], [55, 154, 51, 100], [155, 254, 101, 150], [255, 354, 151, 200], [355, 424, 201, 300], [425, 604, 301, 500]];
  const subIndex = (c, bps) => { for (const [lo, hi, il, ih] of bps) if (c <= hi) return Math.round((ih - il) / (hi - lo) * (Math.max(c, lo) - lo) + il); return 500; };

  const TSTOPS = [[0, [61, 139, 255]], [10, [90, 200, 250]], [16, [99, 230, 190]], [21, [255, 214, 10]], [26, [255, 159, 10]], [32, [255, 69, 58]]];
  function tcol(t) {
    if (t <= TSTOPS[0][0]) return `rgb(${TSTOPS[0][1]})`;
    for (let i = 1; i < TSTOPS.length; i++) {
      const [t1, c1] = TSTOPS[i];
      if (t <= t1) {
        const [t0, c0] = TSTOPS[i - 1]; const k = (t - t0) / (t1 - t0);
        return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * k))})`;
      }
    }
    return `rgb(${TSTOPS[TSTOPS.length - 1][1]})`;
  }

  // ---------- context for the current data ----------
  function ctx() {
    const w = S.w, cur = w.current;
    const nowKey = cur.time.slice(0, 13) + ':00';
    const hi = Math.max(0, w.hourly.time.indexOf(nowKey));
    const ai = Math.max(0, S.a.hourly.time.indexOf(nowKey));
    const di = Math.max(0, w.daily.time.indexOf(cur.time.slice(0, 10)));
    return { w, a: S.a, cur, hi, ai, di, now: P(cur.time), isDay: !!cur.is_day };
  }

  // ---------- tiles ----------
  const TILES = {
    hourly: {
      title: 'Hourly Forecast', label: 'Next 24 Hours', icon: 'clock', size: 'h', desc: 'Temperature, air quality or rain for each hour, with sunrise and sunset.',
      head: () => `<div class="seg">${[['temp', 'Temp'], ['air', 'Air'], ['rain', 'Rain']].map(([k, l]) => `<button data-hmode="${k}" class="${S.hourlyMode === k ? 'on' : ''}">${l}</button>`).join('')}</div>`,
      render(c) {
        const h = c.w.hourly, d = c.w.daily;
        const airAt = Object.fromEntries(c.a.hourly.time.map((t, i) => [t, c.a.hourly.pm2_5[i]]));
        const end = Math.min(h.time.length, c.hi + 25);
        const items = [];
        for (let i = c.hi; i < end; i++) items.push({ ts: P(h.time[i]).ts, i });
        const t0 = items[0].ts, t1 = items[items.length - 1].ts;
        for (let k = c.di; k < Math.min(d.time.length, c.di + 2); k++) {
          for (const [kind, key] of [['Sunrise', 'sunrise'], ['Sunset', 'sunset']]) {
            const ts = P(d[key][k]).ts;
            if (ts > t0 && ts < t1) items.push({ ts, sun: kind, t: d[key][k] });
          }
        }
        items.sort((x, y) => x.ts - y.ts);
        const cells = items.map((it) => {
          if (it.sun) {
            return `<div class="hour"><span class="t">${timeLabel(it.t)}</span>${Icons.art(it.sun === 'Sunrise' ? 'sunrise' : 'sunset', 30)}<span class="p"></span><span class="v" style="font-size:13px">${it.sun}</span></div>`;
          }
          const i = it.i, p = P(h.time[i]);
          const label = i === c.hi ? 'Now' : hourLabel(p.hh);
          if (S.hourlyMode === 'air') {
            const pm = airAt[h.time[i]];
            const cat = pm == null ? null : aqiCat(subIndex(pm, PM25_BP));
            return `<div class="hour ${i === c.hi ? 'now' : ''}"><span class="t">${label}</span><span class="aq-dot" style="background:${cat ? cat[2] : '#777'};color:${cat ? cat[2] : '#777'}"></span><span class="p" style="color:var(--dim)">µg/m³</span><span class="v">${fmt(pm)}</span></div>`;
          }
          if (S.hourlyMode === 'rain') {
            return `<div class="hour ${i === c.hi ? 'now' : ''}"><span class="t">${label}</span>${Icons.art(h.precipitation[i] > 0.1 ? 'rain' : 'cloud', 30)}<span class="p">${fmt(h.precipitation[i], 1)} mm</span><span class="v">${fmt(h.precipitation_probability[i])}%</span></div>`;
          }
          const ic = Icons.wmo(h.weather_code[i], !!h.is_day[i]);
          const pp = h.precipitation_probability[i];
          return `<div class="hour ${i === c.hi ? 'now' : ''}"><span class="t">${label}</span>${Icons.art(ic.art, 30)}<span class="p">${pp >= 20 ? pp + '%' : ''}</span><span class="v">${fmt(i === c.hi ? c.cur.temperature_2m : h.temperature_2m[i])}°</span></div>`;
        });
        return `<div class="hours">${cells.join('')}</div>`;
      },
    },

    daily: {
      title: '10-Day Forecast', icon: 'calendar', size: 't', desc: 'Highs, lows and rain chance for the next 10 days.',
      render(c) {
        const d = c.w.daily;
        const idx = []; for (let k = c.di; k < Math.min(d.time.length, c.di + 10); k++) idx.push(k);
        const lo = Math.min(...idx.map((k) => d.temperature_2m_min[k]));
        const hi = Math.max(...idx.map((k) => d.temperature_2m_max[k]));
        const pos = (t) => ((t - lo) / (hi - lo || 1)) * 100;
        return `<div class="days">${idx.map((k, n) => {
          const mn = d.temperature_2m_min[k], mx = d.temperature_2m_max[k];
          const pp = d.precipitation_probability_max[k];
          const dot = n === 0 ? `<b style="left:${clamp(pos(c.cur.temperature_2m), 0, 100)}%"></b>` : '';
          return `<div class="day"><span>${n === 0 ? 'Today' : weekday(d.time[k])}</span>
            <span class="ic">${Icons.art(Icons.wmo(d.weather_code[k], true).art, 24)}${pp >= 20 ? `<small>${pp}%</small>` : ''}</span>
            <span class="lo">${fmt(mn)}°</span>
            <span class="bar"><i style="left:${pos(mn)}%;width:${pos(mx) - pos(mn)}%;background:linear-gradient(90deg,${tcol(mn)},${tcol(mx)})"></i>${dot}</span>
            <span class="hi">${fmt(mx)}°</span></div>`;
        }).join('')}</div>`;
      },
    },

    tomorrow: {
      title: "Tomorrow's Air", icon: 'sparkle', size: 'w', gold: true, badge: 'BY SKYLINE',
      desc: "Skyline's own AI forecast of tomorrow's PM2.5, PM10 and AQI for Taichung.",
      open: () => openModel(),
      render() {
        const p = S.pred;
        if (!p) return '<div class="tile-err">Forecast unavailable right now</div>';
        const diff = p.pm25 - p.today.pm25;
        const trend = Math.abs(diff) < 1 ? '' : `<span class="trend ${diff < 0 ? 'down' : 'up'}">${diff < 0 ? '↓' : '↑'} ${fmt(Math.abs(diff), 1)} vs today</span>`;
        const better = p.model ? Math.round((1 - p.model.test_mae / p.model.baseline_mae) * 100) : null;
        return `<div class="tm">
          <div class="aqibig"><span data-count="${p.aqi}">${p.aqi}</span><small style="color:${p.color}">AQI · ${shortCat(p.category)}</small></div>
          <div class="vals">
            <div><b data-count="${p.pm25}" data-dec="1">${p.pm25}</b>µg/m³ PM2.5 ${trend}<br><span style="font-size:11.5px">likely ${p.pm25_range[0]}–${p.pm25_range[1]}</span></div>
            <div><b data-count="${p.pm10}" data-dec="1">${p.pm10}</b>µg/m³ PM10</div>
          </div></div>
          <div class="note dim">${niceDate(p.date)}${better != null ? ` · ${better}% more accurate than “same as today”` : ''} · tap for details</div>`;
      },
    },

    advice: {
      title: 'School Outdoor Plan', label: 'School Outdoor Plan · Tomorrow', icon: 'school', size: 'w', gold: true,
      desc: 'Turns the PM2.5 forecast into a go / limit / indoors call for PE and sports practice.',
      open: () => openModel(),
      render() {
        const p = S.pred;
        if (!p) return '<div class="tile-err">Forecast unavailable right now</div>';
        const a = p.advice;
        const glyph = { go: '✓', limit: '!', indoor: '⌂' }[a.level];
        return `<div class="advice"><div class="light ${a.level}">${glyph}</div><div><h4>${a.title}</h4><p>${a.detail}</p></div></div>
          <div class="note dim">From Skyline's forecast (AQI ${p.aqi}). Prototype, not official health advice.</div>`;
      },
    },

    model: {
      title: 'Model Check', icon: 'target', size: 's', gold: true,
      desc: 'How much better our model is than guessing “tomorrow = today”, on 12 months it never saw.',
      open: () => openModel(),
      render() {
        const m = S.metrics;
        if (!m) return '<div class="tile-err">No model report</div>';
        const ch = m.chosen.pm25, mm = m.results.pm25[ch].mae, bm = m.results.pm25.baseline.mae;
        return `<div class="big">−${Math.round((1 - mm / bm) * 100)}%<small>error</small></div>
          <div class="cmp">
            <div class="row">Skyline · ${fmt(mm, 1)} µg/m³<span class="track"><i style="width:${(mm / bm) * 100}%;background:var(--gold)"></i></span></div>
            <div class="row">Same as today · ${fmt(bm, 1)}<span class="track"><i style="width:100%;background:rgba(255,255,255,.45)"></i></span></div>
          </div>`;
      },
    },

    pmtrend: {
      title: 'PM2.5 Outlook', icon: 'chart', size: 'w', source: 'CAMS', desc: 'PM2.5 over the past 2 days and the next 3, with our forecast for tomorrow.',
      render(c) {
        const a = c.a.hourly;
        const from = Math.max(0, c.ai - 48), to = Math.min(a.time.length, c.ai + 72);
        const vals = a.pm2_5.slice(from, to);
        const n = vals.length;
        if (n < 2) return '<div class="tile-err">No data</div>';
        const ymax = Math.max(50, ...vals.filter((v) => v != null)) * 1.12;
        const X = (i) => (i / (n - 1)) * 300, Y = (v) => 100 - (v / ymax) * 100;
        const pts = vals.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
        const nowX = X(c.ai - from);
        const past = pts.filter(([x]) => x <= nowX + 0.01), fut = pts.filter(([x]) => x >= nowX - 0.01);
        const line = (ps) => ps.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
        const area = past.length ? `${line(past)}L${past[past.length - 1][0]},100L${past[0][0]},100Z` : '';
        let gold = '';
        if (S.pred) {
          const s = a.time.indexOf(S.pred.date + 'T00:00'), e = a.time.indexOf(S.pred.date + 'T23:00');
          if (s >= from && e > 0) {
            const y = Y(S.pred.pm25);
            gold = `<rect x="${X(s - from)}" y="${Y(S.pred.pm25_range[1])}" width="${X(Math.min(e, to - 1) - from) - X(s - from)}" height="${Y(S.pred.pm25_range[0]) - Y(S.pred.pm25_range[1])}" fill="rgba(255,194,75,.14)"/>
              <line x1="${X(s - from)}" x2="${X(Math.min(e, to - 1) - from)}" y1="${y}" y2="${y}" stroke="#FFC24B" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
          }
        }
        return `<div class="chart"><svg viewBox="0 0 300 100" preserveAspectRatio="none">
            <defs><linearGradient id="pmFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(120,200,255,.45)"/><stop offset="1" stop-color="rgba(120,200,255,0)"/></linearGradient></defs>
            <line x1="0" x2="300" y1="${Y(35)}" y2="${Y(35)}" stroke="rgba(255,120,90,.7)" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>
            <path d="${area}" fill="url(#pmFill)"/>
            <path d="${line(past)}" fill="none" stroke="#9fd8ff" stroke-width="2" vector-effect="non-scaling-stroke"/>
            <path d="${line(fut)}" fill="none" stroke="#9fd8ff" stroke-width="2" stroke-dasharray="3 4" opacity=".75" vector-effect="non-scaling-stroke"/>
            ${gold}
            <line x1="${nowX}" x2="${nowX}" y1="0" y2="100" stroke="rgba(255,255,255,.5)" vector-effect="non-scaling-stroke"/>
          </svg></div>
          <div class="legend"><span><i style="background:#9fd8ff"></i>CAMS hourly (dashed = forecast)</span><span><i style="background:#FFC24B"></i>Skyline tomorrow</span><span><i style="background:rgba(255,120,90,.8)"></i>35 µg/m³</span></div>`;
      },
    },

    aqi: {
      title: 'Air Quality', icon: 'leaf', size: 's', source: 'CAMS', desc: 'US AQI right now, from all pollutants.',
      render(c) {
        const v = c.a.current.us_aqi, cat = aqiCat(v);
        const st = S.station ? `<div class="note dim">Zhongming station: AQI ${S.station.aqi} (${S.station.status})</div>` : `<div class="note">${cat[3]}</div>`;
        return `<div class="big" data-count="${v}">${fmt(v)}</div><div class="sub" style="${cat[1].length > 12 ? 'font-size:14px' : ''}">${shortCat(cat[1])}</div>
          <div class="meter aqi"><b style="left:${clamp(v / 300, 0, 1) * 100}%"></b></div>${st}`;
      },
    },

    pm25: {
      title: 'PM2.5', icon: 'drop', size: 's', source: 'CAMS', desc: 'Fine particles right now and their 24-hour average.',
      render(c) { return pmTile(c, 'pm2_5', PM25_BP); },
    },
    pm10: {
      title: 'PM10', icon: 'drop', size: 's', source: 'CAMS', desc: 'Coarse particles right now and their 24-hour average.',
      render(c) { return pmTile(c, 'pm10', PM10_BP); },
    },

    pollutants: {
      title: 'Pollutants', icon: 'layers', size: 'w', source: 'CAMS', desc: 'Ozone, NO₂, SO₂, CO and dust compared with WHO guidelines.',
      render(c) {
        const cur = c.a.current;
        const rows = [['O₃', cur.ozone, 100], ['NO₂', cur.nitrogen_dioxide, 25], ['SO₂', cur.sulphur_dioxide, 40], ['CO', cur.carbon_monoxide, 4000], ['Dust', cur.dust, 50]];
        return `<div class="polls">${rows.map(([n, v, g]) => {
          const k = (v || 0) / g;
          const col = k <= 0.5 ? '#3ad06e' : k <= 1 ? '#f5d33b' : '#ff8c32';
          return `<div class="p"><b>${n}</b><span class="cmp"><span class="track"><i style="width:${clamp(k, 0.02, 1.5) / 1.5 * 100}%;background:${col}"></i></span></span><span>${fmt(v)} µg/m³</span></div>`;
        }).join('')}</div><div class="note dim">Bar = share of the WHO guideline</div>`;
      },
    },

    station: {
      title: 'Official Station', icon: 'station', size: 's', source: 'MOENV', desc: 'Latest reading from the Ministry of Environment station in Zhongming.',
      available: () => !!S.station,
      render() {
        const s = S.station;
        if (!s) return '<div class="tile-err">Needs a MOENV API key</div>';
        return `<div class="big">${s.aqi}</div><div class="sub">${s.status}</div><div class="note">PM2.5 ${s.pm25} · PM10 ${s.pm10} µg/m³<br><span class="dim">${s.station} · ${s.time}</span></div>`;
      },
    },

    wind: {
      title: 'Wind', icon: 'wind', size: 's', desc: 'Speed, gusts and direction with a compass.',
      render(c) {
        const dir = c.cur.wind_direction_10m;
        let ticks = '';
        for (let i = 0; i < 72; i++) {
          const a = (i * 5 * Math.PI) / 180, r1 = i % 6 === 0 ? 37 : 40;
          ticks += `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 43}" y2="${50 - Math.cos(a) * 43}"/>`;
        }
        return `<div class="centerviz"><svg viewBox="0 0 100 100" width="104" height="104">
          <g stroke="rgba(255,255,255,.35)" stroke-width="1">${ticks}</g>
          <g font-size="9" font-weight="600" fill="rgba(255,255,255,.75)" text-anchor="middle"><text x="50" y="22">N</text><text x="80" y="53">E</text><text x="50" y="84">S</text><text x="20" y="53">W</text></g>
          <g transform="rotate(${dir + 180} 50 50)"><line x1="50" y1="88" x2="50" y2="14" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><polygon points="50,9 45,19 55,19" fill="#fff"/><circle cx="50" cy="88" r="3" fill="none" stroke="#fff" stroke-width="2"/></g>
          <circle cx="50" cy="50" r="15" fill="rgba(20,30,50,.75)"/>
          <text x="50" y="50" font-size="13" font-weight="600" fill="#fff" text-anchor="middle">${fmt(c.cur.wind_speed_10m)}</text>
          <text x="50" y="59" font-size="6.5" fill="rgba(255,255,255,.7)" text-anchor="middle">km/h</text></svg></div>
          <div class="note">Gusts ${fmt(c.cur.wind_gusts_10m)} km/h · from ${cardinal(dir)}</div>`;
      },
    },

    uv: {
      title: 'UV Index', icon: 'sun', size: 's', desc: 'Current UV level and when to use sun protection.',
      render(c) {
        const h = c.w.hourly, uv = h.uv_index[c.hi] ?? 0;
        const lvl = uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : uv < 11 ? 'Very High' : 'Extreme';
        const today = c.cur.time.slice(0, 10);
        const strong = h.time.map((t, i) => [t, h.uv_index[i]]).filter(([t, v]) => t.startsWith(today) && v >= 3);
        const note = strong.length && P(strong[strong.length - 1][0]).hh >= c.now.hh
          ? `Use sun protection ${hourLabel(P(strong[0][0]).hh)}–${hourLabel(P(strong[strong.length - 1][0]).hh + 1)}.`
          : 'Low for the rest of the day.';
        return `<div class="big">${fmt(uv)}</div><div class="sub">${lvl}</div><div class="meter uv"><b style="left:${clamp(uv / 11, 0, 1) * 100}%"></b></div><div class="note">${note}</div>`;
      },
    },

    sunrise: {
      title: 'Sunrise', icon: 'sunrise', size: 's', desc: "Next sunrise or sunset and the sun's path today.",
      label: () => { const c = ctx(); const sr = P(c.w.daily.sunrise[c.di]).mins, ss = P(c.w.daily.sunset[c.di]).mins; return c.now.mins >= sr && c.now.mins < ss ? 'Sunset' : 'Sunrise'; },
      render(c) {
        const d = c.w.daily, sr = P(d.sunrise[c.di]), ss = P(d.sunset[c.di]), m = c.now.mins;
        let big, foot;
        if (m < sr.mins) { big = d.sunrise[c.di]; foot = `Sunset: ${timeLabel(d.sunset[c.di])}`; }
        else if (m < ss.mins) { big = d.sunset[c.di]; foot = `Sunrise: ${timeLabel(d.sunrise[c.di])}`; }
        else { big = d.sunrise[c.di + 1] || d.sunrise[c.di]; foot = `Sunset: ${timeLabel(d.sunset[c.di])}`; }
        let phi;
        if (m >= sr.mins && m <= ss.mins) phi = 0.25 + 0.5 * (m - sr.mins) / (ss.mins - sr.mins);
        else { const night = 1440 - (ss.mins - sr.mins); const since = (m - ss.mins + 1440) % 1440; phi = (0.75 + 0.5 * since / night) % 1; }
        const curve = Array.from({ length: 61 }, (_, i) => { const f = i / 60; return `${i ? 'L' : 'M'}${f * 120},${32 - 22 * Math.sin(2 * Math.PI * (f - 0.25))}`; }).join('');
        const sx = phi * 120, sy = 32 - 22 * Math.sin(2 * Math.PI * (phi - 0.25));
        const up = sy <= 32;
        return `<div class="big" style="font-size:30px">${timeLabel(big)}</div>
          <div class="centerviz"><svg viewBox="0 6 120 52" width="100%" height="58">
            <defs><clipPath id="above"><rect x="0" y="0" width="120" height="32"/></clipPath>
              <radialGradient id="sunDot"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs>
            <path d="${curve}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.6"/>
            <path d="${curve}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.6" clip-path="url(#above)"/>
            <line x1="0" x2="120" y1="32" y2="32" stroke="rgba(255,255,255,.45)" stroke-width="1"/>
            ${up ? `<circle cx="${sx}" cy="${sy}" r="9" fill="url(#sunDot)"/>` : ''}
            <circle cx="${sx}" cy="${sy}" r="3.6" fill="${up ? '#fff' : 'rgba(255,255,255,.45)'}"/>
          </svg></div>
          <div class="note">${foot}</div>`;
      },
    },

    feels: {
      title: 'Feels Like', icon: 'thermo', size: 's', desc: 'Apparent temperature and why it differs.',
      render(c) {
        const f = c.cur.apparent_temperature, t = c.cur.temperature_2m, diff = f - t;
        const why = Math.abs(diff) < 2 ? 'Similar to the actual temperature.'
          : diff > 0 ? (c.cur.relative_humidity_2m >= 70 ? 'Humidity is making it feel warmer.' : 'It feels warmer than the actual temperature.')
          : (c.cur.wind_speed_10m >= 15 ? 'Wind is making it feel cooler.' : 'It feels cooler than the actual temperature.');
        return `<div class="big">${fmt(f)}°</div><div class="note">${why}</div>`;
      },
    },

    humidity: {
      title: 'Humidity', icon: 'drop', size: 's', desc: 'Relative humidity and dew point.',
      render(c) { return `<div class="big">${fmt(c.cur.relative_humidity_2m)}%</div><div class="note">The dew point is ${fmt(c.w.hourly.dew_point_2m[c.hi])}° right now.</div>`; },
    },

    visibility: {
      title: 'Visibility', icon: 'eye', size: 's', desc: 'How far you can see. Haze from PM2.5 lowers it.',
      render(c) {
        const km = (c.w.hourly.visibility[c.hi] || 0) / 1000;
        const note = km >= 20 ? 'Perfectly clear view.' : km >= 10 ? 'Clear view.' : km >= 5 ? 'Light haze or rain is reducing visibility.' : 'Low visibility. Haze or rain is limiting the view.';
        return `<div class="big">${fmt(km, km < 10 ? 1 : 0)}<small>km</small></div><div class="note">${note}</div>`;
      },
    },

    pressure: {
      title: 'Pressure', icon: 'gauge', size: 's', desc: 'Sea-level pressure and whether it is rising or falling.',
      render(c) {
        const h = c.w.hourly, p = c.cur.pressure_msl;
        const later = h.pressure_msl[Math.min(h.time.length - 1, c.hi + 3)];
        const trend = later - p > 0.6 ? ['↑', 'Rising'] : later - p < -0.6 ? ['↓', 'Falling'] : ['=', 'Steady'];
        const k = clamp((p - 980) / 60, 0, 1), a0 = -225, a1 = 45, ang = ((a0 + (a1 - a0) * k) * Math.PI) / 180;
        const arc = (a, b, r) => { const x1 = 50 + r * Math.cos(a * Math.PI / 180), y1 = 50 + r * Math.sin(a * Math.PI / 180), x2 = 50 + r * Math.cos(b * Math.PI / 180), y2 = 50 + r * Math.sin(b * Math.PI / 180); return `M${x1},${y1}A${r},${r} 0 1 1 ${x2},${y2}`; };
        return `<div class="centerviz"><svg viewBox="0 0 100 92" width="108" height="100">
          <path d="${arc(a0, a1, 40)}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="7" stroke-linecap="round" stroke-dasharray="1.2 3.2"/>
          <line x1="${50 + 30 * Math.cos(ang)}" y1="${50 + 30 * Math.sin(ang)}" x2="${50 + 45 * Math.cos(ang)}" y2="${50 + 45 * Math.sin(ang)}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
          <text x="50" y="44" text-anchor="middle" font-size="12" fill="#fff">${trend[0]}</text>
          <text x="50" y="60" text-anchor="middle" font-size="15" font-weight="600" fill="#fff">${fmt(p)}</text>
          <text x="50" y="71" text-anchor="middle" font-size="7" fill="rgba(255,255,255,.7)">hPa</text></svg></div>
          <div class="note dim" style="text-align:center">${trend[1]}</div>`;
      },
    },

    precip: {
      title: 'Precipitation', icon: 'umbrella', size: 's', desc: 'Rain in the last 24 hours and expected in the next 24.',
      render(c) {
        const h = c.w.hourly.precipitation;
        const past = sum(h.slice(Math.max(0, c.hi - 23), c.hi + 1)), next = sum(h.slice(c.hi + 1, c.hi + 25));
        return `<div class="big">${fmt(past, past < 10 ? 1 : 0)}<small>mm</small></div><div class="sub" style="font-size:14px">in last 24h</div><div class="note">${fmt(next, 1)} mm expected in next 24h.</div>`;
      },
    },

    clouds: {
      title: 'Cloud Cover', icon: 'cloud', size: 's', desc: 'How much of the sky is covered by cloud.',
      render(c) {
        const v = c.cur.cloud_cover;
        const t = v < 15 ? 'Clear skies' : v < 40 ? 'Mostly clear' : v < 70 ? 'Partly cloudy' : v < 90 ? 'Mostly cloudy' : 'Overcast';
        return `<div class="big">${fmt(v)}%</div><div class="sub">${t}</div><div class="meter" style="background:linear-gradient(90deg,#7cc6ff,#c9d4e3)"><b style="left:${v}%"></b></div>`;
      },
    },

    moon: {
      title: 'Moon', icon: 'moon', size: 's', desc: 'Moon phase, illumination and next full moon.',
      render() {
        const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
        const p = ((((Date.now() - ref) / 86400000) % syn) + syn) % syn / syn;
        const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
        const name = p < 0.03 || p > 0.97 ? 'New Moon' : p < 0.22 ? 'Waxing Crescent' : p < 0.28 ? 'First Quarter' : p < 0.47 ? 'Waxing Gibbous' : p < 0.53 ? 'Full Moon' : p < 0.72 ? 'Waning Gibbous' : p < 0.78 ? 'Last Quarter' : 'Waning Crescent';
        const r = 26, cx = 32, cy = 32, cc = Math.cos(2 * Math.PI * p), rx = r * Math.abs(cc), wax = p < 0.5;
        const path = `M${cx} ${cy - r}A${r} ${r} 0 0 ${wax ? 1 : 0} ${cx} ${cy + r}A${rx} ${r} 0 0 ${cc > 0 ? (wax ? 0 : 1) : (wax ? 1 : 0)} ${cx} ${cy - r}Z`;
        const full = new Date(Date.now() + (((0.5 - p + 1) % 1) * syn) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' });
        return `<div class="centerviz"><svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="26" fill="rgba(255,255,255,.1)"/><path d="${path}" fill="url(#gMoon)"/></svg></div>
          <div class="sub" style="font-size:14px">${name}</div><div class="note dim">${Math.round(lit * 100)}% lit · Full moon ${full}</div>`;
      },
    },

    map: {
      title: 'Live Map', icon: 'map', size: 'l', source: 'Windy', desc: 'Interactive Windy.com map: rain radar, wind, PM2.5 or temperature.',
      head: () => `<div class="chips">${[['rain', 'Rain'], ['wind', 'Wind'], ['pm2p5', 'PM2.5'], ['temp', 'Temp']].map(([k, l]) => `<button data-layer="${k}" class="${S.mapLayer === k ? 'on' : ''}">${l}</button>`).join('')}</div>`,
      render() {
        const L = S.mapLayer;
        const src = `https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=%C2%B0C&metricWind=km%2Fh&zoom=8&overlay=${L}&product=${L === 'pm2p5' ? 'cams' : 'ecmwf'}&level=surface&lat=24.15&lon=120.67&detailLat=24.15&detailLon=120.67&marker=true&message=true`;
        return `<div class="map-wrap"><iframe src="${src}" loading="lazy" title="Windy map of Taichung" referrerpolicy="no-referrer"></iframe></div>`;
      },
    },
  };

  function pmTile(c, key, bps) {
    const v = c.a.current[key];
    const hist = c.a.hourly[key].slice(Math.max(0, c.ai - 23), c.ai + 1).filter((x) => x != null);
    const avg = hist.length ? sum(hist) / hist.length : null;
    const cat = aqiCat(subIndex(v, bps));
    return `<div class="big"><span data-count="${v}">${fmt(v)}</span><small>µg/m³</small></div><div class="sub" style="color:${cat[2]}">${shortCat(cat[1])}</div><div class="note">24-hour average: ${fmt(avg, 1)} µg/m³</div>`;
  }

  const SIZE_NAME = { s: 'Small', w: 'Wide', l: 'Large', t: 'Tall', h: 'Extra wide' };
  const GROUPS = [
    ['By Skyline · our AI model', ['tomorrow', 'advice', 'model', 'pmtrend']],
    ['Air quality', ['aqi', 'pm25', 'pm10', 'pollutants', 'station']],
    ['Weather', ['hourly', 'daily', 'wind', 'uv', 'sunrise', 'feels', 'humidity', 'visibility', 'pressure', 'precip', 'clouds', 'moon']],
    ['Maps', ['map']],
  ];

  // ---------- layout persistence ----------
  function loadLayout() {
    try {
      const v = JSON.parse(localStorage.getItem(STORE));
      if (Array.isArray(v)) return v.filter((id) => TILES[id]);
    } catch (e) { /* storage blocked or empty: fall back to default */ }
    return DEFAULT_LAYOUT.slice();
  }
  function saveLayout() { try { localStorage.setItem(STORE, JSON.stringify(S.layout)); } catch (e) { /* ignore */ } }

  // ---------- rendering ----------
  function tileEl(id, i, anim = true) {
    const t = TILES[id];
    let body;
    try { body = t.render(ctx()); } catch (e) { console.error(id, e); body = '<div class="tile-err">No data</div>'; }
    const label = typeof t.label === 'function' ? t.label() : (t.label || t.title);
    const right = t.head ? t.head() : t.badge ? `<span class="badge">${t.badge}</span>` : t.source ? `<em class="src">${t.source}</em>` : '';
    const el = document.createElement('article');
    el.className = `tile size-${t.size}${t.gold ? ' gold' : ''}${t.open ? ' clickable' : ''}`;
    el.dataset.id = id;
    el.style.setProperty('--i', i);
    if (!anim) el.style.animation = 'none';
    el.draggable = S.editing;
    el.innerHTML = `<button class="remove-badge" data-remove="${id}" aria-label="Remove ${t.title}">−</button>
      <header class="tile-head">${Icons.ui(t.icon)}<span>${label}</span>${right}</header><div class="tile-body">${body}</div>`;
    return el;
  }

  function renderGrid(anim) {
    grid.innerHTML = '';
    S.layout.forEach((id, i) => grid.appendChild(tileEl(id, i, anim)));
    if (anim) countUp(grid);
  }

  function rerender(id) {
    const old = grid.querySelector(`[data-id="${id}"]`);
    if (old) old.replaceWith(tileEl(id, 0, false));
  }

  function countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0);
      if (isNaN(to)) return;
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (to * e).toFixed(dec);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function flip(mutate) {
    const first = new Map([...grid.children].map((e) => [e, e.getBoundingClientRect()]));
    mutate();
    for (const e of grid.children) {
      const f = first.get(e);
      if (!f) continue;
      const l = e.getBoundingClientRect(), dx = f.left - l.left, dy = f.top - l.top;
      if (dx || dy) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function hero() {
    const c = ctx(), d = c.w.daily, ic = Icons.wmo(c.cur.weather_code, c.isDay);
    $('#heroTemp').textContent = fmt(c.cur.temperature_2m);
    $('#heroCond').textContent = ic.label;
    $('#heroHL').textContent = `H:${fmt(d.temperature_2m_max[c.di])}°  L:${fmt(d.temperature_2m_min[c.di])}°`;
    $('#compactTemp').textContent = `${fmt(c.cur.temperature_2m)}°`;
    $('#compactCond').textContent = ic.label;
    const h = $('#heroHeadline');
    if (S.pred) {
      h.hidden = false;
      h.innerHTML = `<span class="dot" style="background:${S.pred.color};color:${S.pred.color}"></span><span class="tag">Tomorrow</span>${S.pred.category} air · PM2.5 ≈ ${S.pred.pm25} µg/m³`;
    }
    // sky mood
    const q = new URLSearchParams(location.search).get('mood');
    const sr = P(d.sunrise[c.di]).mins, ss = P(d.sunset[c.di]).mins, m = c.now.mins;
    let mood;
    if (ic.kind === 'thunder') mood = 'storm';
    else if (ic.kind === 'rain' || ic.kind === 'drizzle' || ic.kind === 'snow') mood = 'rain';
    else if (ic.kind === 'fog') mood = 'fog';
    else if (Math.abs(m - ss) < 40) mood = 'dusk';
    else if (Math.abs(m - sr) < 40) mood = 'dawn';
    else if (ic.kind === 'cloud') mood = c.isDay ? 'cloudy-day' : 'cloudy-night';
    else if (ic.kind === 'partly') mood = c.isDay ? 'partly-day' : 'partly-night';
    else mood = c.isDay ? 'clear-day' : 'clear-night';
    mood = q || mood;
    document.body.dataset.mood = mood;
    document.body.dataset.day = c.isDay ? '1' : '0';
    const u = -c.cur.wind_speed_10m * Math.sin((c.cur.wind_direction_10m * Math.PI) / 180);
    Sky.start({ mood, wind: u, haze: clamp((c.a.current.pm2_5 - 12) / 70, 0, 0.6) });
  }

  function footer() {
    const m = S.metrics;
    $('#foot').innerHTML = `Weather: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> forecast · Air quality: Copernicus CAMS via Open-Meteo${S.station ? ' and Taiwan MOENV' : ''} · Map: <a href="https://www.windy.com" target="_blank" rel="noopener">Windy.com</a><br>
      Tomorrow's air: Skyline model${m ? ` (trained ${m.trained_on}, tested ${m.tested_on})` : ''}. Prototype, not official health advice.`;
  }

  // ---------- sheets ----------
  const backdrop = $('#sheetBackdrop'), sheet = $('#sheet');
  function openSheet(html) {
    sheet.innerHTML = html;
    sheet.scrollTop = 0;
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('open'));
  }
  function closeSheet() {
    backdrop.classList.remove('open');
    setTimeout(() => { backdrop.hidden = true; }, 320);
  }
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.closest('.close')) closeSheet(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSheet(); setEditing(false); } });
  const closeBtn = '<button class="round-btn close" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';

  function openGallery() {
    const card = (id) => {
      const t = TILES[id], on = S.layout.includes(id);
      return `<div class="gcard${t.gold ? ' gold' : ''}"><div class="gi">${Icons.ui(t.icon, 20)}</div><div style="flex:1">
        <div class="gt">${t.title}</div><div class="gd">${t.desc}</div>
        <div class="gm"><span class="size">${SIZE_NAME[t.size]}</span><button class="add-btn${on ? ' added' : ''}" data-toggle="${id}">${on ? 'Added ✓' : '+ Add'}</button></div></div></div>`;
    };
    openSheet(`<div class="sheet-head"><h2>Add widgets</h2>${closeBtn}</div>
      <p>Pick what shows on your dashboard. Tap a widget's button again to remove it, or use <b>Edit</b> (···) to drag widgets around.</p>
      ${GROUPS.map(([g, ids]) => {
        const list = ids.filter((id) => !TILES[id].available || TILES[id].available());
        return list.length ? `<h3>${g}</h3><div class="gallery">${list.map(card).join('')}</div>` : '';
      }).join('')}
      <h3>Layout</h3><button class="text-btn" data-reset style="padding-left:0">Reset to the default layout</button>`);
  }

  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-toggle]');
    if (b) {
      const id = b.dataset.toggle;
      if (S.layout.includes(id)) { removeTile(id); b.classList.remove('added'); b.textContent = '+ Add'; }
      else { addTile(id); b.classList.add('added'); b.textContent = 'Added ✓'; }
      return;
    }
    if (e.target.closest('[data-reset]')) { resetLayout(); closeSheet(); }
  });

  function addTile(id) {
    S.layout.push(id);
    saveLayout();
    const el = tileEl(id, 0, false);
    el.classList.add('pop');
    grid.appendChild(el);
    countUp(el);
    setTimeout(() => el.classList.remove('pop'), 900);
  }

  function removeTile(id) {
    const el = grid.querySelector(`[data-id="${id}"]`);
    S.layout = S.layout.filter((x) => x !== id);
    saveLayout();
    if (!el) return;
    el.classList.add('removing');
    setTimeout(() => flip(() => el.remove()), 260);
  }

  function resetLayout() {
    S.layout = DEFAULT_LAYOUT.slice();
    saveLayout();
    renderGrid(true);
  }

  // ---------- model sheet ----------
  function lineChart(series, keys, colors, ymaxHint) {
    const n = series[keys[0]].length;
    const ymax = Math.max(ymaxHint, ...keys.flatMap((k) => series[k])) * 1.08;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${((i / (n - 1)) * 800).toFixed(1)},${(220 - (v / ymax) * 220).toFixed(1)}`).join('');
    return `<svg viewBox="0 0 800 220" preserveAspectRatio="none" width="100%" height="100%">
      <line x1="0" x2="800" y1="${220 - (35 / ymax) * 220}" y2="${220 - (35 / ymax) * 220}" stroke="rgba(255,120,90,.7)" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>
      ${keys.map((k, i) => `<path d="${path(series[k])}" fill="none" stroke="${colors[i]}" stroke-width="${i === 0 ? 1.6 : 1.3}" vector-effect="non-scaling-stroke" opacity="${i === 2 ? 0.55 : 1}"/>`).join('')}
    </svg>`;
  }

  function openModel() {
    const m = S.metrics, p = S.pred;
    if (!m) return;
    const ch = m.chosen.pm25, R = m.results;
    const NAMES = { baseline: 'Tomorrow = today (baseline)', v1: 'First model: Ridge, 25 inputs', ridge: 'Ridge + upwind inputs', boosted: 'Boosted trees + upwind inputs', blend: 'Ridge + trees blend + upwind inputs', blend_no_weather: 'Blend without weather forecast' };
    const W = R.warnings, ch10 = m.chosen.pm10, WT = W.tuned;
    const better = Math.round((1 - R.pm25[ch].mae / R.pm25.baseline.mae) * 100);
    const rows = Object.keys(NAMES).map((k) => `<tr class="${k === ch ? 'best' : ''}"><td>${NAMES[k]}</td><td>${fmt(R.pm25[k].mae, 2)}${k === ch ? ' ✓' : ''}</td><td>${fmt(R.pm10[k].mae, 2)}${k === ch10 ? ' ✓' : ''}</td><td>${W[k].caught}/${W[k].bad_days}</td><td>${W[k].warned - W[k].caught}</td></tr>`).join('')
      + `<tr class="best"><td>Skyline warning (forecast above ${fmt(WT.threshold, 1)})</td><td></td><td></td><td>${WT.caught}/${WT.bad_days} ✓</td><td>${WT.warned - WT.caught}</td></tr>`;
    const months = m.monthly.pm25;
    const mmax = Math.max(...months.flatMap((x) => [x.model, x.baseline]));
    const monthBars = months.map((x) => `<div style="display:grid;grid-template-columns:62px 1fr 92px;gap:8px;align-items:center;font-size:12px">
      <span style="color:var(--dim)">${x.month}</span>
      <span style="display:grid;gap:3px"><span class="cmp"><span class="track"><i style="width:${x.model / mmax * 100}%;background:var(--gold)"></i></span></span><span class="cmp"><span class="track"><i style="width:${x.baseline / mmax * 100}%;background:rgba(255,255,255,.45)"></i></span></span></span>
      <span style="text-align:right">${fmt(x.model, 1)} vs ${fmt(x.baseline, 1)}</span></div>`).join('');
    const ticks = m.test_dates.filter((d) => d.endsWith('-01')).map((d) => `<span style="position:absolute;left:${m.test_dates.indexOf(d) / (m.test_dates.length - 1) * 100}%">${MONTHS[+d.slice(5, 7) - 1]}</span>`).join('');
    const fails = m.failures.map((f) => `<div class="fail"><b>${f.date}</b><span>Actual <b>${f.actual}</b> · we said <b style="color:var(--gold)">${f.model}</b> · baseline ${f.baseline} µg/m³ <span style="color:var(--dim)">(forecast rain ${f.tomorrow_rain_mm} mm, wind ${f.tomorrow_wind_kmh} km/h)</span></span></div>`).join('');
    openSheet(`<div class="sheet-head"><h2>How Skyline predicts tomorrow's air</h2>${closeBtn}</div>
      ${p ? `<p>For <b>${niceDate(p.date)}</b> the model expects an average PM2.5 of <b>${p.pm25} µg/m³</b> (likely ${p.pm25_range[0]}–${p.pm25_range[1]}) and PM10 of <b>${p.pm10} µg/m³</b>. That is AQI <b>${p.aqi}, ${p.category}</b>. Today is averaging ${p.today.pm25} µg/m³, and tomorrow's forecast has ${p.tomorrow_weather.rain_mm} mm of rain and ${p.tomorrow_weather.wind_kmh} km/h of wind.</p>` : ''}
      <h3>Results on 12 months the model never saw (${m.tested_on})</h3>
      <div class="kpis">
        <div class="kpi"><b>${fmt(R.pm25[ch].mae, 1)}</b><span>µg/m³ average error, Skyline</span></div>
        <div class="kpi"><b>${fmt(R.pm25.baseline.mae, 1)}</b><span>µg/m³ average error, “same as today”</span></div>
        <div class="kpi"><b style="color:var(--gold)">${better}%</b><span>less error than the baseline</span></div>
        <div class="kpi"><b>${WT.caught}/${WT.bad_days}</b><span>days over 35 µg/m³ warned (${WT.warned - WT.caught} false alarms)</span></div>
      </div>
      <div class="bigchart">${lineChart(m.series.pm25, ['actual', 'model', 'baseline'], ['#9fd8ff', '#FFC24B', '#ffffff'], 40)}</div>
      <div style="position:relative;height:16px;font-size:11px;color:var(--faint)">${ticks}</div>
      <div class="legend"><span><i style="background:#9fd8ff"></i>Actual daily PM2.5</span><span><i style="background:#FFC24B"></i>Skyline prediction</span><span><i style="background:rgba(255,255,255,.6)"></i>Same as today</span><span><i style="background:rgba(255,120,90,.8)"></i>35 µg/m³</span></div>
      <h3>All models compared</h3>
      <p style="font-size:12.5px;color:var(--dim);margin-top:-4px">PM2.5 and PM10 columns are mean absolute error in µg/m³ (lower is better).</p>
      <table class="metrics"><tr><th>Model</th><th>PM2.5</th><th>PM10</th><th>Bad days warned</th><th>False alarms</th></tr>${rows}</table>
      <p style="font-size:12.5px;color:var(--dim)">✓ marks what Skyline uses. Every choice was made by cross-validation on the training years (${m.cv_on}), not on the test year. That picked the blend for PM2.5 and kept the first model for PM10. The warning threshold is set lower than 35 on purpose: for a school, a missed bad-air day is worse than a false alarm, so Skyline warns when its forecast is above ${fmt(WT.threshold, 1)} µg/m³. Removing tomorrow's weather forecast makes the error noticeably worse, so rain and wind are a big part of what the model learns.</p>
      <h3>Error by month (Skyline vs baseline)</h3><div style="display:grid;gap:6px">${monthBars}</div>
      <h3>Where it fails</h3>
      <p>Our five biggest misses on the test year. Three are sudden spikes the model under-predicted and two are days that cleared up faster than it expected. Adding pollution levels upwind of Taichung helped a little, but the model still only sees daily averages at a few points, so a sudden stagnant day or a short burst of polluted air can still surprise it. Two of the under-predicted days had rain in the forecast, so the model may expect rain to clean the air more than it really does. We haven't checked that yet.</p>
      <div class="fails">${fails}</div>
      <h3>How it works</h3>
      <p><b>Inputs:</b> today's and yesterday's PM2.5 and PM10 (daily average, peak, evening level), 3- and 7-day averages, today's weather, and the weather forecast for tomorrow (rain, wind speed and direction, humidity, temperature, pressure, mixing-layer height), plus season and weekend. The PM2.5 model also gets today's PM2.5 at four upwind points (Taoyuan, the Fujian coast, the Changhua/Yunlin coast and Kaohsiung), and how hard tomorrow's north wind will push the northern air south.</p>
      <p><b>Training:</b> ${m.n_train} days (${m.trained_on}). Tested once on the next ${m.n_test} days. The live model is then refit on every day for today's forecast.</p>
      <p><b>Honest caveats:</b> the PM2.5/PM10 history comes from the Copernicus CAMS model via Open-Meteo, not from ground stations. It puts ${W.baseline.bad_days} of ${m.n_test} test days above 35 µg/m³, which looks high for Taichung, so the absolute numbers need checking against Ministry of Environment (MOENV) station data. In training we used the weather that actually happened as the “forecast”, so live accuracy will be a little worse than the test score. The next step is to retrain on MOENV station measurements.</p>`);
  }

  // ---------- edit mode ----------
  function setEditing(on) {
    S.editing = on;
    document.body.classList.toggle('editing', on);
    grid.querySelectorAll('.tile').forEach((t) => { t.draggable = on; });
  }
  $('#editBtn').addEventListener('click', () => setEditing(!S.editing));
  $('#doneBtn').addEventListener('click', () => setEditing(false));
  $('#resetBtn').addEventListener('click', () => resetLayout());
  $('#addBtn').addEventListener('click', () => openGallery());
  $('#heroHeadline').addEventListener('click', () => openModel());

  grid.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { removeTile(rm.dataset.remove); return; }
    if (S.editing) return;
    const hm = e.target.closest('[data-hmode]');
    if (hm) { S.hourlyMode = hm.dataset.hmode; rerender('hourly'); return; }
    const ml = e.target.closest('[data-layer]');
    if (ml) { S.mapLayer = ml.dataset.layer; rerender('map'); return; }
    const t = e.target.closest('.tile');
    if (t && TILES[t.dataset.id].open) TILES[t.dataset.id].open();
  });

  let dragEl = null, lastMove = 0;
  grid.addEventListener('dragstart', (e) => {
    dragEl = S.editing ? e.target.closest('.tile') : null;
    if (!dragEl) { e.preventDefault(); return; }
    dragEl.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragEl.dataset.id); } catch (_) { /* Safari quirk */ }
  });
  grid.addEventListener('dragover', (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const over = e.target.closest('.tile');
    if (!over || over === dragEl || performance.now() - lastMove < 150) return;
    const r = over.getBoundingClientRect(), before = e.clientX - r.left < r.width / 2;
    if ((before && over.previousElementSibling === dragEl) || (!before && over.nextElementSibling === dragEl)) return;
    lastMove = performance.now();
    flip(() => grid.insertBefore(dragEl, before ? over : over.nextElementSibling));
  });
  grid.addEventListener('dragend', () => {
    if (!dragEl) return;
    dragEl.classList.remove('dragging');
    dragEl = null;
    S.layout = [...grid.children].map((el) => el.dataset.id);
    saveLayout();
  });

  // long-press a tile to enter edit mode
  let pressTimer = 0, pressAt = null;
  grid.addEventListener('pointerdown', (e) => {
    if (S.editing || !e.target.closest('.tile') || e.target.closest('iframe,button')) return;
    pressAt = [e.clientX, e.clientY];
    pressTimer = setTimeout(() => setEditing(true), 600);
  });
  grid.addEventListener('pointermove', (e) => {
    const t = e.target.closest('.tile');
    if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`); }
    if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 8) { clearTimeout(pressTimer); pressAt = null; }
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => grid.addEventListener(ev, () => { clearTimeout(pressTimer); pressAt = null; }));

  // ---------- scroll: hero fades, compact title appears ----------
  const heroEl = $('#hero'), topbar = $('#topbar');
  addEventListener('scroll', () => {
    const y = scrollY;
    heroEl.style.opacity = String(clamp(1 - y / 240, 0, 1));
    heroEl.style.transform = `translateY(${y * 0.35}px) scale(${1 - clamp(y / 2400, 0, 0.1)})`;
    topbar.classList.toggle('scrolled', y > 170);
  }, { passive: true });

  // ---------- data ----------
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }

  async function load() {
    const banner = $('#banner');
    try {
      const [wx, pred, metrics] = await Promise.all([
        getJSON('/api/weather'),
        getJSON('/api/predict').catch(() => null),
        S.metrics ? S.metrics : getJSON('/api/model').catch(() => null),
      ]);
      S.w = wx.weather; S.a = wx.air; S.station = wx.station; S.pred = pred; S.metrics = metrics;
      banner.hidden = true;
      hero();
      renderGrid(!S.loaded);
      footer();
      S.loaded = true;
    } catch (e) {
      console.error(e);
      banner.hidden = false;
      banner.textContent = "Couldn't reach the weather service. Retrying in a minute…";
      setTimeout(load, 60000);
    }
  }

  Icons.mount();
  S.layout = loadLayout();
  grid.innerHTML = S.layout.map((id) => `<div class="skeleton size-${TILES[id].size}"></div>`).join('');
  load();
  setInterval(load, 10 * 60 * 1000);
})();
