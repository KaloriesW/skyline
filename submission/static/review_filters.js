/* Shared pure rules: missing evidence never becomes a zero or a passing check. */
(function(root){
  const select=(features,settings)=>features.filter(feature=>{
    const p=feature.properties;
    if(settings.vegetation&&p.vegetation_check!=='supports')return false;
    if(settings.road&&(p.road_proximity_status!=='available'||!Number.isFinite(p.road_distance_m)||p.road_distance_m<0||p.road_distance_m>200))return false;
    if(settings.minArea>0&&(!Number.isFinite(p.area_m2)||p.area_m2<settings.minArea))return false;
    return true;
  });
  const api={select};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ReviewFilters=api;
})(typeof window!=='undefined'?window:globalThis);
