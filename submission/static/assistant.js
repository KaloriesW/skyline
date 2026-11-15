let assistantPlan=null,assistantBoundary=null,assistantPoll=null;
const assistantKey='terrain-watch-assistant-plan';
function assistantMessage(text){$('assistant-message').textContent=text;}
function clearAssistantBoundary(){if(assistantBoundary)map.removeLayer(assistantBoundary);assistantBoundary=null;}
function fitAssistantBoundary(){if(!assistantBoundary)return;const wide=window.innerWidth>650;map.fitBounds(assistantBoundary.getBounds(),{paddingTopLeft:wide?[375,55]:[30,55],paddingBottomRight:wide?[40,65]:[30,Math.round(window.innerHeight*.62)],maxZoom:13});}
function previewAssistant(p){
  if(p.state!=='weather_ready'){
    scanDisplay.reserve(p.id,p.job_id||null);
    if(!currentResult||currentResult.id!==p.job_id)clearDisplayedResult();
    $('lat').value=p.request.lat;$('lon').value=p.request.lon;$('width').value=p.request.width_km;$('preset').value='custom';drawArea();
    $('map-badge-text').textContent=`${p.area_name} · ${p.request.lat.toFixed(5)}, ${p.request.lon.toFixed(5)} · ${p.request.width_km} km · ${p.state==='awaiting_confirmation'?'Proposed boundary — not scanned yet':'Scan in progress — results pending'}`;
  }
  clearAssistantBoundary();const [w,s,e,n]=p.bbox;
  assistantBoundary=L.rectangle([[s,w],[n,e]],{color:'#92dce5',weight:2,dashArray:'7 5',fillOpacity:.025,interactive:false}).addTo(map);
  fitAssistantBoundary();
}
function renderAssistant(p){
  const previous=assistantPlan;
  assistantPlan=p;
  if(['awaiting_confirmation','running','reporting'].includes(p.state)){
    scanDisplay.reserve(p.id,p.job_id||null);
    if(!assistantBoundary||previous?.id!==p.id)previewAssistant(p);
  }else if(p.state==='completed'&&!$('assistant-drawer').hidden){scanDisplay.reserve(p.id,p.job_id);}else scanDisplay.release();
  sessionStorage.setItem(assistantKey,p.id);
  syncAssistantChat();
  $('assistant-weather').hidden=!p.weather&&!p.report?.weather;
  $('assistant-weather').innerHTML=weatherHTML(p.report?.weather||p.weather);
  $('assistant-place-choices').hidden=p.state!=='choose_location';
  if(p.state==='weather_ready'){
    $('assistant-plan').hidden=true;$('assistant-report').hidden=true;$('assistant-form').hidden=false;$('assistant-help').hidden=false;$('assistant-new').hidden=true;
    $('assistant-input').disabled=false;$('assistant-size').disabled=false;$('assistant-prepare').disabled=false;
    assistantMessage(p.area_name+' · Forecast ready. No satellite scan started.');return;
  }
  if(p.state==='choose_location'){renderPlaceChoices(p);return;}
  const pending=p.state==='awaiting_confirmation',active=['running','reporting'].includes(p.state);
  $('assistant-input').disabled=active;$('assistant-size').disabled=active;$('assistant-prepare').disabled=active;
  $('assistant-plan').hidden=p.state==='completed';
  $('assistant-form').hidden=p.state==='completed';$('assistant-help').hidden=p.state==='completed';$('assistant-new').hidden=p.state!=='completed';
  $('assistant-size').options[0].textContent=`Default for this place · ${p.default_width_km??p.request.width_km} km`;
  $('assistant-plan-name').textContent=p.area_name;
  $('assistant-scope').textContent=p.scope_note;
  $('assistant-plan-facts').textContent=`${p.request.width_km} × ${p.request.width_km} km (${(p.request.width_km**2).toLocaleString()} km²) · ${p.model_label} · image ${p.scene.date.slice(0,10)}`;
  $('assistant-eta').textContent=`Estimated scan: ${p.estimate.min_minutes}–${p.estimate.max_minutes} minutes`;
  $('assistant-estimate-note').textContent=p.estimate.basis+' '+p.estimate.note+' A brief report follows.';
  $('assistant-confirm').hidden=!pending;$('assistant-cancel').hidden=!pending;
  $('assistant-confirm').disabled=false;$('assistant-cancel').disabled=false;
  $('assistant-boundary').hidden=!(pending||active);
  $('assistant-scene-note').textContent=pending?p.scene_note:'';
  $('assistant-progress').hidden=!active;$('assistant-progress').value=p.state==='reporting'?100:(p.scan_progress||0);
  assistantMessage(p.message||'');
  $('assistant-report').hidden=p.state!=='completed';
  if(p.state==='completed'){
    const r=p.report;
    $('assistant-overview').textContent=r.overview;
    $('assistant-report-facts').textContent=`${p.area_name} · image ${r.acquired.slice(0,10)} · ${r.model}. ${r.count} suspected areas · ${r.both_checks_count} supported by both checks. Imagery coverage ${r.imagery_coverage_percent??'—'}%; usable land ${r.usable_percent}%; before/after coverage ${r.paired_clear_percent??'—'}%.`;
    $('assistant-report-source').textContent='Summary: '+r.narrative_source+(r.qwen_note?' · '+r.qwen_note:'');
    $('assistant-locations').innerHTML=r.priority_locations.length?r.priority_locations.map(row=>`<button class="assistant-location" data-location="${esc(row.id)}"><strong>Area ${esc(row.id)} · ${row.area_ha.toFixed(2)} ha <span>↗</span></strong><span class="coordinate">${row.latitude.toFixed(6)}, ${row.longitude.toFixed(6)}</span><small>${esc(row.review_priority)} · ${row.support_count}/2 supporting checks</small>${row.road_distance_m==null?'':`<small>${esc(row.nearest_road_name)} · ${Math.round(row.road_distance_m)} m from polygon</small>`}</button>`).join(''):'<p class="hint">No candidates passed the threshold. This does not establish that the area is landslide-free.</p>';
    for(const b of $('assistant-locations').querySelectorAll('button'))b.onclick=async()=>{
      if(currentResult?.id!==r.scan_id)await loadHistory(r.scan_id);
      resetReviewFilters();
      detections?.eachLayer(l=>{if(String(l.feature.properties.id)===b.dataset.location){map.fitBounds(l.getBounds(),{maxZoom:16,paddingTopLeft:[375,70],paddingBottomRight:[40,80]});l.openPopup();}});
    };
    $('assistant-ranking').textContent=r.ranking_method;
    $('assistant-limitations').textContent=r.limitations;
    $('assistant-report-download').href=`/api/assistant/plans/${p.id}/report`;
    $('assistant-csv').href=`/results/${r.scan_id}/coordinates.csv`;
    $('assistant-geojson').href=`/results/${r.scan_id}/detections.geojson`;
    clearAssistantBoundary();
  }
  if(!pending&&!active)clearAssistantBoundary();
}
function renderPlaceChoices(p){
  $('assistant-plan').hidden=true;$('assistant-report').hidden=true;$('assistant-form').hidden=false;
  $('assistant-input').disabled=false;$('assistant-size').disabled=false;$('assistant-prepare').disabled=false;
  $('assistant-help').hidden=false;$('assistant-new').hidden=true;assistantMessage(p.message);
  $('assistant-place-choices').innerHTML=p.candidates.map(c=>`<button class="assistant-location" data-place="${esc(c.id)}"><strong>${esc(c.label)} ↗</strong><span class="coordinate">${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}</span><small>${esc(c.kind)} · Use this location</small></button>`).join('');
  for(const b of $('assistant-place-choices').querySelectorAll('button'))b.onclick=async()=>{
    const buttons=$('assistant-place-choices').querySelectorAll('button');buttons.forEach(x=>x.disabled=true);
    $('assistant-prepare').disabled=true;$('assistant-input').disabled=true;$('assistant-size').disabled=true;assistantMessage('Preparing the selected location…');
    try{const next=await api(`/api/assistant/plans/${p.id}/location`,{candidate_id:b.dataset.place});
      if(next.state==='clarify'){assistantMessage(next.message);return;}
      renderAssistant(next);if(next.bbox)previewAssistant(next);
    }catch(e){assistantMessage(e.message);}finally{buttons.forEach(x=>x.disabled=false);$('assistant-prepare').disabled=false;$('assistant-input').disabled=false;$('assistant-size').disabled=false;}
  };
}

