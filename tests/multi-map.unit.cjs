const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const registry=fs.readFileSync('map-registry.js','utf8');
function boot(id='chernarus',storage=new Map(),server='one'){
 storage.set('buildit_world_v1:service:'+server,id);
 const window={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},BUILD_IT_STAGE4_BOOT:{serviceId:server}};
 const context=vm.createContext({window,console,Number,JSON,Set,Blob});vm.runInContext(registry,context);
 return {api:window.BUILD_IT_MAPS,window,context,storage};
}
for(const [id,size,mission] of [['chernarus',15360,'chernarusplus'],['livonia',12800,'enoch'],['nasdara',16384,'nasdara'],['sakhal',15360,'sakhal']]){
 test(id+': boundaries, coordinates and mission paths',()=>{
  const {api}=boot(id);assert.equal(api.current.size,size);
  assert.deepEqual(Array.from(api.missionPaths()),['dayzps_missions/dayzOffline.'+mission,'mpmissions/dayzOffline.'+mission]);
  for(const [x,z] of [[0,0],[size,size],[size*.23,size*.71]]){
   const [lat,lng]=api.toLeaflet(x,z);const result=api.fromLeaflet({lat,lng});
   assert.ok(Math.abs(x-result.x)<1e-8&&Math.abs(z-result.z)<1e-8);assert.ok(api.valid(x,z));
  }
  assert.ok(!api.valid(size+1,0));assert.ok(!api.valid(0,-1));assert.ok(!api.valid(NaN,0));
 });
 test(id+': loot placement respects map boundary including spread',()=>{
  const {window,context}=boot(id);vm.runInContext(fs.readFileSync('loot-spawner.js','utf8'),context);
  const draft={kind:'loot',name:'Test',x:size-1,z:size-1,y:0,a:0,spacing:1,items:[{name:'Apple',qty:1}]};
  assert.equal(JSON.parse(window.BUILD_IT_LOOT.build([draft]).content).Objects[0].pos[0],size-1);
  assert.throws(()=>window.BUILD_IT_LOOT.build([{...draft,x:size+1}]));
  assert.throws(()=>window.BUILD_IT_LOOT.build([{...draft,x:size,z:size,items:[{name:'Apple',qty:4}]}]));
 });
}
test('map choices and draft keys are isolated by server and world',()=>{
 const {api,storage}=boot('livonia');api.select('nasdara');assert.equal(api.selected().id,'nasdara');
 const other=boot('sakhal',storage,'two');assert.equal(other.api.selected().id,'sakhal');assert.equal(api.selected().id,'nasdara');
 assert.notEqual(api.draftKey('draft','one'),other.api.draftKey('draft','one'));
 assert.notEqual(api.draftKey('draft','one'),api.draftKey('draft','two'));
 assert.throws(()=>api.select('unknown'));assert.equal(api.selected().id,'nasdara');
});
test('production create allowlist accepts four official missions only',()=>{
 const source=fs.readFileSync('cloudflare/production/worker.js','utf8');
 const code=source.slice(source.indexOf('  const validPaths = gameRoots(username).flatMap(root =>\n    ["chernarusplus"'),source.indexOf('  if (!validPaths.includes(path))'));
 assert.ok(code.length>0);const valid=vm.runInNewContext(code+'validPaths',{username:'user',gameRoots:()=>['/games/user/ftproot','/games/user/noftp']});
 assert.equal(valid.length,16);
 for(const world of ['chernarusplus','enoch','sakhal','nasdara'])assert.ok(valid.includes('/games/user/ftproot/mpmissions/dayzOffline.'+world+'/custom/builditlootdrop.json'));
 assert.ok(!valid.includes('/games/user/ftproot/mpmissions/dayzOffline.unknown/custom/builditlootdrop.json'));
 assert.ok(!valid.includes('/games/other/ftproot/mpmissions/dayzOffline.enoch/custom/builditlootdrop.json'));
});
