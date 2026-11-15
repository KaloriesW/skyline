const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('./skyline/ui/app/web/location.js');
function setup(permission='granted',secure=true){
 const statuses=[],locations=[],calls=[];let success,failure;
 const navigator={geolocation:{getCurrentPosition(ok,fail,options){calls.push(options);success=ok;failure=fail;}},permissions:{query:async()=>({state:permission})}};
 const controller=create({navigator,secure,onStatus:(...s)=>statuses.push(s),onLocation:p=>locations.push(p)});
 return {controller,navigator,statuses,locations,calls,success:p=>success({coords:p}),fail:code=>failure({code})};
}
test('permission-based location rounds coordinates before passing them to weather',()=>{
 const f=setup();f.controller.request();f.controller.request();assert.equal(f.calls.length,1);
 f.success({latitude:24.147736,longitude:120.673648});assert.deepEqual(f.locations,[{lat:24.15,lon:120.67}]);assert.equal(f.statuses.at(-1)[0],'ready');
});
test('denial and timeout retain existing location and permit retry',()=>{
 for(const code of [1,2,3]){const f=setup();f.controller.request();f.fail(code);assert.equal(f.locations.length,0);assert.match(f.statuses.at(-1)[1],/search/i);f.controller.request();assert.equal(f.calls.length,2);}
});
test('manual city choice invalidates an outstanding GPS response',()=>{
 const f=setup();f.controller.request();f.controller.cancel();f.success({latitude:25,longitude:121});assert.equal(f.locations.length,0);
});
test('revisits refresh only if user chose device mode and permission is already granted',async()=>{
 for(const permission of ['granted','prompt','denied']){
  const f=setup(permission);await f.controller.resume(false);assert.equal(f.calls.length,0);
  await f.controller.resume(true);assert.equal(f.calls.length,permission==='granted'?1:0);
 }
});
test('manual choice while checking permission prevents automatic overwrite',async()=>{
 const f=setup();const pending=f.controller.resume(true);f.controller.cancel();await pending;assert.equal(f.calls.length,0);
});
test('insecure origin or missing browser API falls back to city search',()=>{
 const f=setup('granted',false);f.controller.request();assert.equal(f.calls.length,0);assert.match(f.statuses.at(-1)[1],/HTTPS/);
 const g=setup();delete g.navigator.geolocation;g.controller.request();assert.match(g.statuses.at(-1)[1],/Search/);
});
test('invalid coordinates cannot be saved or fetched',()=>{
 const f=setup();f.controller.request();f.success({latitude:NaN,longitude:121});assert.equal(f.locations.length,0);assert.equal(f.statuses.at(-1)[0],'error');
});
