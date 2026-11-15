let weatherVisible=false,weatherData=null,weatherLayer=null,weatherLoading=false,weatherPending=false,weatherTimer=null,weatherEpoch=0;
let windyCenter={lat:23.7,lon:121,zoom:7};
function nativeWeatherActive(){return weatherVisible&&$('weather-mode').value==='native';}
map.createPane('weatherPane').style.zIndex=350;
const weatherTime=t=>t?new Date(t).toLocaleString('en-GB',{timeZone:'Asia/Taipei',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'unavailable';
const weatherNumber=v=>Number.isFinite(v)?Number(v).toFixed(1):'—';
function weatherRange(w,key){const v=(w?.points||[]).filter(Boolean).map(p=>p[key]).filter(Number.isFinite);return v.length?`${weatherNumber(Math.min(...v))}–${weatherNumber(Math.max(...v))}`:'—';}
function weatherHTML(w){
  if(!w)return '<p class="hint">No forecast saved with this scan. Add the current forecast below.</p>';
  return `<div class="weather-card"><strong>Weather forecast · ${esc(w.status)}</strong><p>${esc(w.summary||'Regional weather forecast samples.')}</p><div class="weather-totals"><span>6 h rain<b>${weatherRange(w,'precipitation_6h_mm')} mm</b></span><span>24 h rain<b>${weatherRange(w,'precipitation_24h_mm')} mm</b></span><span>48 h rain<b>${weatherRange(w,'precipitation_48h_mm')} mm</b></span></div><p class="hint">Ranges across ${esc(w.available_points??0)}/${esc(w.requested_points??0)} samples with complete 24 h rainfall. Wind maximum: ${weatherRange(w,'wind_max_24h_kmh')} km/h. — means unavailable.</p><p class="hint">${weatherTime(w.forecast_start)} → ${weatherTime(w.forecast_end)} · Taiwan time<br>Retrieved ${weatherTime(w.fetched_at)}<br><a href="https://www.met.no/" target="_blank" rel="noopener">MET Norway</a> · CC BY 4.0</p><p class="notice">Current weather predictions; separate from the satellite image date${w.satellite_acquired?' ('+esc(w.satellite_acquired.slice(0,10))+')':''}. Regional rainfall can differ from conditions on a hillside. These are not landslide probabilities.</p></div>`;
}
const weatherReadout=document.createElement('div');weatherReadout.className='weather-map-readout';weatherReadout.hidden=true;document.body.appendChild(weatherReadout);
const WeatherMath={
  interpolate(data,lat,lon,values){
    const [west,south,east,north]=data.bbox;if(lon<west||lon>east||lat<south||lat>north)return null;
    const gx=(lon-west)/data.grid_step_degrees,gy=(lat-south)/data.grid_step_degrees;
    const x=Math.min(Math.floor(gx),data.nx-2),y=Math.min(Math.floor(gy),data.ny-2),fx=gx-x,fy=gy-y;
    const indexes=[y*data.nx+x,y*data.nx+x+1,(y+1)*data.nx+x,(y+1)*data.nx+x+1];
    const v=indexes.map(i=>values[i]);if(v.some(n=>!Number.isFinite(n)))return null;
    return v[0]*(1-fx)*(1-fy)+v[1]*fx*(1-fy)+v[2]*(1-fx)*fy+v[3]*fx*fy;
  },
  wind(speed,from){if(!Number.isFinite(speed)||!Number.isFinite(from))return [null,null];const a=from*Math.PI/180;return [-speed*Math.sin(a),-speed*Math.cos(a)];}
};
function weatherMetric(){return $('weather-metric').value;}
function weatherValues(key){const hour=Number($('weather-hour').value);return (weatherData?.points||[]).map(p=>p?(key.includes('_mm')?p[key]:p.hourly?.[hour]?.[key]):null);}
function weatherScale(){const key=weatherMetric();if(key==='temperature_2m')return {unit:'°C',stops:[[-5,[73,89,181]],[10,[72,163,205]],[20,[90,190,145]],[30,[236,183,75]],[40,[222,68,80]]]};if(key==='cloud_cover')return {unit:'%',stops:[[0,[39,88,119]],[50,[129,155,172]],[100,[239,244,251]]]};if(key==='wind_speed_10m')return {unit:'km/h',stops:[[0,[43,87,148]],[10,[61,141,190]],[25,[55,186,152]],[40,[175,199,92]],[60,[239,166,76]],[100,[214,71,136]]]};return {unit:key==='precipitation'?'mm / hour':'mm',stops:[[0,[42,93,110]],[1,[42,159,175]],[10,[69,148,231]],[30,[150,105,206]],[60,[230,139,76]],[100,[236,67,93]]]};}
function weatherRGB(v,stops){if(v<=stops[0][0])return stops[0][1];for(let i=1;i<stops.length;i++){if(v<=stops[i][0]){const f=(v-stops[i-1][0])/(stops[i][0]-stops[i-1][0]);return stops[i][1].map((n,k)=>Math.round(stops[i-1][1][k]*(1-f)+n*f));}}return stops[stops.length-1][1];}
const WeatherCanvas=L.Layer.extend({
  onAdd(m){this._map=m;this.canvas=L.DomUtil.create('canvas','weather-canvas');m.getPane('weatherPane').appendChild(this.canvas);m.on('moveend zoomend resize',this.draw,this);this.draw();},
  onRemove(m){m.off('moveend zoomend resize',this.draw,this);this.canvas.remove();},
  draw(){
    if(!nativeWeatherActive()||!weatherData)return;const m=this._map,size=m.getSize();L.DomUtil.setPosition(this.canvas,m.containerPointToLayerPoint([0,0]));this.canvas.width=size.x;this.canvas.height=size.y;
    const ctx=this.canvas.getContext('2d'),stride=4,w=Math.ceil(size.x/stride),h=Math.ceil(size.y/stride),small=document.createElement('canvas');small.width=w;small.height=h;
    const sc=small.getContext('2d'),pixels=sc.createImageData(w,h),values=weatherValues(weatherMetric()),scale=weatherScale(),opacity=Number($('weather-opacity').value)/100;
    const west=m.containerPointToLatLng([0,0]).lng,east=m.containerPointToLatLng([size.x,0]).lng;
    for(let y=0;y<h;y++){const lat=m.containerPointToLatLng([0,(y+.5)*stride]).lat;for(let x=0;x<w;x++){
      const lon=west+(east-west)*(x+.5)*stride/size.x,v=WeatherMath.interpolate(weatherData,lat,lon,values);if(v==null)continue;
      const k=(y*w+x)*4,c=weatherRGB(v,scale.stops);pixels.data[k]=c[0];pixels.data[k+1]=c[1];pixels.data[k+2]=c[2];pixels.data[k+3]=Math.round(255*opacity);
    }}sc.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(small,0,0,size.x,size.y);
    if(weatherMetric()==='wind_speed_10m'){
      const speeds=weatherValues('wind_speed_10m'),directions=weatherValues('wind_from_direction'),vectors=speeds.map((s,i)=>WeatherMath.wind(s,directions[i])),u=vectors.map(v=>v[0]),v=vectors.map(v=>v[1]);
      ctx.strokeStyle='#e9fbf2';ctx.lineWidth=1.2;ctx.globalAlpha=.8;
      for(let y=35;y<size.y;y+=60)for(let x=35;x<size.x;x+=60){const ll=m.containerPointToLatLng([x,y]),a=WeatherMath.interpolate(weatherData,ll.lat,ll.lng,u),b=WeatherMath.interpolate(weatherData,ll.lat,ll.lng,v);if(a==null||b==null||Math.hypot(a,b)<.5)continue;const angle=Math.atan2(-b,a),len=12;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-len/2,0);ctx.lineTo(len/2,0);ctx.lineTo(len/2-4,-3);ctx.moveTo(len/2,0);ctx.lineTo(len/2-4,3);ctx.stroke();ctx.restore();}ctx.globalAlpha=1;
    }
  }
});
function weatherTimeLabel(){
  if(!weatherData)return 'Loading forecast';const key=weatherMetric(),start=new Date(weatherData.forecast_start).getTime(),hours=key.includes('_mm')?Number(key.match(/_(\d+)h_/)[1]):null;
  if(hours)return `${weatherTime(start)} → ${weatherTime(start+hours*3600000)} · Taiwan`;
  const i=Number($('weather-hour').value),t=start+i*3600000;
  return key==='precipitation'?`${weatherTime(t)} → ${weatherTime(t+3600000)} · Taiwan`:`${weatherTime(t)} · Taiwan`;
}
function drawWeather(){
  $('weather-hour').disabled=weatherMetric().includes('_mm');$('weather-hour-label').textContent=weatherTimeLabel();
  const scale=weatherScale();$('weather-legend').innerHTML=scale.stops.map(([v,c])=>`<span><i style="background:rgb(${c})"></i>${v}</span>`).join('')+`<small>${scale.unit} · missing data transparent</small>`;
  if(!nativeWeatherActive()||!weatherData)return;
  if(!weatherLayer)weatherLayer=new WeatherCanvas();if(!map.hasLayer(weatherLayer))weatherLayer.addTo(map);else weatherLayer.draw();
  $('weather-resolution').textContent=`Model ≈${weatherData.model_resolution_km||9} km · samples ≈${Math.round(weatherData.grid_step_degrees*111)} km. Zoom in for ≈10 km sampling.`;
  weatherReadout.hidden=false;weatherReadout.textContent=weatherTimeLabel();
}
function weatherBounds(){const b=map.getBounds();return {west:Math.max(118,b.getWest()),south:Math.max(21.5,b.getSouth()),east:Math.min(122.5,b.getEast()),north:Math.min(26.5,b.getNorth())};}
async function loadWeather(){
  if(!nativeWeatherActive())return;if(weatherLoading){weatherPending=true;return;}const bounds=weatherBounds();if(bounds.west>=bounds.east||bounds.south>=bounds.north){$('weather-status').textContent='Pan to Taiwan to load forecasts.';return;}
  weatherLoading=true;weatherPending=false;const epoch=++weatherEpoch;
  $('weather-status').textContent='Loading forecasts for this view…';
  try{
    let job=await api('/api/weather/grid',bounds);
    if(job.state==='busy'){weatherPending=true;return;}
    while(nativeWeatherActive()&&epoch===weatherEpoch){
      const state=await api('/api/weather/grid/'+job.id);
      if(state.state==='failed')throw Error(state.message);
      if(state.state==='completed'){
        weatherData=state.result;weatherData.loadedAt=Date.now();drawWeather();
        $('weather-status').textContent=`${weatherData.available_points}/${weatherData.requested_points} samples · retrieved ${weatherTime(weatherData.fetched_at)}. ${weatherData.status==='unavailable'?'Weather unavailable; no values inferred.':''}`;break;
      }
      $('weather-status').textContent=`Loading ${state.completed}/${state.total} samples… First fetch may take a few minutes. Landslide results remain usable.`;
      await new Promise(resolve=>setTimeout(resolve,1200));
    }
  }catch(e){$('weather-status').textContent='Forecast unavailable: '+e.message+' Existing dated layer is retained.';}
  finally{weatherLoading=false;if(nativeWeatherActive()&&weatherPending){clearTimeout(weatherTimer);weatherTimer=setTimeout(loadWeather,1400);}}
}
function renderWindy(){
  const params=new URLSearchParams({type:'map',location:'coordinates',metricRain:'mm',metricTemp:'°C',metricWind:'km/h',zoom:String(windyCenter.zoom),overlay:$('windy-layer').value,product:'ecmwf',level:'surface',lat:String(windyCenter.lat),lon:String(windyCenter.lon),message:'true'});
  const src='https://embed.windy.com/embed.html?'+params.toString();
  if($('windy-frame').getAttribute('src')!==src)$('windy-frame').src=src;
}
async function setWeatherVisible(on){
  weatherVisible=on;const native=nativeWeatherActive(),windy=on&&!native;
  $('weather-toggle').setAttribute('aria-pressed',String(on));$('weather-toggle').innerHTML=`Weather map <span>${on?'On':'Off'}</span>`;$('weather-controls').hidden=!on;
  $('native-weather-options').hidden=$('weather-mode').value!=='native';$('windy-options').hidden=$('weather-mode').value!=='windy';$('windy-surface').hidden=!windy;
  document.body.classList.toggle('windy-visible',windy);weatherReadout.hidden=!native;
  if(!native){weatherEpoch++;weatherPending=false;clearTimeout(weatherTimer);if(weatherLayer)map.removeLayer(weatherLayer);map.attributionControl.removeAttribution('Weather: MET Norway / ECMWF · CC BY 4.0');}
  if(!on)return;stopComparison();
  if(windy){renderWindy();return;}
  map.attributionControl.addAttribution('Weather: MET Norway / ECMWF · CC BY 4.0');drawWeather();await loadWeather();
}
$('weather-mode').onchange=()=>setWeatherVisible(weatherVisible);
$('windy-layer').onchange=renderWindy;
$('windy-taiwan').onclick=()=>{windyCenter={lat:23.7,lon:121,zoom:7};renderWindy();};
$('windy-area').onclick=()=>{const a=getArea();windyCenter={lat:a.lat,lon:a.lon,zoom:a.width_km>=36?9:11};renderWindy();};
$('weather-toggle').onclick=()=>setWeatherVisible(!weatherVisible);
$('weather-metric').onchange=drawWeather;$('weather-hour').oninput=drawWeather;
$('weather-opacity').oninput=()=>{$('weather-opacity-label').textContent=$('weather-opacity').value+'%';weatherLayer?.draw();};
$('weather-refresh').onclick=loadWeather;
$('weather-overview').onclick=()=>map.fitBounds([[21.8,120],[25.5,122.3]],{paddingTopLeft:[300,35],paddingBottomRight:[30,55]});
map.on('moveend',()=>{if(nativeWeatherActive()){clearTimeout(weatherTimer);weatherTimer=setTimeout(loadWeather,700);}});
map.on('mousemove',e=>{if(!nativeWeatherActive()||!weatherData)return;const value=WeatherMath.interpolate(weatherData,e.latlng.lat,e.latlng.lng,weatherValues(weatherMetric()));weatherReadout.textContent=`${value==null?'No forecast coverage':weatherNumber(value)+' '+weatherScale().unit} · ${e.latlng.lat.toFixed(3)}, ${e.latlng.lng.toFixed(3)} · ${weatherTimeLabel()}`;});
setInterval(()=>{if(nativeWeatherActive())loadWeather();},3*3600000);
function showWeatherResult(r){$('result-weather').innerHTML=weatherHTML(r.weather);$('refresh-result-weather').disabled=false;$('refresh-result-weather').textContent=r.weather?'Refresh current forecast ↻':'Add current forecast ↻';$('weather-downloads').hidden=!r.weather;$('weather-json').href=`/results/${r.id}/forecast.json`;$('weather-csv').href=`/results/${r.id}/forecast.csv`;}
function candidateWeather(p){return p.forecast_precipitation_24h_mm==null?'Weather forecast: unavailable':`Regional forecast rain: ${weatherNumber(p.forecast_precipitation_24h_mm)} mm / 24 h<br>${weatherTime(p.forecast_start)} → ${weatherTime(p.forecast_end)} (Taiwan)<br>Nearest weather sample; not a landslide probability.`;}
$('refresh-result-weather').onclick=async()=>{
  if(!currentResult)return;const id=currentResult.id,bounds=map.getBounds();$('refresh-result-weather').disabled=true;$('refresh-result-weather').textContent='Fetching forecast…';
  try{const r=await api(`/api/scans/${id}/weather`,{});if(currentResult?.id===id){showResult(r);map.fitBounds(bounds);}}catch(e){error(e.message);}finally{$('refresh-result-weather').disabled=false;$('refresh-result-weather').textContent='Refresh current forecast ↻';}
};
