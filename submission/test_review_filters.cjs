const assert=require('node:assert/strict');
const test=require('node:test');
const {select}=require('./static/review_filters.js');
const feature=p=>({type:'Feature',properties:p});
test('unknown road distance never qualifies as nearby',()=>{
  const values=[null,undefined,NaN,-1,201,0,200];
  const rows=values.map(road_distance_m=>feature({road_proximity_status:'available',road_distance_m}));
  assert.deepEqual(select(rows,{road:true}).map(f=>f.properties.road_distance_m),[0,200]);
  assert.equal(select([feature({road_proximity_status:'unavailable',road_distance_m:0})],{road:true}).length,0);
});
test('combined filters preserve identifiers and original complete scan',()=>{
  const rows=[feature({id:9,vegetation_check:'supports',road_proximity_status:'available',road_distance_m:100,area_m2:10000}),feature({id:10,vegetation_check:'unavailable',road_proximity_status:'available',road_distance_m:0,area_m2:20000})];
  const before=JSON.stringify(rows);
  assert.deepEqual(select(rows,{vegetation:true,road:true,minArea:10000}).map(f=>f.properties.id),[9]);
  assert.equal(JSON.stringify(rows),before);
  assert.equal(select(rows,{}).length,2);
  assert.equal(select(rows,{minArea:30000}).length,0);
});