async function pollAssistant(){
  clearTimeout(assistantPoll);if(!assistantPlan)return;
  try{
    const p=await api('/api/assistant/plans/'+assistantPlan.id);renderAssistant(p);
    if(p.state==='completed'&&currentResult?.id!==p.job_id){await loadHistory(p.job_id);refreshHistory();fitAssistantResult();}
    if(['running','reporting'].includes(p.state))assistantPoll=setTimeout(pollAssistant,2000);
  }catch(e){assistantMessage(e.message+' Retrying status…');assistantPoll=setTimeout(pollAssistant,5000);}
}
function fitAssistantResult(){if(currentResult&&window.innerWidth>650)map.fitBounds(currentResult.overlay_bounds,{paddingTopLeft:[375,55],paddingBottomRight:[40,65]});}
$('ask-qwen').onclick=async()=>{
  stopComparison();
  $('assistant-drawer').hidden=false;document.body.classList.add('assistant-visible');$('result-drawer').hidden=true;
  try{const s=await api('/api/assistant/status');$('assistant-status').textContent=s.message+' · '+s.model;}catch(e){$('assistant-status').textContent=e.message;}
  if(['awaiting_confirmation','running','reporting'].includes(assistantPlan?.state))previewAssistant(assistantPlan);
  if(assistantPlan?.state==='completed'){scanDisplay.reserve(assistantPlan.id,assistantPlan.job_id);if(currentResult?.id!==assistantPlan.job_id)await loadHistory(assistantPlan.job_id);fitAssistantResult();}
  syncAssistantChat();
  if(!assistantPlan)$('assistant-input').focus();
};
$('close-assistant').onclick=()=>{$('assistant-drawer').hidden=true;document.body.classList.remove('assistant-visible');if(!['running','reporting'].includes(assistantPlan?.state)){clearAssistantBoundary();scanDisplay.release();}};
$('assistant-new').onclick=()=>{scanDisplay.release();$('assistant-size').value='';$('assistant-size').options[0].textContent='Automatic · based on requested place';$('assistant-form').hidden=false;$('assistant-help').hidden=false;$('assistant-new').hidden=true;$('assistant-input').focus();};
$('assistant-boundary').onclick=()=>previewAssistant(assistantPlan);
function invalidateAssistantInput(){
  $('assistant-size').options[0].textContent='Automatic · based on requested place';
  if(['awaiting_confirmation','choose_location'].includes(assistantPlan?.state)){
    $('assistant-confirm').disabled=true;$('assistant-place-choices').hidden=true;
    clearAssistantBoundary();assistantMessage('Request changed. Click Prepare scan to update the location, boundary and estimate.');
  }
}
$('assistant-input').oninput=invalidateAssistantInput;
$('assistant-size').onchange=invalidateAssistantInput;
$('assistant-form').onsubmit=async event=>{
  event.preventDefault();const message=$('assistant-input').value.trim();if(!message)return;
  $('assistant-prepare').disabled=true;$('assistant-input').disabled=true;$('assistant-size').disabled=true;assistantMessage('Preparing your request and fetching the relevant data…');
  try{
    if(['awaiting_confirmation','choose_location'].includes(assistantPlan?.state))await api(`/api/assistant/plans/${assistantPlan.id}/cancel`,{});
    clearAssistantBoundary();clearTimeout(assistantPoll);assistantPlan=null;sessionStorage.removeItem(assistantKey);
    $('assistant-plan').hidden=true;$('assistant-report').hidden=true;$('assistant-place-choices').hidden=true;$('assistant-weather').hidden=true;
    const p=await api('/api/assistant/plans',{message,...getArea(),proposed_width_km:$('assistant-size').value?Number($('assistant-size').value):null});
    if(p.state==='clarify'){assistantMessage(p.message);return;}
    renderAssistant(p);if(p.bbox)previewAssistant(p);
  }catch(e){assistantMessage(e.message);}finally{$('assistant-prepare').disabled=false;$('assistant-input').disabled=false;$('assistant-size').disabled=false;}
};
$('assistant-confirm').onclick=async()=>{
  $('assistant-confirm').disabled=true;$('assistant-cancel').disabled=true;assistantMessage('Starting the approved area…');
  try{const p=await api(`/api/assistant/plans/${assistantPlan.id}/start`,{confirm:true});renderAssistant(p);previewAssistant(p);pollAssistant();}
  catch(e){assistantMessage(e.message);$('assistant-confirm').disabled=false;$('assistant-cancel').disabled=false;}
};
$('assistant-cancel').onclick=async()=>{
  try{renderAssistant(await api(`/api/assistant/plans/${assistantPlan.id}/cancel`,{}));}catch(e){assistantMessage(e.message);}
};
async function restoreAssistant(){
  const id=sessionStorage.getItem(assistantKey);if(!id)return;
  try{const p=await api('/api/assistant/plans/'+id);if(['cancelled','interrupted','failed'].includes(p.state)){sessionStorage.removeItem(assistantKey);return;}renderAssistant(p);$('assistant-input').value=p.user_request;$('assistant-size').value=p.size_override?String(p.size_override):'';if(['running','reporting'].includes(p.state)){ $('assistant-drawer').hidden=false;document.body.classList.add('assistant-visible');pollAssistant(); }else if(p.state==='completed'&&!$('assistant-drawer').hidden){await loadHistory(p.job_id);} }catch(e){sessionStorage.removeItem(assistantKey);}
}
restoreAssistant();

