/* BuildItPlus Server Doctor: read-only checks on a connected DayZ mission.
   Never uploads, repairs, restarts or stores server files. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
if($('bwDoctorPanel'))return;
const panel=document.createElement('section');
panel.id='bwDoctorPanel';panel.hidden=true;
panel.setAttribute('role','region');panel.setAttribute('aria-label','Server Doctor');
panel.innerHTML='<div class="bw-doctor-head"><div><strong>Server doctor</strong><p>Check key mission files before publishing changes.</p></div><button id="bwDoctorClose" type="button" aria-label="Close server doctor">×</button></div>'+
 '<div class="bw-doctor-actions"><button type="button" id="bwDoctorRun">Scan connected server</button><span id="bwDoctorState" role="status" aria-live="polite">Ready to scan. No files will be changed.</span></div>'+
 '<div id="bwDoctorStats" class="bw-doctor-stats" hidden></div>'+
 '<div id="bwDoctorResults" class="bw-doctor-results"><p class="bw-doctor-empty">Uses the current Nitrado connection. Checks file format and a selection of cross-file references.</p></div>'+
 '<p class="bw-doctor-foot">A passing scan confirms only the checks listed here; it does not guarantee that all DayZ gameplay rules or custom classnames are valid.</p>';
document.body.appendChild(panel);
const run=$('bwDoctorRun'),results=$('bwDoctorResults'),state=$('bwDoctorState'),stats=$('bwDoctorStats');
const IMPORTANT=[
 'db/types.xml','db/events.xml','db/globals.xml','db/messages.xml',
 'cfgeventspawns.xml','cfgspawnabletypes.xml','cfggameplay.json',
 'cfgplayerspawnpoints.xml','cfgweather.xml','cfgEffectArea.json',
 'env/zombie_territories.xml'
];
let busy=false;
function row(level,name,message){
 const wrap=document.createElement('div');
 wrap.className='bw-doctor-row bw-doctor-'+level;
 const top=document.createElement('div');top.className='bw-doctor-row-head';
 const tag=document.createElement('span');tag.className='bw-doctor-tag';tag.textContent=level==='ok'?'PASS':level==='warn'?'CHECK':'ERROR';
 const title=document.createElement('strong');title.textContent=name;
 top.append(tag,title);
 const detail=document.createElement('p');detail.textContent=message;
 wrap.append(top,detail);results.appendChild(wrap);
}
function xmlEvents(doc){
 return new Set([...doc.getElementsByTagName('event')]
   .map(el=>el.getAttribute('name')).filter(Boolean));
}
function parseXml(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Invalid XML');
 return doc;
}
function refs(gameplay){
 const refs=[];
 for(const value of [gameplay?.objectSpawnersArr,gameplay?.PlayerData?.spawnGearPresetFiles]){
  if(Array.isArray(value))for(const item of value)if(typeof item==='string'&&item.trim())refs.push(item);
 }
 return refs;
}
async function scan(){
 if(busy)return;
 const bridge=window.BUILD_IT_SERVER_FILES,validator=window.BUILD_IT_FORMAT;
 if(!bridge?.available||!bridge?.read||!validator?.validate){
  state.textContent='Nitrado file connection is unavailable. Connect your server in Server profiles first.';
  return;
 }
 busy=true;run.disabled=true;stats.hidden=true;results.replaceChildren();state.textContent='Reading mission file listing…';
 let pass=0,warning=0,fail=0;
 const info={};
 try{
  const listed=await bridge.available();
  const byLower=new Map(listed.map(v=>[v.relative.toLowerCase(),v.relative]));
  const list=IMPORTANT.filter(file=>byLower.has(file.toLowerCase()));
  if(!list.length)throw Error('No standard DayZ mission files were found on this server.');
  for(let i=0;i<list.length;i++){
   const expected=list[i],actual=byLower.get(expected.toLowerCase());
   state.textContent='Checking '+(i+1)+' of '+list.length+' files…';
   try{
    const file=await bridge.read(actual);
    const result=validator.validate(actual,file.content);
    info[expected]={content:file.content};
    row('ok',actual,result.detail||'Format validated');
    pass++;
   }catch(e){
    row('error',actual,e.message||'Could not read or validate this file.');
    fail++;
   }
  }
  if(!byLower.has('db/events.xml')){warning++;row('warn','events.xml','Not found in the current mission listing.');}
  if(!byLower.has('cfgeventspawns.xml')){warning++;row('warn','cfgeventspawns.xml','Not found in the current mission listing.');}
  if(info['db/events.xml']&&info['cfgeventspawns.xml']){
   try{
    const events=xmlEvents(parseXml(info['db/events.xml'].content));
    const spawns=xmlEvents(parseXml(info['cfgeventspawns.xml'].content));
    const missing=[...spawns].filter(name=>!events.has(name)).slice(0,15);
    if(missing.length){
     warning++;
     row('warn','Event references',missing.join(', ')+(spawns.size-missing.length>15?' …':'')+' occur in spawn positions but not in events.xml. Review whether these are intentional custom entries.');
    }else{pass++;row('ok','Event references','All named event-spawn groups are present in events.xml.');}
   }catch(error){warning++;row('warn','Event references','Could not complete cross-file check: '+error.message);}
  }
  if(info['cfggameplay.json']){
   try{
    const gameplay=JSON.parse(info['cfggameplay.json'].content);
    const missing=refs(gameplay).map(v=>v.replace(/\\/g,'/').replace(/^\.\//,'').replace(/^\//,''))
      .filter(v=>!byLower.has(v.toLowerCase()));
    if(missing.length){
     warning++;
     row('warn','Gameplay file references',missing.slice(0,12).join(', ')+' were not found in the mission listing. Check any custom folders or paths.');
    }else{pass++;row('ok','Gameplay file references','No missing supported mission-file references detected.');}
   }catch(e){warning++;row('warn','Gameplay file references','Could not inspect file references: '+e.message);}
  }
  stats.hidden=false;stats.textContent=pass+' passed · '+warning+' to review · '+fail+' failed';
  state.textContent=fail?'Scan complete — fix file errors before publishing.':
   warning?'Scan complete — review the warnings.':'Scan complete — no issues found by these checks.';
 }catch(error){
  row('error','Scan could not finish',error.message||'Check the selected Nitrado server and reconnect.');
  state.textContent='Scan stopped.';fail++;
 }finally{
  busy=false;run.disabled=false;
 }
}
run.addEventListener('click',scan);
$('bwDoctorClose').addEventListener('click',()=>window.BUILD_IT_WORKSPACE?.navigate('map'));
const api={
 open(){panel.hidden=false;},
 close(){panel.hidden=true;},
 isOpen(){return !panel.hidden;}
};
window.BUILD_IT_SERVER_DOCTOR=Object.freeze(api);
})();