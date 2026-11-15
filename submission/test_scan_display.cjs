const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('./static/scan_display.js');
test('late Hualien history response cannot overwrite a new Taichung plan',()=>{
 const view=create(),old=view.ticket('hualien');view.reserve('taichung-plan');
 assert.equal(view.accepts(old),false);assert.equal(view.allows('hualien'),false);
 view.reserve('taichung-plan','taichung-scan');
 assert.equal(view.allows('hualien'),false);assert.equal(view.accepts(view.ticket('taichung-scan')),true);
});
test('polling the same job keeps its response valid; changing plans invalidates it',()=>{
 const view=create();view.reserve('one','scan-one');const t=view.ticket('scan-one');
 view.reserve('one','scan-one');assert.equal(view.accepts(t),true);
 view.reserve('two','scan-two');assert.equal(view.accepts(t),false);
});
test('closing a plan permits manual history without resurrecting an old response',()=>{
 const view=create();view.reserve('one','scan-one');const t=view.ticket('scan-one');
 view.release();assert.equal(view.accepts(t),false);assert.equal(view.allows('hualien'),true);
});
test('restoring an inactive conversation does not invalidate startup history',()=>{
 const view=create(),t=view.ticket('latest');view.release();assert.equal(view.accepts(t),true);
});