let assistantChatScope=null,assistantChatKey=null,assistantChatRevision=0,assistantChatBusy=false;
function renderChatMessages(messages){
  const log=$('assistant-chat-messages');log.replaceChildren();
  for(const turn of messages){
    const bubble=document.createElement('div');bubble.className='chat-turn '+turn.role;
    const label=document.createElement('strong');label.textContent=turn.role==='user'?'You':(turn.source||'Qwen');
    const text=document.createElement('p');text.textContent=turn.content;
    bubble.append(label,text);log.append(bubble);
  }
  log.scrollTop=log.scrollHeight;
}
function chatQuery(scope){return new URLSearchParams(scope).toString();}
async function syncAssistantChat(useScan=false){
  const scope=useScan&&currentResult?{scan_id:currentResult.id}:assistantPlan?{plan_id:assistantPlan.id}:currentResult?{scan_id:currentResult.id}:{};
  const key=chatQuery(scope);
  $('assistant-chat-use-scan').hidden=!currentResult||scope.scan_id===currentResult.id||assistantPlan?.job_id===currentResult.id;
  $('assistant-chat-context').textContent=scope.plan_id?'About: '+(assistantPlan.area_name||assistantPlan.user_request):scope.scan_id?`Displayed scan · ${currentResult.acquired.slice(0,10)} · ${currentResult.count} candidates`:'General questions · no scan selected';
  if(key===assistantChatKey)return;
  assistantChatKey=key;assistantChatScope=scope;const revision=++assistantChatRevision;
  renderChatMessages([]);$('assistant-chat-status').textContent='Loading conversation…';
  try{
    const conversation=await api('/api/assistant/chat'+(key?'?'+key:''));
    if(revision!==assistantChatRevision)return;
    renderChatMessages(conversation.messages);$('assistant-chat-status').textContent='';
  }catch(e){if(revision===assistantChatRevision)$('assistant-chat-status').textContent=e.message;}
}
$('assistant-chat-use-scan').onclick=()=>syncAssistantChat(true);
$('assistant-chat-form').onsubmit=async event=>{
  event.preventDefault();if(assistantChatBusy)return;
  const input=$('assistant-chat-input'),message=input.value.trim();if(!message)return;
  if(assistantChatScope===null)await syncAssistantChat();
  const key=assistantChatKey,scope={...assistantChatScope};
  assistantChatBusy=true;input.disabled=true;$('assistant-chat-send').disabled=true;
  $('assistant-chat-status').textContent='Qwen is reading the results and your recent questions…';
  try{
    const conversation=await api('/api/assistant/chat',{...scope,message});
    if(key!==assistantChatKey)return;
    ++assistantChatRevision;renderChatMessages(conversation.messages);input.value='';
    $('assistant-chat-status').textContent='Answered locally · '+conversation.model;
  }catch(e){if(key===assistantChatKey)$('assistant-chat-status').textContent=e.message+' Your question is kept so you can retry.';}
  finally{assistantChatBusy=false;input.disabled=false;$('assistant-chat-send').disabled=false;}
};
