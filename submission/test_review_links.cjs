const test=require('node:test');
const assert=require('node:assert/strict');
const {referencedReviewAreas}=require('./static/workspace.js');
const features=[105,51,134].map(id=>({properties:{id,latitude:24,longitude:121}}));
test('review links use real IDs in answer order and deduplicate repeated mentions',()=>{
 assert.deepEqual(referencedReviewAreas('Area 134, Area 105; area 134, Area 999',features).map(f=>f.properties.id),[134,105]);
});
test('coordinates and absent candidates do not become navigation actions',()=>{
 assert.deepEqual(referencedReviewAreas('148 suspected regions, 24.377140, 121.235412',features),[]);
 assert.deepEqual(referencedReviewAreas('Area 105',[]),[]);
 assert.deepEqual(referencedReviewAreas('Area 1050',features),[]);
});
