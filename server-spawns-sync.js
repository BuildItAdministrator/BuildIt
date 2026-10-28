/* Render active Nitrado server event positions in existing Chernarus spawn layers. */
(function(){
'use strict';
if(typeof window.BUILD_IT_replaceSpawnGroups!=='function')return;
const filter=document.getElementById('filterPanel');
const status=document.createElement('div');
status.id='biServerSpawnsStatus';status.className='filter-note';
status.setAttribute('role','status');status.setAttribute('aria-live','polite');
status.textContent='Spawn markers use the selected Nitrado server after connection.';
filter?.appendChild(status);
let epoch=0,busy=false;
function tell(message,error=false){status.textContent=message;status.style.color=error?'#ee9b9b':'';}
function groupsFromXml(source){
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement?.nodeName!=='eventposdef')
  throw Error('cfgeventspawns.xml does not contain valid <eventposdef> data.');
 const groups=[];
 let total=0;
 for(const item of doc.documentElement.children){
  if(item.nodeName!=='event')continue;
  const name=item.getAttribute('name');
  if(!name)continue;
  const positions=[];
  for(const pos of item.children){
   if(pos.nodeName!=='pos')continue;
   const x=Number(pos.getAttribute('x')),z=Number(pos.getAttribute('z'));
   if(!Number.isFinite(x)||!Number.isFinite(z)||x<0||z<0||x>15360||z>15360)continue;
   const a=pos.hasAttribute('a')?Number(pos.getAttribute('a')):null;
   const y=pos.hasAttribute('y')?Number(pos.getAttribute('y')):null;
   positions.push([x,z,Number.isFinite(a)?a:null,Number.isFinite(y)?y:null]);
   if(++total>20000)throw Error('Server has more than 20,000 event positions. Refusing to overload the map.');
  }
  if(positions.length)groups.push({name,positions});
 }
 return {groups,total};
}
async function reload(){
 if(busy)return;
 const active=++epoch;
 busy=true;
 try{
  tell('Loading live event spawn positions…');
  const bridge=window.BUILD_IT_SERVER_FILES;
  if(!bridge)throw Error('Nitrado file bridge is unavailable.');
  const data=await bridge.read('cfgeventspawns.xml');
  if(active!==epoch)return;
  const parsed=groupsFromXml(data.content);
  const count=window.BUILD_IT_replaceSpawnGroups(parsed.groups);
  tell('Live Nitrado event positions: '+count+' spawns in '+parsed.groups.length+' event groups.');
 }catch(error){
  if(active!==epoch)return;
  window.BUILD_IT_replaceSpawnGroups([]);
  tell('Could not load the selected server’s spawn locations: '+error.message,true);
 }finally{busy=false;}
}
window.addEventListener('buildit:nitrado-profile-changing',()=>{
 epoch++;
 window.BUILD_IT_replaceSpawnGroups([]);
 tell('Server changed. Old spawn positions cleared.');
});
window.addEventListener('buildit:nitrado-profile-changed',()=>{void reload();});
window.BUILD_IT_SERVER_SPAWNS=Object.freeze({
 refresh:reload,
 isBusy:()=>busy,
 parse:groupsFromXml
});
})();
