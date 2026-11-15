const $=id=>document.getElementById(id);
const map=L.map('map',{zoomControl:false}).setView([23.7,121],7);
map.createPane('satellitePane').style.zIndex=300;
const base=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});
base.addTo(map);
map.attributionControl.addAttribution('Copernicus Sentinel data / DEM · Earth Search');
L.control.zoom({position:'topright'}).addTo(map);
const layers=L.control.layers({'OpenStreetMap':base},{},{collapsed:true}).addTo(map);
L.control.scale({imperial:false}).addTo(map);
let preferredModel=null;
let watchInitialized=false;
let evidenceLayers={};
let area,imagery,excluded,detections,markers,sceneArea=null,currentJob=null,currentResult=null,watchEnabled=false,lastAutoResult=null;
function recentDates(){const now=new Date(),start=new Date(now);start.setUTCDate(start.getUTCDate()-30);$('start').value=start.toISOString().slice(0,10);$('end').value=now.toISOString().slice(0,10);}
recentDates();
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('toggle-results').onclick=()=>{$('result-drawer').hidden=!$('result-drawer').hidden;};
$('close-results').onclick=()=>{$('result-drawer').hidden=true;};
const error=m=>{$('error').hidden=!m;$('error').textContent=m||'';};
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(typeof data.detail==='string'?data.detail:JSON.stringify(data.detail||data));return data;}
function getArea(){const a={lat:Number($('lat').value),lon:Number($('lon').value),width_km:Number($('width').value)};if(a.lat<21.8||a.lat>26.5||a.lon<118.0||a.lon>122.1)throw Error('Select a location within Taiwan’s map bounds.');return a;}
function areaBounds(a){const dy=a.width_km/2/111.32,dx=dy/Math.cos(a.lat*Math.PI/180);return [[a.lat-dy,a.lon-dx],[a.lat+dy,a.lon+dx]];}
function drawArea(fit=false){try{const a=getArea();if(area)map.removeLayer(area);area=L.rectangle(areaBounds(a),{color:'#315e4e',weight:2,dashArray:'6 5',fillOpacity:0.02}).addTo(map);if(fit)map.fitBounds(area.getBounds(),{paddingTopLeft:[300,40],paddingBottomRight:[50,60],maxZoom:13});if(sceneArea&&JSON.stringify(a)!==JSON.stringify(sceneArea)){$('scene').disabled=true;$('scan').disabled=true;$('search-status').textContent='Area changed. Find scenes for the new location.';$('image-options').open=true;}}catch(e){error(e.message);}}
for(const id of ['lat','lon','width'])$(id).addEventListener('change',()=>drawArea(true));
$('preset').addEventListener('change',()=>{if($('preset').value!=='custom'){const [lat,lon]=$('preset').value.split(',');$('lat').value=lat;$('lon').value=lon;drawArea(true);}});
map.on('click',e=>{if(e.latlng.lat<21.8||e.latlng.lat>26.5||e.latlng.lng<118.0||e.latlng.lng>122.1)return;$('lat').value=e.latlng.lat.toFixed(4);$('lon').value=e.latlng.lng.toFixed(4);$('preset').value='custom';drawArea();});
$('overview').onclick=()=>map.fitBounds([[21.8,118],[26.5,122.1]]);
$('fit').onclick=()=>{if(currentResult)map.fitBounds(currentResult.overlay_bounds,{paddingTopLeft:[300,40],paddingBottomRight:[50,60]});else map.fitBounds(area.getBounds(),{padding:[40,40]});};
$('confidence').oninput=()=>{$('confidence-value').textContent=Number($('confidence').value).toFixed(3);};
let modelOptions=[];
function modelConfidence(){const model=modelOptions.find(m=>m.id===$('model').value);if(model){$('confidence').value=model.confidence;$('confidence').oninput();$('model-note').textContent=model.id==='unet13'?'U-Net · 11 satellite bands + slope + elevation. Native 128 px windows; score is not calibrated risk.':'YOLO · RGB satellite segmentation. Score is not calibrated risk.';}}
$('model').onchange=modelConfidence;
async function refreshModels(){try{const old=$('model').value;const models=await api('/api/models');modelOptions=models;$('model').innerHTML=models.map(m=>`<option value="${m.id}" ${m.available?'':'disabled'}>${esc(m.label)}${m.available?'':' · '+esc(m.state)}</option>`).join('');const preferred=models.find(m=>m.preferred&&m.available);if(preferred&&preferred.id!==preferredModel){$('model').value=preferred.id;preferredModel=preferred.id;modelConfidence();}else if(models.some(m=>m.id===old&&m.available))$('model').value=old;}catch(e){error(e.message);}}
$('search').onclick=async()=>{error('');$('search').disabled=true;$('scan').disabled=true;$('scene').disabled=true;$('search-status').textContent='Searching the free satellite catalogue…';try{sceneArea=getArea();const r=await api('/api/scenes',{...sceneArea,start:$('start').value,end:$('end').value,cloud:Number($('cloud').value)});$('scene').innerHTML=r.scenes.length?r.scenes.map(s=>`<option value="${esc(s.id)}">${s.date.slice(0,10)} · ${s.cloud.toFixed(0)}% scene clouds</option>`).join(''):'<option>No scenes found</option>';$('scene').disabled=!r.scenes.length;$('scan').disabled=!r.scenes.length||!!currentJob;$('search-status').textContent=`${r.scenes.length} scenes found · clearest scene first. Cloud percentage covers the full satellite tile.`;}catch(e){error(e.message);$('search-status').textContent='Search failed. Change the dates or retry.';}finally{$('search').disabled=false;}};
$('recent').onclick=()=>{recentDates();$('image-options').open=true;$('search').click();};
function progress(job){$('progress-wrap').hidden=false;$('progress').style.width=job.progress+'%';$('scan-status').textContent=job.message;}
async function pollJob(id){try{const job=await api('/api/scans/'+id);progress(job);if(job.state==='completed'){currentJob=null;$('scan').disabled=$('scene').disabled;showResult(job.result);refreshHistory();return;}if(job.state==='failed')throw Error(job.message);setTimeout(()=>pollJob(id),1800);}catch(e){currentJob=null;$('scan').disabled=$('scene').disabled;error(e.message);$('scan-status').textContent='Scan failed. Try another image.';}}
$('scan').onclick=async()=>{error('');$('scan').disabled=true;try{const j=await api('/api/scans',{...getArea(),scene_id:$('scene').value,model:$('model').value,confidence:Number($('confidence').value)});currentJob=j.id;progress(j);pollJob(j.id);}catch(e){error(e.message);$('scan').disabled=false;}};
function drop(layer){if(layer){map.removeLayer(layer);layers.removeLayer(layer);}}
function evidenceText(p){
  const status=s=>s==='supports'?'supports':s==='not_supported'?'not supported':'unavailable';
  if(!p.vegetation_check)return 'Evidence not calculated. Rescan this scene.';
  const n=(v,d=2)=>v==null?'—':Number(v).toFixed(d);
  return `Vegetation loss: ${status(p.vegetation_check)}<br>NDVI ${n(p.ndvi_before)} → ${n(p.ndvi_after)} · drop ${n(p.ndvi_drop)}<br>Loss pixels: ${n(p.vegetation_loss_percent,1)}% · paired coverage ${n(p.paired_clear_percent,1)}%<br>Slope: ${n(p.slope_median_deg,1)}° · ${status(p.slope_check)}<br>Before: ${esc(p.before_acquired?.slice(0,10)||'unavailable')}`;
}
function showEvidence(r){
  for(const layer of Object.values(evidenceLayers))drop(layer);
  evidenceLayers={};const e=r.evidence;
  const options=[['after','After image']];
  if(e){
    for(const [key,file,label,bounds] of [
      ['before','before.png','Before image',e.before_overlay_bounds],
      ['vegetation','vegetation.png','Vegetation loss (NDVI)',e.vegetation_overlay_bounds],
      ['slope','slope.png','Terrain slope',e.slope_overlay_bounds]]){
      if(bounds){evidenceLayers[key]=L.imageOverlay(`/results/${r.id}/${file}`,bounds,{opacity:1,pane:'satellitePane'});options.push([key,label]);}
    }
    $('evidence-note').textContent=`Before: ${e.before?.date.slice(0,10)||'unavailable'} → after: ${r.acquired.slice(0,10)}. ${e.both_support_count??0}/${r.count} candidates supported by both checks. ${e.paired_clear_percent??0}% paired clear coverage across this area. ${(e.warnings||[]).join(' ')}`;
  }else $('evidence-note').textContent='This saved scan predates the checks. Scan image again to calculate them.';
  $('evidence-view').innerHTML=options.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
  $('evidence-legend').textContent='After image · acquisition date shown on the map.';
}
$('evidence-view').onchange=()=>{
  stopComparison(false);
  for(const layer of Object.values(evidenceLayers))map.removeLayer(layer);
  const key=$('evidence-view').value;
  if(key==='after')imagery.addTo(map);else{map.removeLayer(imagery);evidenceLayers[key]?.addTo(map);}
  $('evidence-legend').textContent={after:'After image · 10 m RGB.',before:'Before image · compare the same location across dates.',vegetation:'Green: gain/no loss. Orange → red: increasing NDVI drop (0–0.5). Transparent: no valid pair.',slope:'Blue → orange: increasing slope (0–60°). Source resolution: 30 m; a surface model, not current bare-earth terrain.'}[key];
  const e=currentResult.evidence;
  $('map-badge-text').textContent=key==='before'?`Before · ${e.before.date.slice(0,10)} · 10 m imagery`:key==='after'?`${currentResult.acquired.slice(0,10)} · ${currentResult.model} · 10 m imagery`:key==='vegetation'?`NDVI drop · ${e.before.date.slice(0,10)} → ${currentResult.acquired.slice(0,10)}`:'Terrain slope · Copernicus DEM · 30 m';
  detections?.bringToFront();
};
function candidatePopup(p){return `<b>Suspected area ${p.id}</b><br>${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}<br>Footprint: ${(p.area_m2/10000).toFixed(2)} ha<br>Model score: ${p.confidence.toFixed(2)}<br>Acquired: ${esc(p.acquired.slice(0,10))}<hr>${evidenceText(p)}<hr>${roadText(p)}<hr>${candidateWeather(p)}<br><button class="text-button popup-compare" ${hasComparison()?'':'disabled'}>Compare before / after ↔</button><br><a href="https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}" target="_blank" rel="noopener">Open location ↗</a>`;}
function renderCandidates(){
  if(!currentResult)return;
  const features=visibleCandidates();
  if($('candidate-order').value==='road')features.sort((a,b)=>(a.properties.road_distance_m??Infinity)-(b.properties.road_distance_m??Infinity)||a.properties.id-b.properties.id);
  $('detections').innerHTML=features.length?features.map(f=>{const p=f.properties;return `<tr><td>${String(p.id).padStart(2,'0')}</td><td>${p.latitude.toFixed(6)}</td><td>${p.longitude.toFixed(6)}</td><td>${(p.area_m2/10000).toFixed(2)} ha</td><td><span class="score">${p.confidence.toFixed(2)}</span><details><summary>Evidence</summary>${evidenceText(p)}</details></td><td>${roadText(p)}</td><td><button class="text-button locate" data-id="${p.id}">Locate ↗</button><button class="text-button candidate-compare" data-id="${p.id}" ${hasComparison()?'':'disabled'}>Compare ↔</button></td></tr>`;}).join(''):'<tr><td colspan="7" class="empty">No candidates match these filters. Reset filters to review the full scan.</td></tr>';
  for(const b of document.querySelectorAll('.locate'))b.onclick=()=>detections.eachLayer(l=>{if(l.feature.properties.id===Number(b.dataset.id)){map.fitBounds(l.getBounds(),{maxZoom:16,paddingTopLeft:[300,50],paddingBottomRight:[50,60]});l.openPopup();$('result-drawer').hidden=true;}});
  for(const b of document.querySelectorAll('.candidate-compare'))b.onclick=()=>startComparison(b.dataset.id);
}
$('candidate-order').onchange=renderCandidates;
function showResult(r){
  stopComparison(false);currentResult=r;
  $('lat').value=r.center[0];$('lon').value=r.center[1];$('width').value=r.width_km;
  const preset=[...$('preset').options].find(o=>o.value!=='custom'&&o.value.split(',').map(Number).every((v,i)=>Math.abs(v-r.center[i])<.00001));
  $('preset').value=preset?preset.value:'custom';sceneArea=getArea();drawArea();
  if(![...$('scene').options].some(o=>o.value===r.scene_id))$('scene').innerHTML=`<option value="${esc(r.scene_id)}">${r.acquired.slice(0,10)} · saved scan scene</option>`;
  $('scene').value=r.scene_id;$('scene').disabled=false;$('scan').disabled=!!currentJob;
  drop(imagery);drop(excluded);drop(detections);drop(markers);
  imagery=L.imageOverlay(`/results/${r.id}/satellite.png`,r.overlay_bounds,{opacity:1,pane:'satellitePane'}).addTo(map);
  excluded=L.imageOverlay(`/results/${r.id}/excluded.png`,r.overlay_bounds,{opacity:.25,pane:'satellitePane'});layers.addOverlay(imagery,'Sentinel-2 imagery');showEvidence(r);layers.addOverlay(excluded,'Excluded pixels');
  createDetectionLayers(true);
  showReview(r);showWeatherResult(r);renderCandidates();map.fitBounds(r.overlay_bounds,{paddingTopLeft:[300,40],paddingBottomRight:[50,60]});
  updateFilterSummary();$('usable').textContent=r.usable_percent+'%';
  $('coverage').textContent=r.imagery_coverage_percent==null?'Saved single-tile scan':`${r.source_tiles?.length||1} satellite tile${(r.source_tiles?.length||1)===1?'':'s'} · ${r.imagery_coverage_percent}% imagery coverage${r.coverage_warning?' · some pixels unassessed':''}`;
  $('acquired').textContent=r.acquired.slice(0,10);$('map-title').textContent='Taiwan · satellite observation';$('map-badge-text').textContent=`${r.acquired.slice(0,10)} · ${r.model} · 10 m imagery`;
  $('result-note').textContent=`${r.model} · threshold ${r.confidence_threshold.toFixed(3)} · ${r.tiles_analyzed} tiles analyzed. ${r.count?'Review each candidate against the imagery.':'No candidates passed the threshold; this is not evidence that no landslides exist.'} Confidence is a model score, not a calibrated probability.`;
  $('mask-download').hidden=r.model_id!=='unet13';$('mask-download').href=`/results/${r.id}/segmentation.tif`;$('downloads').hidden=false;$('csv').href=`/results/${r.id}/coordinates.csv`;$('geojson').href=`/results/${r.id}/detections.geojson`;
}
async function loadHistory(id){error('');try{const j=await api('/api/scans/'+id);showResult(j.result);}catch(e){error(e.message);}}
async function refreshHistory(loadLatest=false){try{const rows=await api('/api/history');$('history').innerHTML=rows.length?rows.map(r=>`<button class="history-item" data-id="${r.id}">${r.acquired.slice(0,10)} · ${esc(r.model)} · ${r.count} candidates</button>`).join(''):'No completed scans yet.';for(const b of document.querySelectorAll('.history-item'))b.onclick=()=>loadHistory(b.dataset.id);if(loadLatest&&!new URLSearchParams(location.search).has('selection')){const scan=new URLSearchParams(location.search).get('scan');if(scan&&/^[a-f0-9]{32}$/.test(scan))loadHistory(scan);else if(rows.length)loadHistory(rows[0].id);}}catch(e){console.warn(e);}}
async function refreshWatch(){
  try{
    const w=await api('/api/watch');watchEnabled=w.enabled;
    $('watch').innerHTML=w.enabled?'Stop monitoring <span>◼</span>':'Start monitoring <span>◉</span>';
    $('check-now').hidden=!w.enabled;
    $('check-now').disabled=!!w.active_job;
    const time=t=>new Date(t).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const next=w.next_check?time(w.next_check*1000):'shortly';
    $('watch-status').textContent=w.enabled
      ?`${w.message || 'Monitoring active.'} Watching ${w.lat.toFixed(4)}, ${w.lon.toFixed(4)} · ${w.width_km} km. Last check: ${w.last_checked?time(w.last_checked):'pending'} · next: ${next}. Keep this Mac awake.`
      :'Free imagery · hourly checks when enabled. New captures are typically days apart.';
    // Initial page load already restores the newest saved result. An older
    // monitor result must not replace a newer manual scan during that load.
    if(!watchInitialized){watchInitialized=true;lastAutoResult=w.last_result||null;return;}
    if(w.last_result&&w.last_result!==lastAutoResult){lastAutoResult=w.last_result;refreshHistory();if(!currentJob)loadHistory(w.last_result);}
  }catch(e){$('watch-status').textContent='Cannot reach the local server. Automatic checks require it to be running.';}
}
$('check-now').onclick=async()=>{error('');$('check-now').disabled=true;try{await api('/api/watch/check',{});await refreshWatch();}catch(e){error(e.message);}finally{$('check-now').disabled=false;}};
$('watch').onclick=async()=>{error('');$('watch').disabled=true;try{await api('/api/watch',{...getArea(),enabled:!watchEnabled,model:$('model').value,confidence:Number($('confidence').value)});await refreshWatch();}catch(e){error(e.message);}finally{$('watch').disabled=false;}};
drawArea(true);refreshModels();refreshHistory(true);refreshWatch();setInterval(refreshModels,60000);setInterval(refreshWatch,15000);

