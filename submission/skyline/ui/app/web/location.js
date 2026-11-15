/* Permission-based, one-shot location. Manual choices cancel late GPS callbacks. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SkylineLocation=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function create(options){
    var nav=options.navigator,sequence=0,busy=false;
    function status(state,message){options.onStatus(state,message);}
    function cancel(){sequence++;busy=false;}
    function request(){
      if(busy)return;
      if(!options.secure){status('error','Location needs HTTPS or localhost. Search for your city instead.');return;}
      if(!nav.geolocation){status('error','Location is unavailable in this browser. Search for your city instead.');return;}
      busy=true;var id=++sequence;
      status('loading','Finding your city… Allow location access when your browser asks.');
      function failed(error){
        if(id!==sequence)return;busy=false;
        status('error',error.code===1?'Location access was declined. Search for your city, or enable location in browser settings.':error.code===3?'Location timed out. Try again or search for your city.':'Could not determine your location. Search for your city instead.');
      }
      try { nav.geolocation.getCurrentPosition(function(position){
        if(id!==sequence)return;busy=false;
        var lat=position.coords.latitude,lon=position.coords.longitude;
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){failed({code:2});return;}
        // Weather does not need street-level coordinates. Round before saving or fetching.
        options.onLocation({lat:Math.round(lat*100)/100,lon:Math.round(lon*100)/100});
        status('ready','Using your approximate location. City labels are based on the nearest mapped centre.');
      },failed,{enableHighAccuracy:false,timeout:10000,maximumAge:600000}); }
      catch(e){failed({code:2});}
    }
    async function resume(enabled){
      if(!enabled||!nav.permissions)return;
      var id=sequence;
      try {var permission=await nav.permissions.query({name:'geolocation'});
        if(id!==sequence)return;
        if(permission.state==='granted')request();
        else if(permission.state==='denied')status('error','Location access is off. Showing your saved city; search to change it.');
      }catch(e){/* Permission API is optional. The explicit button still works. */}
    }
    return {request:request,cancel:cancel,resume:resume};
  }
  return {create:create};
});
