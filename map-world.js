/* Keep the existing Leaflet tools over the official dzbot SDK viewer. */
(function(){
 'use strict';
 const worlds=window.BUILD_IT_MAPS,world=worlds.current;
 const control=L.Control.extend({options:{position:'topleft'},onAdd(){
  const box=L.DomUtil.create('div','leaflet-bar buildit-world-control');
  const select=L.DomUtil.create('select','',box);select.id='builditWorldSelect';select.setAttribute('aria-label','Server map');
  for(const item of Object.values(worlds.maps)){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);}
  select.value=world.id;select.title='Choose the map running on this server';
  L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box);
  const pending=document.createElement('div');pending.hidden=true;pending.style.cssText='padding:8px;max-width:180px;background:#17242b;color:white;font:12px Arial';
  const note=document.createElement('p');note.textContent='Choose the map running on this server. Applying reloads the page. Export unsaved editor changes first.';
  const apply=document.createElement('button');apply.type='button';apply.textContent='Apply map';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
  pending.append(note,apply,cancel);box.append(pending);
  select.addEventListener('change',()=>{pending.hidden=select.value===world.id;});
  cancel.addEventListener('click',()=>{select.value=world.id;pending.hidden=true;});
  apply.addEventListener('click',()=>{
   if((window.BUILD_IT_NITRADO_ACTIVE_REQUESTS||0)>0||window.BUILD_IT_TOOLS?.isBusy?.()||window.BUILD_IT_SPAWN_API?.isBusy?.()||window.BUILD_IT_FILE_MANAGER?.isBusy?.()||window.BUILD_IT_CUSTOM_BASES_SYNC?.isBusy?.()){
    note.textContent='Wait for the server action to finish before changing maps.';return;
   }
   try{worlds.select(select.value);location.reload()}catch(e){note.textContent='Map selection could not be saved: '+e.message;}
  });return box;
 }});new control().addTo(map);
 const style=document.createElement('style');style.textContent='.buildit-world-control select{max-width:150px;padding:9px 10px;border:0;border-radius:5px;background:var(--panel,#17242b);color:var(--text,#fff);font:600 13px Arial}.buildit-sdk-map{position:absolute;inset:0;z-index:0;pointer-events:none}.buildit-map-error{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:850;background:#772c20;color:white;padding:10px;border-radius:6px;max-width:300px;font:13px Arial}';document.head.append(style);
 // Register before server-sync listeners: never reuse another world's in-memory view.
 window.addEventListener('buildit:nitrado-profile-changed',event=>{
  if(worlds.selected().id!==world.id){event.stopImmediatePropagation();location.reload();}
 });
 if(world.id==='chernarus')return;
 const host=document.createElement('div');host.className='buildit-sdk-map';
 host.dataset.dzmap=world.id;host.dataset.controls='';host.dataset.placeNames='';host.dataset.zoom=String(Math.max(1,map.getZoom()));host.dataset.center=world.size/2+','+world.size/2;
 map.getContainer().prepend(host);
 let sdk=null,lastNames='';
 const error=document.createElement('div');error.className='buildit-map-error';error.setAttribute('role','status');error.textContent='Loading '+world.name+' map…';map.getContainer().append(error);
 const fail=()=>{error.hidden=false;error.textContent=world.name+' map unavailable. Check your connection and reload.';};
 const timeout=setTimeout(fail,20000);
 host.addEventListener('dzmap:ready',event=>{
  sdk=event.detail;clearTimeout(timeout);
  if(sdk.getSize()!==world.size){sdk.destroy();fail();return;}
  host.querySelector('[tabindex]')?.setAttribute('tabindex','-1');
  map.setMinZoom(sdk.getMinZoom());map.setMaxZoom(sdk.getMaxZoom());
  map.attributionControl.addAttribution('Maps © <a href="https://dzbot.de" target="_blank" rel="noopener">dzbot.de</a>');
  function sync(){const p=leafletToGame(map.getCenter());sdk.setView([p.x,p.z],map.getZoom());}
  map.on('move zoom resize',sync);sync();
  const syncLabels=()=>sdk.setPlaceNamesVisible(map.hasLayer(labels));
  map.on('layeradd layerremove',syncLabels);syncLabels();
  sdk.setTileType(currentMapStyle==='topographic'?'top':'sat');
  map.on('buildit:map-style-change',e=>sdk.setTileType(e.style==='topographic'?'top':'sat'));
  error.hidden=true;
  sdk.on('render',()=>{
   const places=sdk.searchables();const signature=places.length+':'+(places[0]?.label||'');if(signature===lastNames)return;lastNames=signature;
   placeSearchIndex.length=0;
   for(const p of places){if(worlds.valid(p.at[0],p.at[1]))placeSearchIndex.push({x:p.at[0],z:p.at[1],lat:p.label,cyr:'',type:'local',search:normalizePlaceSearch(p.label)});}
   placeSearchInput.disabled=!placeSearchIndex.length;placeSearchInput.placeholder=placeSearchIndex.length?'Search places…':'Place search unavailable';
  });
 });
 // SDK owns tile loading and attribution; tiles are never downloaded or rehosted by Build It.
 const script=document.createElement('script');script.src='https://map.dzbot.de/sdk/v1/dzmap.js';script.async=true;script.onerror=fail;document.head.append(script);
})();