function filterSettings(){return {vegetation:$('filter-vegetation').checked,road:$('filter-road').checked,minArea:Number($('filter-size').value)};}
function visibleCandidates(){return ReviewFilters.select(currentResult?.geojson.features||[],filterSettings());}
function updateFilterSummary(){
  if(!currentResult)return;
  const shown=visibleCandidates().length,total=currentResult.geojson.features.length;
  $('count').textContent=shown===total?String(total):`${shown} / ${total}`;
  $('filter-summary').textContent=`Showing ${shown} of ${total} candidates. ${total-shown} hidden by review filters.`;
  const f=filterSettings();$('filter-badge').textContent=(f.vegetation||f.road||f.minArea)?'· active':'';
}
function createDetectionLayers(forceVisible=false){
  const onMap=forceVisible||!detections||map.hasLayer(detections);
  drop(detections);drop(markers);
  const features=visibleCandidates();
  detections=L.geoJSON({type:'FeatureCollection',features},{style:{bubblingMouseEvents:false,color:'#ff733e',weight:2,fillColor:'#ff8b55',fillOpacity:.22},onEachFeature:(f,l)=>{
    l.bindPopup(()=>candidatePopup(f.properties));l.on('popupopen',e=>{const b=e.popup.getElement().querySelector('.popup-compare');if(b)b.onclick=()=>startComparison(String(f.properties.id));});
  }});if(onMap)detections.addTo(map);layers.addOverlay(detections,'Suspected landslides');
  markers=L.layerGroup(features.map(f=>L.circleMarker([f.properties.latitude,f.properties.longitude],{interactive:false,radius:3,color:'#fff',weight:1,fillColor:'#e97041',fillOpacity:1})));
  if(onMap)markers.addTo(map);
  const selected=$('compare-candidate').value;
  $('compare-candidate').innerHTML='<option value="all">Whole scanned area</option>'+features.map(f=>`<option value="${f.properties.id}">Area ${f.properties.id} · ${(f.properties.area_m2/10000).toFixed(2)} ha</option>`).join('');
  $('compare-candidate').value=features.some(f=>String(f.properties.id)===selected)?selected:'all';
}
function applyReviewFilters(){if(!currentResult)return;map.closePopup();createDetectionLayers();renderCandidates();updateFilterSummary();if(comparisonActive)comparisonDetails();}
function resetReviewFilters(){for(const id of ['filter-vegetation','filter-road'])$(id).checked=false;$('filter-size').value='0';applyReviewFilters();}
for(const id of ['filter-vegetation','filter-road','filter-size'])$(id).addEventListener('change',applyReviewFilters);
$('reset-filters').onclick=resetReviewFilters;
if(new URLSearchParams(location.search).has('selection')){
  const params=new URLSearchParams(location.search),lat=Number(params.get('lat')),lon=Number(params.get('lon')),width=Number(params.get('width_km'));
  if(lat>=21.8&&lat<=26.5&&lon>=118&&lon<=122.1&&width>=2&&width<=60){
    $('lat').value=lat;$('lon').value=lon;$('width').value=width;$('preset').value='custom';drawArea(true);
  }
}
