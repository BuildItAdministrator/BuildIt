/* Shared world metadata. Coordinates are metres from the south-west corner. */
(function(root){
 'use strict';
 const maps=Object.freeze({
  chernarus:Object.freeze({id:'chernarus',name:'Chernarus',mission:'dayzOffline.chernarusplus',size:15360}),
  livonia:Object.freeze({id:'livonia',name:'Livonia',mission:'dayzOffline.enoch',size:12800}),
  nasdara:Object.freeze({id:'nasdara',name:'Nasdara',mission:'dayzOffline.nasdara',size:16384}),
  sakhal:Object.freeze({id:'sakhal',name:'Sakhal',mission:'dayzOffline.sakhal',size:15360})
 });
 const parse=(key,fallback)=>{try{return JSON.parse(root.localStorage.getItem(key))||fallback}catch{return fallback}};
 function scope(){
  if(root.BUILD_IT_STAGE4_BOOT?.serviceId)return 'service:'+root.BUILD_IT_STAGE4_BOOT.serviceId;
  const saved=parse('buildit_nitrado_profiles_v1',{});
  const p=saved.profiles?.find(p=>p.id===saved.activeId)||parse('buildit_nitrado_sync_v1',{});
  return p.workerUrl?String(p.workerUrl)+'|'+String(p.serverId||'default'):'offline';
 }
 const key=()=> 'buildit_world_v1:'+scope();
 function selected(){try{const id=root.localStorage.getItem(key());return maps[id]||maps.chernarus}catch{return maps.chernarus}}
 const current=selected();
 function select(id){if(!Object.hasOwn(maps,id))throw Error('Unknown map');root.localStorage.setItem(key(),id);}
 function valid(x,z,world=current){return Number.isFinite(x)&&Number.isFinite(z)&&x>=0&&z>=0&&x<=world.size&&z<=world.size;}
 function toLeaflet(x,z,world=current){return [z/world.size*256-256,x/world.size*256];}
 function fromLeaflet(ll,world=current){return {x:ll.lng/256*world.size,z:(ll.lat+256)/256*world.size};}
 const missionPaths=()=>['dayzps_missions/','mpmissions/'].map(p=>p+current.mission);
 const draftKey=(base,profile)=>base+':'+profile+':'+current.id;
 root.BUILD_IT_MAPS=Object.freeze({maps,current,scope,selected,select,valid,toLeaflet,fromLeaflet,missionPaths,draftKey});
})(typeof window==='undefined'?globalThis:window);
