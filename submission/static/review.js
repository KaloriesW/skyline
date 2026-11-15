// The before image uses the same projected raster grid as the after image.
let comparisonActive=false,roadLayer=null;
function hasComparison(){return !!(currentResult?.evidence?.before_overlay_bounds&&currentResult?.evidence?.before?.date);}
function roadText(p){
  if(p.road_proximity_status==='available')return `${esc(p.nearest_road_name)}${p.nearest_road_ref&&p.nearest_road_ref!==p.nearest_road_name?' · '+esc(p.nearest_road_ref):''}<br><strong>${p.road_distance_m<1?'~0 m from polygon':Math.round(p.road_distance_m).toLocaleString()+' m from polygon'}</strong> · ${esc(p.nearest_road_type)}<br><a href="https://www.openstreetmap.org/way/${Number(p.nearest_road_osm_id)}" target="_blank" rel="noopener">Road on OSM ↗</a>`;
  if(p.road_proximity_status==='not_found')return 'No mapped road found within 2 km';
  return p.road_proximity_status==='unavailable'?'Road data unavailable':'Roads not checked yet';
}
function showReview(r){
  drop(roadLayer);roadLayer=null;
  const roads=r.roads;
  if(roads?.geojson?.features?.length){
    roadLayer=L.geoJSON(roads.geojson,{style:{color:'#82d9e8',weight:3,opacity:.9},onEachFeature:(f,l)=>l.bindPopup(`<b>${esc(f.properties.name)}</b><br>${esc(f.properties.highway)} · mapped road<br>Current condition and access unknown.`)}).addTo(map);layers.addOverlay(roadLayer,'Nearby mapped roads');detections?.bringToFront();
  }
  $('roads-note').textContent=roads?.status==='available'?`${roads.near_count} candidates within ${roads.near_threshold_m} m of a mapped road. Road data retrieved ${new Date(roads.fetched_at).toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'})}; imagery ${r.acquired.slice(0,10)}.`:roads?.message||'Road proximity has not been calculated for this saved scan.';
  $('check-roads').hidden=['available','not_needed'].includes(roads?.status);$('check-roads').disabled=false;
  $('compare-images').disabled=!hasComparison();
  $('comparison-availability').textContent=hasComparison()?`${r.evidence.before.date.slice(0,10)} → ${r.acquired.slice(0,10)}`:'No aligned earlier image available for this scan.';
  $('compare-candidate').innerHTML='<option value="all">Whole scanned area</option>'+visibleCandidates().map(f=>`<option value="${f.properties.id}">Area ${f.properties.id} · ${(f.properties.area_m2/10000).toFixed(2)} ha</option>`).join('');
}
function updateComparisonClip(){
  if(!comparisonActive)return;
  const element=evidenceLayers.before?.getElement();if(!element)return;
  const rect=element.getBoundingClientRect(),mapRect=map.getContainer().getBoundingClientRect();
  const left=window.innerWidth>650?300:0;
  const split=mapRect.left+left+(mapRect.width-left)*Number($('compare-position').value)/100;
  const right=Math.max(0,Math.min(rect.width,rect.right-split));
  // Rect width can be temporarily CSS-scaled during Leaflet's zoom animation.
  element.style.clipPath=`inset(0 ${rect.width?right/rect.width*100:0}% 0 0)`;
  element.style.backgroundColor='#18201d';
  $('compare-divider').style.left=(split-mapRect.left)+'px';
}
function comparisonDetails(){
  const p=currentResult?.geojson.features.find(f=>String(f.properties.id)===$('compare-candidate').value)?.properties;
  if(!p){$('compare-evidence').textContent=`Whole area · ${currentResult.evidence.paired_clear_percent??0}% paired clear coverage. Orange outlines show after-image candidates; cyan lines show nearby mapped roads.`;return;}
  const n=(v,d=2)=>v==null?'unavailable':Number(v).toFixed(d);
  const road=p.road_distance_m==null?(p.road_proximity_status==='not_found'?'No mapped road within 2 km':'Roads unavailable / not checked'):`${p.nearest_road_name} · ${Math.round(p.road_distance_m)} m from polygon`;
  $('compare-evidence').textContent=`${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)} · NDVI ${n(p.ndvi_before)} → ${n(p.ndvi_after)} · loss pixels ${n(p.vegetation_loss_percent,1)}% · paired clear ${n(p.paired_clear_percent,1)}% · slope ${n(p.slope_median_deg,1)}°. ${road}.`;
}
function fitComparisonCandidate(){
  const padding=window.innerWidth>650?[300,45]:[25,45];
  if($('compare-candidate').value==='all')map.fitBounds(currentResult.overlay_bounds,{paddingTopLeft:padding,paddingBottomRight:[45,250]});
  else detections?.eachLayer(l=>{if(String(l.feature.properties.id)===$('compare-candidate').value)map.fitBounds(l.getBounds().pad(.5),{maxZoom:16,paddingTopLeft:padding,paddingBottomRight:[45,250]});});
  comparisonDetails();
}
function startComparison(id='all'){
  setWeatherVisible(false);
  if(!hasComparison())return;
  $('result-drawer').hidden=true;$('assistant-drawer').hidden=true;document.body.classList.remove('assistant-visible');
  if(typeof clearAssistantBoundary==='function')clearAssistantBoundary();map.closePopup();
  for(const layer of Object.values(evidenceLayers))map.removeLayer(layer);map.removeLayer(excluded);
  imagery.addTo(map);evidenceLayers.before.addTo(map).bringToFront();
  comparisonActive=true;document.body.classList.add('comparing');$('compare-toolbar').hidden=false;$('compare-divider').hidden=false;
  $('compare-before-date').textContent='Before · '+currentResult.evidence.before.date.slice(0,10);
  $('compare-after-date').textContent='After · '+currentResult.acquired.slice(0,10);
  $('compare-candidate').value=String(id);$('compare-position').value=50;
  evidenceLayers.before.off('load',updateComparisonClip).on('load',updateComparisonClip);
  evidenceLayers.before.once('error',()=>{stopComparison();error('Earlier image could not load. Reload the scan or try another acquisition.');});
  fitComparisonCandidate();updateComparisonClip();detections?.bringToFront();roadLayer?.bringToFront();
  $('map-badge-text').textContent='Before / after · orange: after-image candidates';
}
function stopComparison(restore=true){
  if(!comparisonActive)return;
  comparisonActive=false;document.body.classList.remove('comparing');$('compare-toolbar').hidden=true;$('compare-divider').hidden=true;
  const before=evidenceLayers.before;if(before){const el=before.getElement();if(el){el.style.clipPath='';el.style.backgroundColor='';}map.removeLayer(before);}
  if(restore&&imagery){imagery.addTo(map);$('evidence-view').value='after';$('map-badge-text').textContent=`${currentResult.acquired.slice(0,10)} · ${currentResult.model} · 10 m imagery`;$('evidence-legend').textContent='After image · 10 m RGB.';}
}
map.on('move zoom resize zoomend moveend',updateComparisonClip);
$('compare-images').onclick=()=>startComparison();$('close-compare').onclick=()=>stopComparison();
$('compare-position').oninput=updateComparisonClip;$('compare-candidate').onchange=fitComparisonCandidate;
$('check-roads').onclick=async()=>{
  if(!currentResult)return;const id=currentResult.id,bounds=map.getBounds();$('check-roads').disabled=true;$('roads-note').textContent='Finding nearby mapped roads…';
  try{const r=await api(`/api/scans/${id}/roads`,{});if(currentResult?.id!==id)return;showResult(r);map.fitBounds(bounds);$('roads-panel').open=true;}
  catch(e){if(currentResult?.id===id)$('roads-note').textContent=e.message;}
  finally{$('check-roads').disabled=false;}
};
