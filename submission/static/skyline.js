/* Skyline city forecasts share this server and map; no second API service. */
(() => {
  let cities=[],selectedAir=null;
  WorkspaceQwen.mount({reviewAreas:()=>currentResult?.geojson.features||[],viewArea:focusReviewArea,context:()=>({lat:getArea().lat,lon:getArea().lon,location_name:'Map selection',scan_id:currentResult?.id||null,dashboard_snapshot:JSON.stringify({model:currentResult?.model,weather:currentResult?.weather?.summary,selected_city_air:selectedAir,weather_layer:weatherData?{forecast_start:weatherData.forecast_start,forecast_end:weatherData.forecast_end}:null})})});
  async function loadCity(){
    const city=cities.find(c=>c.id===$('skyline-city').value);if(!city)return;
    $('skyline-load').disabled=true;$('skyline-air').textContent='Loading '+city.name+'…';
    try{
      const response=await fetch(`/api/predict?lat=${city.lat}&lon=${city.lon}`),d=await response.json();
      if(!response.ok)throw Error(d.error||'Forecast unavailable');
      const stale=response.headers.get('X-Skyline-Stale');selectedAir={...d,stale:!!stale};
      $('skyline-air').innerHTML=`<p>${esc(d.city?.name||city.name)} · ${esc(d.date)}</p><strong>${Number(d.pm25).toFixed(1)}</strong> µg/m³ PM2.5<p>${esc(d.category)} · forecast AQI ${esc(d.aqi)}</p><p>${esc(d.model?.kind||'Skyline city model')}${stale?' · cached; refresh failed':''}</p><a href="/skyline/">Full weather dashboard ↗</a>`;
    }catch(e){$('skyline-air').textContent=e.message;}
    finally{$('skyline-load').disabled=false;}
  }
  async function typhoon(){
    $('skyline-typhoon').textContent='Checking CWA typhoon feed…';
    try{const d=await api('/api/typhoon');$('skyline-typhoon').textContent=(d.active?'CWA reports active typhoon information. Open Skyline for the bulletin.':'CWA feed: no active typhoon bulletin reported.')+(d.updated?' Bulletin updated '+d.updated+'.':'')+(d.stale?' Cached data; refresh failed.':'');}
    catch(e){$('skyline-typhoon').textContent='CWA typhoon feed unavailable. Open the weather dashboard to retry.';}
  }
  api('/api/model/cities').then(d=>{
    cities=d.cities.filter(c=>c.has_model);$('skyline-city').innerHTML=cities.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} ${esc(c.name_zh)}</option>`).join('');
    const cityLayer=L.layerGroup(cities.map(c=>L.circleMarker([c.lat,c.lon],{radius:5,color:'#b0d9e2',weight:1,fillColor:'#397688',fillOpacity:.8}).bindTooltip(c.name+' · city forecast').on('click',()=>{$('skyline-context').open=true;$('skyline-city').value=c.id;loadCity();})));
    layers.addOverlay(cityLayer,'Skyline city forecast locations');
  }).catch(()=>{$('skyline-city').innerHTML='<option>City models unavailable</option>';});
  $('skyline-load').onclick=loadCity;
  $('skyline-city').onchange=loadCity;
  $('skyline-context').addEventListener('toggle',()=>{if($('skyline-context').open&&!$('skyline-typhoon').textContent)typhoon();});
  document.querySelectorAll('[data-back-map]').forEach(button=>button.onclick=()=>{
    $(button.dataset.backMap==='assistant'?'close-assistant':'close-results').click();
    $('ask-qwen').focus();
  });
  const query=new URLSearchParams(location.search);
  if(query.has('assistant')){
    $('ask-qwen').click();
    if(query.has('question'))$('assistant-chat-input').value=query.get('question').slice(0,1500);
  }
})();
