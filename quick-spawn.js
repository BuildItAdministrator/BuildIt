/* Build It!++ Quick Spawn. Choose → map click → confirm.
 * No manual file export/import. Nitrado changes are checked and backed up
 * by the existing Cloudflare Worker; activation happens after server restart.
 */
(function(){
'use strict';
if(!window.BUILD_IT_SPAWN_API||typeof map==='undefined'||typeof L==='undefined')return;
const api=window.BUILD_IT_SPAWN_API;
const root=document.createElement('section');
root.id='quickSpawnPanel';root.hidden=true;root.setAttribute('role','dialog');
root.setAttribute('aria-label','Quick Spawn vehicles and loot');
root.innerHTML=`
 <header class="qs-head"><div><strong>Quick Spawn</strong><small>Choose · Click map · Confirm</small></div><button type="button" id="qsClose" aria-label="Close">×</button></header>
 <div class="qs-mode" role="group" aria-label="Spawn type">
  <button type="button" id="qsVehicleMode" aria-pressed="true">Vehicle</button>
  <button type="button" id="qsLootMode" aria-pressed="false">Lootdrop</button>
 </div>
 <div class="qs-step"><span>1</span><strong>Choose what to spawn</strong></div>
 <label class="qs-label" for="qsFind">Search classname or vehicle model</label>
 <input id="qsFind" type="search" autocomplete="off" spellcheck="false" placeholder="Search car, Humvee, motorbike…">
 <div id="qsMatches" class="qs-matches" hidden></div>
 <div id="qsSelected" class="qs-selected">Nothing selected yet</div>
 <div id="qsLootFields" hidden>
   <div class="qs-duo"><label>Quantity <input id="qsQuantity" type="number" min="1" max="20" step="1" value="1"></label>
   <label>Ground height Y (m) <input id="qsHeight" type="number" min="-100" max="1000" step="0.01" placeholder="e.g. 260.5"></label></div>
   <p class="qs-note">Ground elevation is required for JSON loot. The map only supplies X/Z; no unverified altitude is guessed.</p>
 </div>
 <div class="qs-step"><span>2</span><strong>Select a map location</strong></div>
 <button type="button" id="qsPick">Click to pick a position on the map</button>
 <p id="qsCoordinates" class="qs-coordinates">No location selected</p>
 <div class="qs-step"><span>3</span><strong>Confirm spawn</strong></div>
 <p class="qs-note">Your DayZ server must be stopped before publishing. This saves the configuration to Nitrado automatically; the spawn appears after you start/restart the server, not instantly.</p>
 <button type="button" id="qsPublish" disabled>Confirm spawn to Nitrado</button>
 <p id="qsStatus" class="qs-status" role="status" aria-live="polite"></p>
 <details class="qs-settings"><summary>One-time connection setup</summary><p class="qs-note">Enter the existing MAP_WRITE_KEY once per page load. Nothing is sent until you confirm a spawn.</p><label class="qs-label" for="qsWriteKey">Cloudflare write key</label><input id="qsWriteKey" type="password" autocomplete="off" placeholder="MAP_WRITE_KEY (8+ characters)"></details>
 <button id="qsAdvanced" type="button">Advanced Event Manager</button>
`;
document.body.appendChild(root);
const $=id=>root.querySelector('#'+id);
let mode='vehicle',chosen='',coordinates=null,picking=false,busy=false,pin=null;
function setStatus(message,err=false){$('qsStatus').textContent=message;$('qsStatus').dataset.error=err?'true':'false';}
function currentOptions(){
  return mode==='vehicle'?api.vehicles():api.items().map(name=>({name,label:name}));
}
function refreshButton(){
  const valid=chosen&&coordinates&&!busy&&
    (mode==='vehicle'||($('qsHeight').value.trim()!==''&&Number.isFinite(Number($('qsHeight').value))&&
      Number($('qsHeight').value)>=-100&&Number($('qsHeight').value)<=1000&&
      Number.isInteger(Number($('qsQuantity').value))&&Number($('qsQuantity').value)>=1&&Number($('qsQuantity').value)<=20));
  $('qsPublish').disabled=!valid;
}
function renderMatches(){
  const term=$('qsFind').value.trim().toLowerCase();
  const all=currentOptions(),matches=all.filter(v=>
    v.name.toLowerCase().includes(term)||v.label.toLowerCase().includes(term)).slice(0,35);
  const box=$('qsMatches');box.replaceChildren();
  if(!term){box.hidden=true;return;}
  box.hidden=false;
  if(!matches.length){box.textContent='No catalog match. Wait for the official item catalog or check the spelling.';return;}
  for(const item of matches){
    const button=document.createElement('button');button.type='button';
    button.textContent=item.label===item.name?item.name:item.label+' · '+item.name;
    button.addEventListener('click',()=>{
      chosen=item.name;$('qsFind').value=item.label===item.name?item.name:item.label+' · '+item.name;
      $('qsSelected').textContent='Selected: '+item.name;
      box.hidden=true;refreshButton();setStatus('');
    });
    box.appendChild(button);
  }
}
function chooseMode(next){
  mode=next;chosen='';$('qsFind').value='';$('qsSelected').textContent='Nothing selected yet';
  $('qsVehicleMode').setAttribute('aria-pressed',String(mode==='vehicle'));
  $('qsLootMode').setAttribute('aria-pressed',String(mode==='loot'));
  $('qsLootFields').hidden=mode!=='loot';$('qsMatches').hidden=true;
  $('qsFind').placeholder=mode==='vehicle'?'Search car, Humvee, motorbike…':'Search Apple, M4A1, ammo, medical items…';
  refreshButton();setStatus('');
}
$('qsVehicleMode').addEventListener('click',()=>chooseMode('vehicle'));
$('qsLootMode').addEventListener('click',()=>chooseMode('loot'));
$('qsFind').addEventListener('input',()=>{
  if(chosen){chosen='';$('qsSelected').textContent='Choose an item from the results';}
  renderMatches();refreshButton();
});
$('qsFind').addEventListener('focus',renderMatches);
for(const id of ['qsQuantity','qsHeight'])$(id).addEventListener('input',refreshButton);
$('qsPick').addEventListener('click',()=>{
  if(busy)return;
  picking=!picking;
  $('qsPick').textContent=picking?'Click the map to set the spawn position':'Click to pick a position on the map';
  setStatus(picking?'Click anywhere on the Chernarus map.':'');
});
map.on('click',e=>{
  if(!picking||busy)return;
  const p=leafletToGame(e.latlng);
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||p.x<0||p.z<0||p.x>15360||p.z>15360){
    setStatus('Choose a position inside Chernarus.',true);return;
  }
  coordinates={x:Number(p.x.toFixed(2)),z:Number(p.z.toFixed(2))};
  picking=false;$('qsPick').textContent='Change map position';
  $('qsCoordinates').textContent='X '+coordinates.x+' · Z '+coordinates.z;
  if(pin)map.removeLayer(pin);
  pin=L.circleMarker(e.latlng,{radius:8,color:'#2ab6c1',weight:3,fillColor:'#2ab6c1',fillOpacity:.3}).addTo(map);
  pin.bindTooltip('Quick Spawn: '+coordinates.x+', '+coordinates.z);
  refreshButton();setStatus('Map position selected. Check the details and confirm.');
});
function open(){
  document.getElementById('biPanel')?.setAttribute('hidden','');
  for(const id of ['filterPanel','logPanel'])document.getElementById(id)?.classList.add('hidden');
  const toolHub=document.getElementById('toolHubPanel');
  if(toolHub){toolHub.hidden=true;document.getElementById('toolHubToggle')?.setAttribute('aria-expanded','false');}
  root.hidden=false;$('qsFind').focus({preventScroll:true});
}
function close(){root.hidden=true;picking=false;$('qsPick').textContent='Click to pick a position on the map';$('qsMatches').hidden=true;}
function toggle(){root.hidden?open():close();}
$('qsClose').addEventListener('click',close);
$('qsAdvanced').addEventListener('click',()=>{close();api.advanced();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden&&!busy)close();});
for(const id of ['filterToggle','logToggle','toolHubToggle']){
  document.getElementById(id)?.addEventListener('click',close);
}
$('qsPublish').addEventListener('click',async()=>{
  if(busy||!chosen||!coordinates)return;
  const spec={
    classname:chosen,...coordinates,
    ...(mode==='loot'?{quantity:Number($('qsQuantity').value),y:$('qsHeight').value}: {})
  };
  const line=mode==='loot'?
    spec.quantity+' × '+spec.classname+' at X '+spec.x+', Z '+spec.z+', Y '+spec.y:
    spec.classname+' at X '+spec.x+', Z '+spec.z;
  const manualKey=$('qsWriteKey').value.trim();
  const existing=document.getElementById('nitradoWriteKey');
  if(manualKey.length>=8&&existing)existing.value=manualKey;
  if(!existing||existing.value.trim().length<8){
    root.querySelector('.qs-settings').open=true;
    setStatus('Enter your MAP_WRITE_KEY in One-time connection setup, or in Logs → Server files & uploads.',true);
    return;
  }
  // The only confirmation in the workflow. No file export or queue step.
  if(!window.confirm('Confirm Quick Spawn to your Nitrado mission?\n'+line+
    '\n\nYour server MUST be stopped before you continue. The spawn activates on server start/restart.'+
    '\n\nAre you sure the server is stopped and you want to publish?'))return;
  busy=true;refreshButton();$('qsPick').disabled=true;
  setStatus('Preparing a safe Nitrado upload…');
  try{
    const result=await api.publish(mode,spec,msg=>setStatus(msg));
    setStatus('PUBLISHED: '+(result.quantity?result.quantity+' × ':'')+result.classname+
      '. Verified Nitrado file changes. Start the server to activate this spawn.\n'+result.files.map(x=>x.split('/').pop()).join(' + '));
    chosen='';$('qsFind').value='';$('qsSelected').textContent='Nothing selected yet';
    coordinates=null;$('qsCoordinates').textContent='No location selected';
    if(pin){map.removeLayer(pin);pin=null;}
    $('qsHeight').value='';
  }catch(error){
    setStatus('NOT COMPLETE: '+error.message,true);
  }finally{busy=false;$('qsPick').disabled=false;refreshButton();}
});
window.addEventListener('buildit:nitrado-profile-changing',()=>{
  close();chosen='';coordinates=null;picking=false;
  $('qsFind').value='';
  $('qsSelected').textContent='No item selected';
  $('qsCoordinates').textContent='No position selected';
  $('qsWriteKey').value='';
  $('qsHeight').value='';
  $('qsStatus').textContent='New server selected. Choose a fresh spawn.';
  if(pin){map.removeLayer(pin);pin=null;}
  refreshButton();
});
window.BUILD_IT_QUICK_SPAWN=Object.freeze({open,close,toggle});
})();
