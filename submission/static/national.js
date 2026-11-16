/* National coverage and review priorities; all locations resolve to saved scan geometry. */
(() => {
  const panel=document.createElement('section');panel.id='national-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Whole-Taiwan monitoring');
  panel.innerHTML=`<button type="button" data-n-close>← Back to map</button><h2>Whole-Taiwan watch</h2><p>Scan new Sentinel-2 acquisitions across the land grid. Catalogue checks every 15 minutes; regional weather refreshed hourly. This is a local background queue, not an instant nationwide scan.</p><p data-n-estimate>Loading coverage plan…</p><button type="button" data-n-preview>Preview coverage</button><button type="button" data-n-start disabled>Start whole-Taiwan monitoring</button><p data-n-message role="status"></p><p data-n-coverage></p><p data-n-errors></p><p class="hint">Blue: saved result · amber: partial/cloud-limited · gold: scanning · purple: queued · gray: unassessed/failed. Coverage is by planning cell, not clear land percentage.</p><h3>Rain watch</h3><div data-n-weather></div><h3>Review priorities</h3><p class="hint">Rain + evidence ranks first, then supporting checks and mapped-road proximity. Experimental thresholds: 80 mm / 24 h or 20 mm / hour. These are not official warnings or failure probabilities. Wind and temperature provide context only.</p><div data-n-candidates></div><a data-n-report hidden>Download latest hourly national report ↓</a><details><summary>Coverage &amp; scoring limitations</summary><p class="hint" data-n-note></p></details><p class="hint">Background scans require this Mac awake and the server running. Pause stops future jobs; an active scan finishes. <a href="https://github.com/g0v/twgeojson" target="_blank" rel="noopener">Planning boundaries: g0v · CC0</a>. Weather: MET Norway · CC BY 4.0.</p>`;
  document.body.append(panel);
  const style=document.createElement('style');style.textContent='body.national-open .controls{display:none}#national-panel[hidden]{display:none}#national-panel{position:fixed;z-index:4900;right:18px;top:18px;bottom:18px;width:min(460px,calc(100vw - 36px));overflow:auto;box-sizing:border-box;background:rgba(16,26,48,.96);color:#eef5f1;border:1px solid #ffffff35;border-radius:18px;padding:22px;font:14px/1.6 Inter,system-ui}#national-panel button{padding:9px 13px;border:1px solid #ffffff55;border-radius:20px;background:#ffffff15;color:white;cursor:pointer;margin:4px}#national-panel [data-n-start]{background:#FFC24B;color:#251800}#national-panel a{color:#FFC24B}#national-panel .national-candidate{border-top:1px solid #ffffff35;padding:12px 0}#national-panel .hint{color:#b7c1d1;font-size:12px}';document.head.append(style);
  const find=s=>panel.querySelector(s);let state=null,coverage=null,pins=null,previewed=false,plan=null,busy=false,hiddenLocal=[];
  const number=(v,unit)=>v==null?'unavailable':`${Number(v).toFixed(1)} ${unit}`;
  function hideLayers(){if(coverage)map.removeLayer(coverage);if(pins)map.removeLayer(pins);}
  function restoreLocal(){
    const live=new Set([imagery,detections,markers,excluded,...Object.values(evidenceLayers)]);
    for(const layer of hiddenLocal)if(live.has(layer))layer.addTo(map);hiddenLocal=[];
    document.querySelector('.map-bottom .legend').innerHTML='<i></i> Suspected landslide';
    if(currentResult)$('map-badge-text').textContent=`${currentResult.acquired.slice(0,10)} · ${currentResult.model} · 10 m imagery`;
  }
  function draw(){
    hideLayers();
    for(const layer of [imagery,detections,markers,excluded,...Object.values(evidenceLayers)])if(layer&&map.hasLayer(layer)){if(!hiddenLocal.includes(layer))hiddenLocal.push(layer);map.removeLayer(layer);}
    document.querySelector('.map-bottom .legend').textContent='National coverage';$('map-badge-text').textContent=`${state.cells_with_results} / ${state.total_cells} cells with results · clouds remain unassessed`;
const colors={completed:'#60b8ff',partial:'#cb9638',scanning:'#FFC24B',queued:'#aa91ed',failed:'#929292',unassessed:'#929292'};
    coverage=L.layerGroup(state.cells.map(c=>{const r=L.rectangle([[c.bbox[1],c.bbox[0]],[c.bbox[3],c.bbox[2]]],{color:colors[c.status],weight:1,fillOpacity:.12});r.bindTooltip(`${c.counties.join(' / ')} · ${c.id} · ${c.status}${c.usable_percent!=null?' · '+c.usable_percent+'% usable in scan square':''}`);return r;})).addTo(map);
    pins=L.layerGroup(state.candidates.map(p=>{const marker=L.circleMarker([p.latitude,p.longitude],{radius:7,color:p.priority.startsWith('Priority')?'#ff7257':'#FFC24B',weight:2,fillOpacity:.8});marker.bindTooltip(`${p.priority} · ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);marker.on('click',()=>openCandidate(p));return marker;})).addTo(map);
  }
  async function openCandidate(p){
    try{hideLayers();restoreLocal();panel.hidden=true;document.body.classList.remove('national-open');scanDisplay.release();await loadHistory(p.scan_id);if(currentResult?.id===p.scan_id)focusReviewArea(p.id,p.scan_id);else throw Error('Saved scan could not load.');}
    catch(e){panel.hidden=false;document.body.classList.add('national-open');find('[data-n-message]').textContent=e.message;}
  }
  function render(s){
    state=s;find('[data-n-start]').textContent=s.enabled?'Pause whole-Taiwan monitoring':'Start whole-Taiwan monitoring';find('[data-n-start]').disabled=busy||!previewed;
    find('[data-n-message]').textContent=s.message;
    find('[data-n-coverage]').textContent=`${s.cells_with_results} / ${s.total_cells} cells with results · ${s.queue_count} queued passes · ${s.failed_cells} cells with failed latest attempts. ${s.candidate_count} candidates within mapped land; ${s.priority_count} rain-and-evidence priorities among ${s.listed_candidate_count} retained candidates. Showing top ${s.candidates.length}.`;
    find('[data-n-errors]').textContent=[s.catalogue_error,s.weather_error,s.last_checked?'Catalogue checked '+new Date(s.last_checked).toLocaleString():'Catalogue not checked yet',s.weather_updated?'Weather refreshed '+new Date(s.weather_updated).toLocaleString():'Weather not retrieved yet'].filter(Boolean).join(' · ');
    find('[data-n-note]').textContent=s.coverage_note+' '+s.limitations+' Up to 20 candidates retained per cell for ranking; all detections remain in each saved scan.';
    const rainList=find('[data-n-weather]');rainList.replaceChildren();
    if(!s.weather_watch.length)rainList.textContent=s.weather_updated?'No available forecast crosses the rain-screening threshold. This does not establish low landslide risk.':'Weather has not been checked yet.';
    for(const cell of s.weather_watch.slice(0,10)){const b=document.createElement('button');b.type='button';b.textContent=`${cell.counties.join(' / ')} · ${number(cell.forecast.rain_24h_mm,'mm / 24 h')} · ${cell.status}`;b.onclick=()=>map.fitBounds([[cell.bbox[1],cell.bbox[0]],[cell.bbox[3],cell.bbox[2]]],{paddingTopLeft:[20,40],paddingBottomRight:[Math.min(panel.offsetWidth+36,window.innerWidth*.55),50],maxZoom:13});rainList.append(b);}
    const list=find('[data-n-candidates]');list.replaceChildren();
    if(!s.candidates.length)list.textContent='No national scan results yet. Unscanned areas are not classified as safe.';
    for(const p of s.candidates){
      const el=document.createElement('article');el.className='national-candidate';const title=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');
      title.textContent=p.priority;info.textContent=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)} · ${(p.area_m2/10000).toFixed(2)} ha\nImage ${p.image_date.slice(0,10)} · cell ${p.cell_id}\nRain: ${number(p.rain_24h_mm,'mm / 24 h')}; peak ${number(p.peak_hour_mm,'mm / hour')}; 48 h ${number(p.rain_48h_mm,'mm')}\nWind: ${number(p.wind_max_24h_kmh,'km/h')}; temperature ${number(p.temperature_min_24h_c,'°C')} to ${number(p.temperature_max_24h_c,'°C')}\nForecast: ${p.forecast_start||'unavailable'} → ${p.forecast_end||'unavailable'}\n${p.reasons.join('. ')}`;info.style.whiteSpace='pre-line';button.type='button';button.textContent='View candidate close-up ↗';button.onclick=()=>openCandidate(p);el.append(title,info,button);list.append(el);
    }
    const report=find('[data-n-report]');report.hidden=!s.last_report;if(s.last_report)report.href=`/api/national/report/${s.last_report}`;
    if(previewed&&!panel.hidden)draw();
  }
  async function poll(){try{render(await api('/api/national'));}catch(e){find('[data-n-message]').textContent=e.message;}}
  $('national-open').onclick=async()=>{
    panel.hidden=false;document.body.classList.add('national-open');
    try{plan=await api('/api/national/plan');const hours=plan.estimated_initial_hours;find('[data-n-estimate]').textContent=`${plan.total_cells} planning cells, 12 km scan squares. Initial pass estimate: ${hours[0]}–${hours[1]} hours on this Mac (extrapolated). ${plan.free_disk_gib} GiB free. ${plan.storage_note}`;await poll();}
    catch(e){find('[data-n-message]').textContent=e.message;}
  };
  find('[data-n-preview]').onclick=()=>{if(!state)return;previewed=true;draw();map.fitBounds([[21.8,118],[26.5,122.1]],{paddingTopLeft:[20,40],paddingBottomRight:[Math.min(panel.offsetWidth+36,window.innerWidth*.55),40]});find('[data-n-start]').disabled=false;};
  find('[data-n-start]').onclick=async()=>{if(!previewed||busy)return;busy=true;find('[data-n-start]').disabled=true;try{render(await api('/api/national',{enabled:!state.enabled}));}catch(e){find('[data-n-message]').textContent=e.message;}finally{busy=false;find('[data-n-start]').disabled=false;}};
  find('[data-n-close]').onclick=()=>{panel.hidden=true;document.body.classList.remove('national-open');hideLayers();restoreLocal();};
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;document.body.classList.remove('national-open');hideLayers();restoreLocal();}});
  setInterval(()=>{if(!panel.hidden)poll();},30000);
})();
