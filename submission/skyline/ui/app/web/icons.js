// Weather icons (colour SVG), small UI glyphs, and WMO weather-code lookup.
// From the team dashboard (branch app, skyline/static/icons.js), plus glyphs for the storm, sea and landslide widgets.
(function () {
  const CLOUD = 'M18 46a9 9 0 0 1-1-18 13 13 0 0 1 25-4 10 10 0 0 1 6 22z';
  const defs = `
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <radialGradient id="gSun" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF1A6"/><stop offset=".55" stop-color="#FFD23F"/><stop offset="1" stop-color="#FFAA2B"/></radialGradient>
    <linearGradient id="gCloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9D4E3"/></linearGradient>
    <linearGradient id="gCloudDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7C2D2"/><stop offset="1" stop-color="#6E7A8C"/></linearGradient>
    <linearGradient id="gMoon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFBEA"/><stop offset="1" stop-color="#D8D0AE"/></linearGradient>
    <clipPath id="cTop"><rect width="64" height="45"/></clipPath>
    <mask id="mMoon"><rect width="64" height="64" fill="#fff"/><circle cx="41" cy="22" r="14" fill="#000"/></mask>
  </defs></svg>`;

  const sun = (cx = 32, cy = 32, s = 1) => {
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      rays += `<line x1="${cx + Math.cos(a) * 17 * s}" y1="${cy + Math.sin(a) * 17 * s}" x2="${cx + Math.cos(a) * 23 * s}" y2="${cy + Math.sin(a) * 23 * s}"/>`;
    }
    return `<g stroke="#FFC93C" stroke-width="${3.2 * s}" stroke-linecap="round">${rays}</g><circle cx="${cx}" cy="${cy}" r="${12 * s}" fill="url(#gSun)"/>`;
  };
  const moon = (t = '') => `<g transform="${t}"><circle cx="30" cy="32" r="17" fill="url(#gMoon)" mask="url(#mMoon)"/></g>`;
  const cloud = (t = '', dark = false) => `<path transform="${t}" d="${CLOUD}" fill="url(#${dark ? 'gCloudDark' : 'gCloud'})"/>`;
  const drops = (n = 3) => {
    let s = '<g stroke="#4FB3FF" stroke-width="3" stroke-linecap="round">';
    for (let i = 0; i < n; i++) s += `<line x1="${24 + i * 9}" y1="51" x2="${21 + i * 9}" y2="59"/>`;
    return s + '</g>';
  };

  const ART = {
    sun: () => sun(),
    moon: () => moon(),
    cloud: () => cloud('translate(-1 -4) scale(1.05)'),
    'partly-day': () => sun(24, 24, 0.72) + cloud('translate(6 6) scale(.92)'),
    'partly-night': () => moon('translate(-6 -8) scale(.8)') + cloud('translate(6 6) scale(.92)'),
    rain: () => cloud('translate(0 -8)') + drops(3),
    drizzle: () => cloud('translate(0 -8)') + '<g fill="#4FB3FF"><circle cx="24" cy="53" r="2.2"/><circle cx="33" cy="57" r="2.2"/><circle cx="42" cy="53" r="2.2"/></g>',
    thunder: () => cloud('translate(0 -10)', true) + '<polygon points="35,40 26,53 33,53 29,63 42,48 35,48 39,40" fill="#FFD54A"/>',
    fog: () => cloud('translate(0 -10)') + '<g stroke="#DDE5EF" stroke-width="3.2" stroke-linecap="round"><line x1="14" y1="48" x2="50" y2="48"/><line x1="18" y1="56" x2="46" y2="56"/></g>',
    snow: () => cloud('translate(0 -8)') + '<g fill="#fff"><circle cx="24" cy="53" r="2.6"/><circle cx="33" cy="58" r="2.6"/><circle cx="42" cy="53" r="2.6"/></g>',
    sunrise: () => horizon(true),
    sunset: () => horizon(false),
  };
  function horizon(up) {
    const arrow = up ? 'M32 6v12M26 12l6-6 6 6' : 'M32 6v12M26 12l6 6 6-6';
    return `<g clip-path="url(#cTop)">${sun(32, 46, 0.62)}</g>
      <line x1="8" y1="46" x2="56" y2="46" stroke="#FFC93C" stroke-width="3" stroke-linecap="round"/>
      <path d="${arrow}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Monochrome UI glyphs (24px grid, stroke = currentColor).
  const UI = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    school: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c3 2 7 2 10 0v-4.5"/>',
    chart: '<path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0"/><path d="M12 4v5M9.5 6.5L12 4l2.5 2.5"/>',
    thermo: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/>',
    drop: '<path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
    gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 13l3.5-4"/>',
    umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>',
    map: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>',
    moon: '<path d="M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8 6 6 0 0 1 11.3-1.5A4.8 4.8 0 0 1 17.5 18z"/>',
    layers: '<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    cyclone: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4c0-3.4 2.6-5.9 6.5-5.9M14.6 12c3.4 0 5.9 2.6 5.9 6.5M12 14.6c0 3.4-2.6 5.9-6.5 5.9M9.4 12c-3.4 0-5.9-2.6-5.9-6.5"/>',
    waves: '<path d="M2.5 8.5c2.4 0 2.4-2 4.75-2s2.4 2 4.75 2 2.4-2 4.75-2 2.4 2 4.75 2M2.5 13.5c2.4 0 2.4-2 4.75-2s2.4 2 4.75 2 2.4-2 4.75-2 2.4 2 4.75 2M2.5 18.5c2.4 0 2.4-2 4.75-2s2.4 2 4.75 2 2.4-2 4.75-2 2.4 2 4.75 2"/>',
    slope: '<path d="M3 19.5h18L14 6l-4 6.5-2.5-3z"/><path d="M15.5 13.5l1.5 2M12 15.5l1 1.5"/>',
    season: '<path d="M4 19.5h16"/><path d="M6.5 16V9M12 16V5M17.5 16v-5"/><path d="M4.5 9.5l2-2 2 2M15.5 11.5l2-2 2 2"/>',
    station: '<path d="M12 21V11"/><circle cx="12" cy="8" r="2.5"/><path d="M7.5 3.5a6.5 6.5 0 0 0 0 9M16.5 3.5a6.5 6.5 0 0 1 0 9"/>',
  };

  const WMO = {
    0: ['Clear', 'sun'], 1: ['Mostly Clear', 'partly'], 2: ['Partly Cloudy', 'partly'], 3: ['Cloudy', 'cloud'],
    45: ['Fog', 'fog'], 48: ['Freezing Fog', 'fog'],
    51: ['Light Drizzle', 'drizzle'], 53: ['Drizzle', 'drizzle'], 55: ['Heavy Drizzle', 'drizzle'],
    56: ['Freezing Drizzle', 'drizzle'], 57: ['Freezing Drizzle', 'drizzle'],
    61: ['Light Rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy Rain', 'rain'],
    66: ['Freezing Rain', 'rain'], 67: ['Freezing Rain', 'rain'],
    71: ['Light Snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy Snow', 'snow'], 77: ['Snow Grains', 'snow'],
    80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy Showers', 'rain'],
    85: ['Snow Showers', 'snow'], 86: ['Snow Showers', 'snow'],
    95: ['Thunderstorms', 'thunder'], 96: ['Thunderstorms', 'thunder'], 99: ['Severe Thunderstorms', 'thunder'],
  };

  window.Icons = {
    mount() { if (!document.getElementById('gSun')) document.body.insertAdjacentHTML('afterbegin', defs); },
    wmo(code, isDay = true) {
      const [label, kind] = WMO[code] || ['—', 'cloud'];
      let art = kind;
      if (kind === 'sun') art = isDay ? 'sun' : 'moon';
      if (kind === 'partly') art = isDay ? 'partly-day' : 'partly-night';
      return { label, kind, art };
    },
    art(name, size = 32) {
      return `<svg class="wx-icon" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">${(ART[name] || ART.cloud)()}</svg>`;
    },
    ui(name, size = 14) {
      return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${UI[name] || ''}</svg>`;
    },
  };
})();
