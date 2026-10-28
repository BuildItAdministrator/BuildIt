/* Build It!++ — browser-local Nitrado server profiles. */
(function(){
'use strict';
const STORE='buildit_nitrado_profiles_v1';
const LEGACY='buildit_nitrado_sync_v1';
const DEFAULT_WORKER='https://buildit-nitrado-logs.davaydresnikov.workers.dev';
const admin=window.BUILD_IT_NITRADO_ADMIN;
if(!admin)return;
const $=id=>document.getElementById(id);
const parse=(v,fallback)=>{try{return JSON.parse(v)}catch{return fallback;}};
const newId=()=>crypto.randomUUID();
let profiles=[],activeId='',busy=false,mode='unknown',options=[],discoveredKey='',discoveredUrl='';
function storage(){
 try{localStorage.setItem(STORE,JSON.stringify({activeId,profiles}));}
 catch(e){message('Browser storage error: '+e.message,true);}
}
function validUrl(raw){
 const u=new URL(String(raw||'').trim());
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)
  throw Error('Enter your Cloudflare Worker HTTPS root URL without a path or query.');
 return u.origin;
}
function sanitize(p){
 if(!p||typeof p.name!=='string'||typeof p.workerUrl!=='string'||typeof p.accessKey!=='string')return null;
 return {id:String(p.id||newId()),name:p.name.slice(0,70),workerUrl:p.workerUrl,
  accessKey:p.accessKey,serverId:String(p.serverId||'default'),serviceId:String(p.serviceId||''),
  serverName:String(p.serverName||''),workerMode:p.workerMode==='multi'?'multi':'legacy',
  autoSync:p.autoSync!==false};
}
function init(){
 const saved=parse(localStorage.getItem(STORE)||'null',null);
 if(Array.isArray(saved?.profiles)){
  profiles=saved.profiles.map(sanitize).filter(Boolean).slice(0,20);
  activeId=String(saved.activeId||'');
 }
 if(!profiles.length){
  const old=parse(localStorage.getItem(LEGACY)||'{}',{});
  const now=admin.current();
  const p=sanitize({name:'Mijn DayZ-server',workerUrl:now.workerUrl||old.workerUrl||DEFAULT_WORKER,
   accessKey:now.accessKey||old.accessKey||'',serverId:now.serverId||old.serverId||'default',
   workerMode:now.workerMode,autoSync:now.autoSync});
  profiles=[p];activeId=p.id;storage();
 }
 if(!profiles.some(p=>p.id===activeId))activeId=profiles[0].id;
}
const dock=document.createElement('div');
dock.id='biServerProfileDock';
dock.innerHTML=[
 '<label for="biServerProfileSelect">Server</label>',
 '<select id="biServerProfileSelect" aria-label="Active DayZ server profile"></select>',
 '<button id="biServerProfileManage" type="button" title="Add, edit or remove Nitrado servers">Manage</button>'
].join('');
document.body.appendChild(dock);
const panel=document.createElement('section');
panel.id='biServerProfilePanel';panel.hidden=true;panel.setAttribute('role','dialog');
panel.setAttribute('aria-label','Nitrado server profiles');
panel.innerHTML=[
 '<div class="bsp-header"><div><strong>Mijn servers</strong><small>Wissel bovenaan direct van Nitrado-server</small></div>',
 '<button id="bspClose" type="button" aria-label="Close">×</button></div>',
 '<p class="bsp-help">Elke single-server Worker beheert één Nitrado-service. Een multi-server Worker kan meerdere services via dezelfde verbinding aanbieden.</p>',
 '<label>Profielnaam<input id="bspName" maxlength="70" placeholder="Bijv. PvE Chernarus"></label>',
 '<label>Cloudflare Worker HTTPS URL<input id="bspWorker" type="url" placeholder="https://voorbeeld.workers.dev" spellcheck="false"></label>',
 '<label>MAP_SYNC_KEY<input id="bspAccess" type="password" autocomplete="off" placeholder="Access key voor deze Worker"></label>',
 '<div class="bsp-actions"><button id="bspDiscover" type="button">Servers ophalen</button></div>',
 '<label>Nitrado-service<select id="bspService" disabled><option value="default">Eerst Worker controleren</option></select></label>',
 '<p id="bspMessage" role="status" aria-live="polite"></p>',
 '<div class="bsp-actions"><button id="bspAdd" type="button">Nieuwe server toevoegen</button>',
 '<button id="bspUpdate" type="button">Profiel bijwerken</button><button id="bspDelete" type="button">Verwijderen</button></div>',
 '<p class="bsp-help">Verbindingen en MAP_SYNC_KEY blijven alleen in de browser van dit apparaat. MAP_WRITE_KEY wordt niet opgeslagen en moet na iedere wissel opnieuw worden ingevoerd.</p>'
].join('');
document.body.appendChild(panel);
const select=$('biServerProfileSelect');
const active=()=>profiles.find(p=>p.id===activeId);
function message(value,error=false){$('bspMessage').textContent=value;$('bspMessage').dataset.error=String(error);}
function draw(){
 select.replaceChildren();
 profiles.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;select.appendChild(o);});
 select.value=activeId;$('bspDelete').disabled=profiles.length<=1;
}
function loadForm(p){
 $('bspName').value=p?.name||'';
 $('bspWorker').value=p?.workerUrl||admin.current().workerUrl||DEFAULT_WORKER;
 $('bspAccess').value=p?.accessKey||'';
 const service=$('bspService');service.replaceChildren();
 const o=document.createElement('option');o.value=p?.serverId||'default';
 o.textContent=p?.serverName||'Verify connection';service.appendChild(o);
 service.disabled=true;mode='unknown';options=[];discoveredKey='';discoveredUrl='';
 message('');
}
function locked(){
 return busy||(window.BUILD_IT_NITRADO_ACTIVE_REQUESTS||0)>0||
  window.BUILD_IT_TOOLS?.isBusy?.()||
  window.BUILD_IT_SPAWN_API?.isBusy?.()||
  window.BUILD_IT_FILE_MANAGER?.isBusy?.()||
  window.BUILD_IT_CUSTOM_BASES_SYNC?.isBusy?.();
}
function close(){if(!busy)panel.hidden=true;}
function open(){
 loadForm(active());
 for(const id of ['filterPanel','logPanel'])$(id)?.classList.add('hidden');
 $('biPanel')?.setAttribute('hidden','');$('toolHubPanel')?.setAttribute('hidden','');
 window.BUILD_IT_QUICK_SPAWN?.close?.();
 panel.hidden=false;
}
$('biServerProfileManage').addEventListener('click',()=>panel.hidden?open():close());
$('bspClose').addEventListener('click',close);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
async function apiCall(url,key,path){
 const response=await fetch(url+path,{cache:'no-store',headers:{Authorization:'Bearer '+key,Accept:'application/json'}});
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.error||value.message||'HTTP '+response.status);
 return value;
}
async function discover(){
 const worker=validUrl($('bspWorker').value),key=$('bspAccess').value.trim();
 if(key.length<8)throw Error('Enter your Worker MAP_SYNC_KEY (at least 8 characters).');
 message('Cloudflare Worker controleren…');
 const data=await apiCall(worker,key,'/api/servers');
 let found;
 if(Array.isArray(data.servers)){
  mode='multi';found=data.servers.filter(x=>x?.id).map(x=>({id:String(x.id),name:String(x.name||x.id)}));
 }else if(data.ok&&Array.isArray(data.endpoints)&&data.endpoints.includes('/api/status')){
  mode='legacy';found=[{id:'default',name:'Vaste server van deze Worker'}];
 }else throw Error('Worker does not expose a compatible Nitrado service list.');
 if(!found.length)throw Error('No accessible services for this Worker.');
 options=found;discoveredUrl=worker;discoveredKey=key;
 const el=$('bspService'),preferred=active()?.workerUrl===worker?active().serverId:'';
 el.replaceChildren();
 found.forEach(item=>{const o=document.createElement('option');o.value=item.id;o.textContent=item.name;el.appendChild(o);});
 if(found.some(v=>v.id===preferred))el.value=preferred;
 el.disabled=found.length===1;
 message('Verbinding gevonden. Selecteer de juiste server en sla op.');
}
$('bspDiscover').addEventListener('click',async()=>{
 if(busy)return;busy=true;
 try{await discover();}catch(e){message(e.message,true);}
 finally{busy=false;}
});
async function candidate(){
 const name=$('bspName').value.trim();
 if(name.length<2||name.length>70)throw Error('Enter a server name (2–70 characters).');
 const worker=validUrl($('bspWorker').value),key=$('bspAccess').value.trim();
 if(mode==='unknown'||discoveredUrl!==worker||discoveredKey!==key)await discover();
 const serverId=$('bspService').value;
 if(!options.some(o=>o.id===serverId))throw Error('Select a verified Nitrado service.');
 const query=mode==='multi'?'?server='+encodeURIComponent(serverId):'';
 const result=await apiCall(worker,key,'/api/status'+query);
 if(!result.ok)throw Error('Worker did not confirm the server identity.');
 if(mode==='multi'&&(!result.serviceId||!result.username))
  throw Error('The multi-server Worker must identify serviceId and username before file editing is safe.');
 return{ name,workerUrl:worker,accessKey:key,serverId,workerMode:mode,
  serviceId:String(result.serviceId||''),serverName:String(result.serverName||result.game||serverId),
  username:String(result.username||''),autoSync:true};
}
async function changeTo(id,{force=false}={}){
 if(locked())throw Error('Wisselen is geblokkeerd zolang een Nitrado-verzoek of upload loopt.');
 const profile=profiles.find(p=>p.id===id);
 if(!profile)throw Error('Server profile not found.');
 if(!force&&activeId===id)return;
 const previous=activeId;
 activeId=id;draw();
 window.BUILD_IT_NITRADO_PROFILE_EPOCH=(window.BUILD_IT_NITRADO_PROFILE_EPOCH||0)+1;
 window.dispatchEvent(new CustomEvent('buildit:nitrado-profile-changing',{detail:{profileId:id}}));
 try{
  const verified=await admin.switchTo(profile);
  if(profile.serviceId&&verified.status?.serviceId&&String(verified.status.serviceId)!==profile.serviceId)
   throw Error('Different Nitrado service detected. Profile is locked.');
  storage();
  window.dispatchEvent(new CustomEvent('buildit:nitrado-profile-changed',{
   detail:{profileId:id,name:profile.name}
  }));
  message('Actieve server: '+profile.name);
 }catch(e){
  const previousProfile=profiles.find(p=>p.id===previous);
  // Restore both the visible profile and its connection, not only the label.
  if(previousProfile&&previous!==id){
   activeId=previous;
   draw();
   window.BUILD_IT_NITRADO_PROFILE_EPOCH=(window.BUILD_IT_NITRADO_PROFILE_EPOCH||0)+1;
   window.dispatchEvent(new CustomEvent('buildit:nitrado-profile-changing',
     {detail:{profileId:previous}}));
   try{
    await admin.switchTo(previousProfile);
    window.dispatchEvent(new CustomEvent('buildit:nitrado-profile-changed',
      {detail:{profileId:previous,name:previousProfile.name}}));
   }catch(_){$('nitradoServer').disabled=true;}
  }else $('nitradoServer').disabled=true;
  message('Server niet geverifieerd: '+e.message,true);
  throw e;
 }
}
select.addEventListener('change',()=>{
 const id=select.value;
 changeTo(id).catch(e=>{select.value=activeId;message(e.message,true);});
});
async function saveProfile(update){
 if(locked())return message('Er loopt een serveractie. Probeer daarna opnieuw.',true);
 const before=activeId;
 let backup=null,createdId='';
 busy=true;
 try{
  const next=await candidate();
  const duplicate=profiles.find(p=>(!update||p.id!==activeId)&&
    p.workerUrl===next.workerUrl&&p.serverId===next.serverId);
  if(duplicate)throw Error('Deze Nitrado-service staat al onder "'+duplicate.name+'".');
  let target;
  if(update){
   const existing=active();if(!existing)throw Error('No active profile.');
   backup={...existing};Object.assign(existing,next);target=existing.id;
  }else{
   if(profiles.length>=20)throw Error('Maximum 20 profiles per browser.');
   const added={id:crypto.randomUUID(),...next};
   profiles.push(added);createdId=added.id;target=added.id;
  }
  busy=false;
  await changeTo(target,{force:update});
  draw();loadForm(active());message('Profiel opgeslagen en actief.');
 }catch(e){
  if(createdId)profiles=profiles.filter(p=>p.id!==createdId);
  if(backup){const previous=profiles.find(p=>p.id===backup.id);if(previous)Object.assign(previous,backup);}
  if(before&&profiles.some(p=>p.id===before)){
    activeId=before;storage();draw();
    if(!locked()){try{await changeTo(before,{force:true});}catch(_){}}
  }
  message('Opslaan mislukt: '+e.message,true);
 }finally{busy=false;}
}
$('bspAdd').addEventListener('click',()=>void saveProfile(false));
$('bspUpdate').addEventListener('click',()=>void saveProfile(true));
$('bspDelete').addEventListener('click',async()=>{
 if(locked())return message('Er loopt nog een serveractie.',true);
 if(profiles.length<=1)return;
 const current=active();
 if(!confirm('Verwijder "'+current.name+'" van dit apparaat? Er worden geen Nitrado-bestanden verwijderd.'))return;
 profiles=profiles.filter(p=>p.id!==activeId);
 activeId='';storage();draw();
 try{await changeTo(profiles[0].id);}catch(e){message(e.message,true);}
 loadForm(active());
});
init();draw();
window.BUILD_IT_EVENT_DRAFTS?.bindInitial(activeId,profiles.length===1);
window.BUILD_IT_NITRADO_PROFILES=Object.freeze({
 current:()=>active()&&{id:active().id,name:active().name,serverId:active().serverId,serviceId:active().serviceId},
 list:()=>profiles.map(p=>({id:p.id,name:p.name,serverName:p.serverName})),
 select:id=>changeTo(id),
 connectionMatches:()=>{
  const p=active(),c=admin.current();
  return !!p&&p.workerUrl===c.workerUrl&&p.accessKey===c.accessKey&&
    (p.serverId==='default'||p.serverId===c.serverId);
 }
});
for(const id of ['nitradoWorkerUrl','nitradoAccessKey','nitradoServer']){
 $(id)?.addEventListener('change',()=>{
  if(!window.BUILD_IT_NITRADO_PROFILES.connectionMatches()){
   message('Nitrado-verbinding wijkt af van het gekozen profiel. Sla de wijzigingen op via Manage.',true);
   $('nitradoSyncStatus').textContent='Connection differs from saved profile. Server file edits are blocked.';
  }
 });
}
const now=admin.current(),profile=active();
if(profile&&(profile.workerUrl!==now.workerUrl||profile.accessKey!==now.accessKey||
 (profile.serverId!=='default'&&profile.serverId!==now.serverId))){
 const activate=()=>{
  if((window.BUILD_IT_NITRADO_ACTIVE_REQUESTS||0)>0){setTimeout(activate,100);return;}
  changeTo(profile.id,{force:true}).catch(e=>message(e.message,true));
 };
 setTimeout(activate,0);
}
})();