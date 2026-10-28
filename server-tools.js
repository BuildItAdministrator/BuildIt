/* Build It!++ — compact DayZ console tools hub.
 * 53-item roadmap; only working tools have an action.
 * Server-connected tools use the shared authenticated read/write bridge.
 */
(function(){
'use strict';
const C=[
 ['Config & gameplay',['Day/Night Calculator','Weather Manager','Gameplay Generator','Messages Generator','Globals Configurator','Nitrado Settings Generator']],
 ['Validation & files',['XML Validator','JSON Validator','JSON Splitter','Mission Validator ZIP','Event Conflict Check','Spawnable Duplicate Checker','SpawnObject Duplicate Checker']],
 ['Loot & economy',['Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer','Tier Booster','Types Organizer','Spawnable Types Adjuster','Classname Finder','Ignore List Generator','Loot & Proxy Calculator']],
 ['Events & vehicles',['Events Organizer','Build A Vehicle','Event Group Calculator','Vehicle Event Remover','Gas Zone Generator','Horde Generator','NPC Generator','Airstrike Generator']],
 ['World & map',['Spawn Point Generator','Loot Exclusion Zone Generator','INIT.C To ObjectSpawner','SpawnObject Converter','MapGroupPos Converter','MapGroupPos To SpawnObject','PRA Converter','Object To MapGroupPos Converter','SpawnObject Mover','SpawnObject Organizer','JSON To Init.c Converter','Underground Areas','Environment Exclusion Generator','Territory Zone Creator','MapGroupPos Organizer','Build Relocator','Sky Writing Generator','SpawnObject Heatmap']],
 ['Equipment & effects',['Loadout Generator','Weapon Blueprint Generator','Bag Fill Generator','CfgEffect Converter']]
];
const TOOLS=C.flatMap(([group,names])=>names.map(name=>({name,group})));
const ACTIVE=new Set(['XML Validator','JSON Validator','Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer','Event Conflict Check','Globals Configurator','Spawnable Duplicate Checker','SpawnObject Duplicate Checker','Messages Generator','Tier Booster','Classname Finder','Spawnable Types Adjuster','Gameplay Generator','Weather Manager','Spawn Point Generator','SpawnObject Mover','SpawnObject Organizer','SpawnObject Heatmap','Event Group Calculator']);
const RELATED={'Events Organizer':'biToggle','Build A Vehicle':'biToggle'};
const ROOT=document.createElement('div');ROOT.id='serverToolsRoot';
ROOT.innerHTML=`
<button type="button" id="toolHubToggle" aria-haspopup="dialog" aria-expanded="false" aria-controls="toolHubPanel">Server Tools <span class="st-count">${ACTIVE.size} connected · ${TOOLS.length} listed</span></button>
<section id="toolHubPanel" hidden role="dialog" aria-label="DayZ Server Tools">
 <header class="st-header">
   <div><strong>Server Tools</strong><small>Console configuration studio · ${TOOLS.length} catalogued</small></div>
   <button type="button" id="toolHubClose" aria-label="Close Server Tools">×</button>
 </header>
 <div class="st-toolbar">
   <label class="st-field"><span>Find a tool</span><input id="stSearch" type="search" autocomplete="off" placeholder="Search all ${TOOLS.length} tools…"></label>
   <label class="st-field"><span>Category</span><select id="stCategory"><option value="">All categories</option>${C.map(([name])=>'<option>'+name+'</option>').join('')}</select></label>
 </div>
 <div class="st-summary">Every active tool reads your Nitrado server files directly. Changes are previewed, checked and backed up before being published. No manual imports or exports.</div>
 <div id="stCards" class="st-cards" aria-live="polite"></div>
 <div id="stWorkspace" class="st-workspace" hidden>
   <div class="st-work-head"><strong id="stWorkTitle"></strong><button type="button" id="stBack">Back to tools</button></div>
   <p id="stHelp" class="st-help"></p>
   <label class="st-field"><span>File on Nitrado</span><select id="stRemoteFile"></select></label>
   <div class="st-actions"><button id="stReload" type="button">Refresh from Nitrado</button><span id="stFileState" class="st-help" role="status" aria-live="polite"></span></div>
   <div id="stParameters" class="st-params" hidden>
     <label class="st-field"><span>Modify</span><select id="stField"><option value="nominal">Nominal amount</option><option value="min">Minimum amount</option><option value="lifetime">Lifetime (seconds)</option><option value="restock">Restock (seconds)</option><option value="quantmin">Quantity minimum</option><option value="quantmax">Quantity maximum</option><option value="cost">Cost</option></select></label>
     <label class="st-field"><span id="stValueLabel">Multiplier</span><input type="number" id="stValue" value="2" min="0" max="1000" step="0.1"></label>
     <label class="st-field st-wide"><span>Classname filter (optional)</span><input id="stClassname" type="text" placeholder="Empty applies to all types"></label>
   </div>
   <div id="stGlobalControls" class="st-params" hidden><label class="st-field"><span>Existing global</span><select id="stGlobalName"></select></label><label class="st-field"><span>New numeric value</span><input type="number" id="stGlobalValue" step="any"></label></div>
   <div id="stMessageControls" class="st-params" hidden><label class="st-field st-wide"><span>Server message (max 160 characters)</span><textarea id="stMessageText" maxlength="160" rows="3" placeholder="Welcome to our DayZ server!"></textarea></label><label class="st-field"><span>Repeat (minutes)</span><input id="stMessageInterval" type="number" min="1" max="1440" step="1" value="30"></label></div>
   <div id="stTierControls" class="st-params" hidden><label class="st-field"><span>Explicit loot tier</span><select id="stTier"><option>Tier1</option><option>Tier2</option><option>Tier3</option><option>Tier4</option></select></label><label class="st-field"><span>Nominal multiplier</span><input id="stTierFactor" type="number" min="1" max="1000" step="0.1" value="2"></label></div>
   <div id="stClassSearchControls" class="st-params" hidden><label class="st-field st-wide"><span>Search actual server classnames</span><input id="stClassSearch" type="search" autocomplete="off" placeholder="e.g. M4A1, Apple, Offroad"></label></div>
   <div id="stSpawnableControls" class="st-params" hidden><label class="st-field st-wide"><span>Exact existing classname</span><input id="stSpawnableName" type="text" placeholder="e.g. Offroad_02_Beige"></label><label class="st-field"><span>Existing section</span><select id="stSpawnableSection"><option value="attachments">Attachments</option><option value="cargo">Cargo</option></select></label><label class="st-field"><span>Chance (0–1)</span><input id="stSpawnableChance" type="number" min="0" max="1" step="0.05" value="1"></label></div>
   <div id="stGameplayControls" class="st-params" hidden><label class="st-field st-wide"><span>Existing gameplay setting</span><select id="stGameplayPath"></select></label><label class="st-field st-wide"><span>New value</span><input id="stGameplayValue" type="text" placeholder="true, false or a number"></label></div>
   <div id="stWeatherControls" class="st-params" hidden><label class="st-field st-wide"><span>Existing weather parameter</span><select id="stWeatherPath"></select></label><label class="st-field st-wide"><span>Value (0–1)</span><input id="stWeatherValue" type="number" min="0" max="1" step="0.05"></label></div>
   <div id="stObjectMoveControls" class="st-params" hidden><label class="st-field st-wide"><span>Object from server file</span><select id="stObjectIndex"></select></label><label class="st-field"><span>X</span><input id="stObjectX" type="number" min="0" max="15360" step="0.01"></label><label class="st-field"><span>Z</span><input id="stObjectZ" type="number" min="0" max="15360" step="0.01"></label></div>
   <div id="stPlayerSpawnControls" class="st-params" hidden><label class="st-field"><span>Spawn X</span><input id="stPlayerX" type="number" min="0" max="15360" step="0.01"></label><label class="st-field"><span>Spawn Z</span><input id="stPlayerZ" type="number" min="0" max="15360" step="0.01"></label></div>
   <div id="stMapControls" class="st-actions" hidden><button id="stPickMap" type="button">Pick on map</button><span class="st-help">Optional map selection for X/Z.</span></div>
   <div id="stHeatmapControls" class="st-actions" hidden><button id="stShowHeatmap" type="button">Show density on map</button><button id="stClearHeatmap" type="button">Clear heatmap</button></div>
   <div class="st-actions"><button id="stRun" type="button" disabled>Check / Preview</button><button id="stPublish" type="button" hidden disabled>Apply to Nitrado</button></div>
   <pre id="stResult" class="st-result" role="status" aria-live="polite"></pre>
   <details class="st-settings"><summary>Connection · MAP_WRITE_KEY</summary><p class="st-help">Use the same write key as the File Manager. This key is never saved.</p><label class="st-field"><span>Write key</span><input id="stWriteKey" type="password" autocomplete="off" placeholder="MAP_WRITE_KEY"></label></details>
 </div>
</section>`;
document.body.appendChild(ROOT);
const $=id=>ROOT.querySelector('#'+id);
const panel=$('toolHubPanel'),cards=$('stCards'),workspace=$('stWorkspace');
let selected=null,snapshot=null,preview=null,busy=false,remoteList=[],heatLayer=null;
const bridge=window.BUILD_IT_SERVER_FILES,core=window.BUILD_IT_SERVER_CORE,ext=window.BUILD_IT_SERVER_EXTENSIONS;
if(!bridge||!core||!ext)throw new Error('Server Tools dependencies not ready.');
const DEFAULTS={
 'XML Validator':'db/types.xml',
 'JSON Validator':'cfggameplay.json',
 'Types Booster':'db/types.xml',
 'Types Reducer':'db/types.xml',
 'Advanced Types Editor':'db/types.xml',
 'Lifetime Reducer':'db/types.xml',
 'Event Conflict Check':'db/events.xml',
 'Globals Configurator':'db/globals.xml',
 'Spawnable Duplicate Checker':'cfgspawnabletypes.xml',
 'SpawnObject Duplicate Checker':'custom/builditlootdrop.json',
 'Messages Generator':'db/messages.xml',
 'Tier Booster':'db/types.xml',
 'Classname Finder':'db/types.xml',
 'Spawnable Types Adjuster':'cfgspawnabletypes.xml',
 'Gameplay Generator':'cfggameplay.json',
 'Weather Manager':'cfgweather.xml',
 'Spawn Point Generator':'cfgplayerspawnpoints.xml',
 'SpawnObject Mover':'custom/builditlootdrop.json',
 'SpawnObject Organizer':'custom/builditlootdrop.json',
 'SpawnObject Heatmap':'custom/builditlootdrop.json',
 'Event Group Calculator':'cfgeventspawns.xml'
};
const EDITORS=new Set(['Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer','Globals Configurator','Messages Generator','Spawnable Types Adjuster','Gameplay Generator','Weather Manager','Spawn Point Generator','SpawnObject Mover','SpawnObject Organizer']);
function setStatus(text,error=false){
 $('stResult').textContent=text;$('stResult').dataset.error=String(error);
}
function invalidate(){
 preview=null;$('stPublish').hidden=true;$('stPublish').disabled=true;
}
function setBusy(value){
 busy=value;
 for(const id of ['stRemoteFile','stReload','stField','stValue','stClassname','stGlobalName','stGlobalValue','stMessageText','stMessageInterval','stTier','stTierFactor','stClassSearch','stSpawnableName','stSpawnableSection','stSpawnableChance','stGameplayPath','stGameplayValue','stWeatherPath','stWeatherValue','stObjectIndex','stObjectX','stObjectZ','stPlayerX','stPlayerZ','stPickMap']){
   $(id).disabled=value;
 }
 $('stRun').disabled=value||!snapshot;
 $('stPublish').disabled=value||!preview;
}
function open(){
 panel.hidden=false;$('toolHubToggle').setAttribute('aria-expanded','true');
 document.getElementById('biPanel')?.setAttribute('hidden','');
 window.BUILD_IT_QUICK_SPAWN?.close?.();
 for(const id of ['filterPanel','logPanel'])document.getElementById(id)?.classList.add('hidden');
}
function close(){
 if(busy)return;
 panel.hidden=true;$('toolHubToggle').setAttribute('aria-expanded','false');
}
$('toolHubToggle').addEventListener('click',()=>panel.hidden?open():close());
$('toolHubClose').addEventListener('click',close);
for(const id of ['filterToggle','logToggle','biToggle']){
 document.getElementById(id)?.addEventListener('click',close);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
function render(){
 const search=$('stSearch').value.trim().toLowerCase(),category=$('stCategory').value;
 cards.replaceChildren();
 let shown=0;
 for(const tool of TOOLS){
   if(category&&tool.group!==category)continue;
   if(search&&!tool.name.toLowerCase().includes(search)&&!tool.group.toLowerCase().includes(search))continue;
   shown++;
   const ready=ACTIVE.has(tool.name),related=RELATED[tool.name];
   const card=document.createElement('div');card.className='st-card'+(ready?' st-ready':'');
   const title=document.createElement('strong');title.textContent=tool.name;
   const meta=document.createElement('small');
   meta.textContent=tool.group+' · '+(ready?'Connected to Nitrado':related?'Partial in Advanced Events':'Planned — server integration not ready');
   card.append(title,meta);
   if(ready||related){
     const btn=document.createElement('button');btn.type='button';
     btn.textContent=ready?'Open tool':'Advanced editor';
     btn.addEventListener('click',()=>{
       if(ready)void choose(tool.name);
       else{close();window.BUILD_IT_SPAWN_API?.advanced?.();}
     });
     card.appendChild(btn);
   }
   cards.appendChild(card);
 }
 if(!shown){const p=document.createElement('p');p.className='st-help';p.textContent='No matching tools.';cards.appendChild(p);}
}
$('stSearch').addEventListener('input',render);
$('stCategory').addEventListener('change',render);
function toolFiles(){
 return remoteList.filter(file=>{
   if(selected==='JSON Validator')return file.relative.endsWith('.json');
   if(selected==='XML Validator')return file.relative.endsWith('.xml');
   if(['SpawnObject Duplicate Checker','SpawnObject Mover','SpawnObject Organizer','SpawnObject Heatmap'].includes(selected))return file.relative.startsWith('custom/')&&file.relative.endsWith('.json');
   if(selected==='Weather Manager')return file.relative==='cfgweather.xml';
   if(selected==='Messages Generator')return ['db/messages.xml','messages.xml'].includes(file.relative);
   return file.relative===DEFAULTS[selected];
 });
}
async function refreshCatalog(){
 remoteList=await bridge.available();
 const select=$('stRemoteFile');select.replaceChildren();
 const matches=toolFiles();
 for(const file of matches){
   const option=document.createElement('option');option.value=file.relative;
   option.textContent=file.relative+(file.size?' · '+Math.ceil(file.size/1024)+' KB':'');
   select.appendChild(option);
 }
 if(matches.some(f=>f.relative===DEFAULTS[selected]))select.value=DEFAULTS[selected];
 if(!matches.length)throw new Error('Required file '+(DEFAULTS[selected]||'')+' not found on Nitrado. No replacement file will be created.');
}
function fillGameplay(){
 if(!snapshot)return;
 const item=ext.gameplayEntries(snapshot.content).find(e=>e.path===$('stGameplayPath').value);
 if(item)$('stGameplayValue').value=String(item.value);
}
function fillWeather(){
 if(!snapshot)return;
 const item=ext.weatherEntries(snapshot.content).find(e=>e.path===$('stWeatherPath').value);
 if(item)$('stWeatherValue').value=String(item.value);
}
function fillObject(){
 if(!snapshot)return;
 const item=ext.objectList(snapshot.content).find(e=>String(e.index)===$('stObjectIndex').value);
 if(item){$('stObjectX').value=item.pos[0];$('stObjectZ').value=item.pos[2];}
}
function refreshGlobal(){
 if(!snapshot)return;
 const item=core.globalsList(snapshot.content).find(x=>x.name===$('stGlobalName').value);
 if(item)$('stGlobalValue').value=item.value;
}
async function loadLive(){
 invalidate();snapshot=null;setBusy(true);
 try{
   const relative=$('stRemoteFile').value;
   if(!relative)throw new Error('Choose a Nitrado file.');
   $('stFileState').textContent='Reading current server file…';
   snapshot=await bridge.read(relative);
   if(selected==='Gameplay Generator'){
     const entries=ext.gameplayEntries(snapshot.content),select=$('stGameplayPath');
     select.replaceChildren();
     for(const entry of entries){const o=document.createElement('option');o.value=entry.path;o.textContent=entry.label+' · '+entry.path;select.appendChild(o);}
     if(!entries.length)throw new Error('No supported existing gameplay settings were found.');
     fillGameplay();
   }
   if(selected==='Weather Manager'){
     const entries=ext.weatherEntries(snapshot.content),select=$('stWeatherPath');
     select.replaceChildren();
     for(const entry of entries){const o=document.createElement('option');o.value=entry.path;o.textContent=entry.label;select.appendChild(o);}
     if(!entries.length)throw new Error('No supported existing weather parameters found.');
     fillWeather();
   }
   if(selected==='SpawnObject Mover'){
     const entries=ext.objectList(snapshot.content),select=$('stObjectIndex');
     select.replaceChildren();
     for(const entry of entries){const o=document.createElement('option');o.value=String(entry.index);o.textContent=(entry.index+1)+'. '+entry.name+' ('+entry.pos[0]+', '+entry.pos[2]+')';select.appendChild(o);}
     if(!entries.length)throw new Error('No objects to move in this JSON file.');
     fillObject();
   }
   if(selected==='Globals Configurator'){
     const variables=core.globalsList(snapshot.content);
     const select=$('stGlobalName');select.replaceChildren();
     for(const variable of variables){
       const option=document.createElement('option');
       option.value=variable.name;option.textContent=variable.name+' ('+variable.value+')';
       select.appendChild(option);
     }
     if(!variables.length)throw new Error('No numeric variables available in globals.xml.');
     refreshGlobal();
   }
   $('stFileState').textContent='Live: '+snapshot.relative;
   setStatus('Nitrado file loaded. Click '+(EDITORS.has(selected)?'Preview server changes.':'Check server file.'));
 }catch(error){
   snapshot=null;$('stFileState').textContent='Not loaded';
   setStatus('Nitrado: '+error.message,true);
 }finally{setBusy(false);}
}
async function choose(name){
 if(busy)return;
 selected=name;snapshot=null;invalidate();
 $('stRemoteFile').replaceChildren();
 cards.hidden=true;workspace.hidden=false;
 $('stWorkTitle').textContent=name;
 const types=['Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer'].includes(name);
 $('stParameters').hidden=!types;
 $('stGlobalControls').hidden=name!=='Globals Configurator';
 $('stMessageControls').hidden=name!=='Messages Generator';
 $('stTierControls').hidden=name!=='Tier Booster';
 $('stClassSearchControls').hidden=name!=='Classname Finder';
 $('stSpawnableControls').hidden=name!=='Spawnable Types Adjuster';
 $('stGameplayControls').hidden=name!=='Gameplay Generator';
 $('stWeatherControls').hidden=name!=='Weather Manager';
 $('stObjectMoveControls').hidden=name!=='SpawnObject Mover';
 $('stPlayerSpawnControls').hidden=name!=='Spawn Point Generator';
 $('stMapControls').hidden=!['SpawnObject Mover','Spawn Point Generator'].includes(name);
 $('stHeatmapControls').hidden=name!=='SpawnObject Heatmap';
 $('stValueLabel').textContent=name==='Advanced Types Editor'?'Set value':'Multiplier';
 $('stValue').value=name==='Types Reducer'||name==='Lifetime Reducer'?'0.5':
   name==='Advanced Types Editor'?'100':'2';
 $('stValue').max=name==='Advanced Types Editor'?'100000000':'1000';
 $('stClassname').value='';
 $('stField').value=name==='Lifetime Reducer'?'lifetime':'nominal';
 $('stRun').textContent=EDITORS.has(name)?'Preview server changes':'Check server file';
 $('stHelp').textContent=EDITORS.has(name)?
   'The current file is loaded from Nitrado. Preview the changes, then publish with a verified backup. No import or download required.':
   'This tool checks the existing server file directly. No manual upload or file import.';
 setStatus('Connecting to Nitrado…');$('stFileState').textContent='Finding active mission…';
 setBusy(true);
 let catalogReady=false;
 try{await refreshCatalog();catalogReady=true;}
 catch(error){setStatus(error.message,true);$('stFileState').textContent='Unavailable';}
 finally{setBusy(false);}
 if(catalogReady&&$('stRemoteFile').options.length)await loadLive();
}
$('stBack').addEventListener('click',()=>{
 if(busy)return;
 selected=null;snapshot=null;invalidate();workspace.hidden=true;cards.hidden=false;
});
$('stRemoteFile').addEventListener('change',()=>void loadLive());
$('stReload').addEventListener('click',()=>void loadLive());
for(const id of ['stField','stValue','stClassname','stGlobalValue','stMessageText','stMessageInterval','stTier','stTierFactor','stClassSearch','stSpawnableName','stSpawnableSection','stSpawnableChance','stGameplayPath','stGameplayValue','stWeatherPath','stWeatherValue','stObjectIndex','stObjectX','stObjectZ','stPlayerX','stPlayerZ','stPickMap']){
 $(id).addEventListener('input',invalidate);$(id).addEventListener('change',invalidate);
}
$('stGlobalName').addEventListener('change',()=>{invalidate();refreshGlobal();});
$('stGameplayPath').addEventListener('change',()=>{invalidate();fillGameplay();});
$('stWeatherPath').addEventListener('change',()=>{invalidate();fillWeather();});
$('stObjectIndex').addEventListener('change',()=>{invalidate();fillObject();});
$('stPickMap').addEventListener('click',()=>{
 if(busy||typeof map==='undefined'||typeof leafletToGame!=='function'){
   setStatus('Map selection unavailable.',true);return;
 }
 const tool=selected;
 setStatus('Click one point on the Chernarus map. Then return here to preview the change.');
 map.once('click',e=>{
   if(!selected||selected!==tool||panel.hidden)return;
   const p=leafletToGame(e.latlng);
   if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)){setStatus('Invalid coordinates.',true);return;}
   if(tool==='SpawnObject Mover'){
     $('stObjectX').value=Number(p.x.toFixed(2));$('stObjectZ').value=Number(p.z.toFixed(2));
   }else if(tool==='Spawn Point Generator'){
     $('stPlayerX').value=Number(p.x.toFixed(2));$('stPlayerZ').value=Number(p.z.toFixed(2));
   }
   invalidate();setStatus('Map position selected. Review then publish to Nitrado.');
 });
});
$('stWriteKey').addEventListener('input',()=>{
 const input=document.getElementById('nitradoWriteKey');
 if(input)input.value=$('stWriteKey').value;
});
function analyze(){
 if(!snapshot)throw new Error('Load a server file first.');
 const source=snapshot.content;
 if(selected==='XML Validator'||selected==='JSON Validator'){
   const info=core.validate(source,snapshot.relative);
   return {message:'VALID '+info.kind+' — '+snapshot.relative+'\n'+info.description+
     (info.warnings.length?'\nWarnings:\n'+info.warnings.slice(0,100).join('\n'):'\nNo issues detected by this checker.')};
 }
 if(['Event Conflict Check','Spawnable Duplicate Checker','SpawnObject Duplicate Checker'].includes(selected)){
   const info=selected==='Event Conflict Check'?core.eventConflicts(source):
     selected==='Spawnable Duplicate Checker'?core.spawnableDuplicates(source):core.objectDuplicates(source);
   return {message:'Checked '+info.total+' entries in '+snapshot.relative+
     '\n'+info.findings.length+' issue(s).'+
     (info.findings.length?'\n'+info.findings.slice(0,100).join('\n'):'\nNo conflicts detected by the basic checks.')};
 }
 if(selected==='Gameplay Generator'){
   const change=ext.changeGameplay(source,$('stGameplayPath').value,$('stGameplayValue').value);
   return {content:change.content,changed:change.changed,message:'PREVIEW — '+change.path+'\n'+
     String(change.previous)+' → '+String(change.value)+'\nOther settings are preserved.'};
 }
 if(selected==='Weather Manager'){
   const change=ext.changeWeather(source,$('stWeatherPath').value,$('stWeatherValue').value);
   return {content:change.content,changed:change.changed,message:'PREVIEW — '+change.path+'\n'+
     change.previous+' → '+change.value+'\nOther weather settings are preserved.'};
 }
 if(selected==='Spawn Point Generator'){
   const change=ext.addSpawnPoint(source,$('stPlayerX').value,$('stPlayerZ').value);
   return {content:change.content,changed:1,message:'PREVIEW — Add fresh spawn at X '+change.x+' / Z '+change.z+
     '\nOriginal spawn points and all other groups are preserved.'};
 }
 if(selected==='SpawnObject Mover'){
   const change=ext.changeObjectPosition(source,$('stObjectIndex').value,$('stObjectX').value,$('stObjectZ').value);
   return {content:change.content,changed:change.changed,message:'PREVIEW — Move '+change.name+
     '\nOld X/Y/Z: '+change.previous.join(', ')+'\nNew X/Y/Z: '+change.current.join(', ')+
     '\nOriginal Y elevation and all other objects are retained.'};
 }
 if(selected==='Event Group Calculator'){
   const groups=core.eventGroupStats(source);
   return {message:'LIVE EVENT GROUPS — '+groups.events.length+' event groups, '+groups.total+' configured positions.\n'+groups.events.slice(0,60).map(g=>g.name+' · '+g.positions+' positions').join('\n')+(groups.warnings.length?'\nWarnings:\n'+groups.warnings.slice(0,30).join('\n'):'')};
 }
 if(selected==='SpawnObject Heatmap'){
   const objects=ext.objectList(source);
   return {message:objects.length+' existing objects loaded from '+snapshot.relative+'. Use Show density on map to visualize positions. No server files modified.'};
 }
 if(selected==='SpawnObject Organizer'){
   const change=ext.organizeObjects(source);
   return {content:change.content,changed:change.changed,message:'PREVIEW — Sort '+change.total+
     ' objects by classname. All object properties and positions remain unchanged.'};
 }
 if(selected==='Spawnable Types Adjuster'){
   const result=core.editSpawnableChance(source,$('stSpawnableName').value,$('stSpawnableSection').value,$('stSpawnableChance').value);
   return {content:result.content,changed:result.changed,message:'PREVIEW — '+result.classname+' · '+result.section+'\n'+result.changed+' existing chance attributes will be set to '+result.chance+'.\nOther classnames and settings remain unchanged.'};
 }
 if(selected==='Classname Finder'){
   const matches=core.findClassnames(source,$('stClassSearch').value);
   return {message:'Searched '+matches.scanned+' server type entries. '+matches.total+' matches.\n'+
     matches.results.map(x=>x.name+' · nominal '+x.nominal+' · min '+x.min).join('\n')+
     (matches.total>100?'\nShowing first 100 matches.':'')};
 }
 if(selected==='Tier Booster'){
   const factor=Number($('stTierFactor').value);
   if(!Number.isFinite(factor)||factor<1||factor>1000)throw new Error('Tier multiplier must be between 1 and 1000.');
   const changes=core.editTypes(source,{mode:'multiply',field:'nominal',value:factor,tier:$('stTier').value});
   return {content:changes.content,changed:changes.changed,message:'PREVIEW — '+changes.changed+' explicit '+$('stTier').value+' entries will have nominal counts multiplied by '+factor+'.\nCustom tier aliases are not modified.'};
 }
 if(selected==='Messages Generator'){
   const changes=core.addMessage(source,$('stMessageText').value,$('stMessageInterval').value);
   return {content:changes.content,changed:1,message:'PREVIEW — Add repeat message every '+changes.interval+' minutes to '+snapshot.relative+'\nText: '+changes.text+'\nExisting messages remain untouched.'};
 }
 if(selected==='Globals Configurator'){
   const changes=core.editGlobal(source,$('stGlobalName').value,$('stGlobalValue').value);
   return {content:changes.content,changed:changes.changed,
     message:changes.name+': '+changes.previous+' → '+changes.current+
       (changes.changed?'\nOne existing value will change. All other settings are preserved.':'\nNo change necessary.')};
 }
 const val=Number($('stValue').value),field=selected==='Lifetime Reducer'?'lifetime':$('stField').value;
 if(selected==='Types Booster'&&val<1)throw new Error('Booster multiplier must be at least 1.');
 if(['Types Reducer','Lifetime Reducer'].includes(selected)&&(val<0||val>1))
   throw new Error('Reduction multiplier must be from 0 to 1.');
 const changes=core.editTypes(source,{
   mode:selected==='Advanced Types Editor'?'set':'multiply',
   field,value:val,classname:$('stClassname').value
 });
 return {content:changes.content,changed:changes.changed,
   message:'PREVIEW — '+snapshot.relative+'\n'+changes.changed+' item(s) will change, '+
     changes.skipped+' skipped and '+changes.matched+' matched.\nField: '+field+
     '\nThe original XML layout and unrelated entries remain unchanged.'};
}
$('stRun').addEventListener('click',()=>{
 if(busy||!snapshot)return;
 invalidate();
 try{
   const result=analyze();
   if(typeof result.content==='string'){
     bridge.validateContent(snapshot.path,result.content);
     if(result.changed&&result.content!==snapshot.content){
       preview={source:snapshot,content:result.content};
       $('stPublish').hidden=false;$('stPublish').disabled=false;
     }
   }
   setStatus(result.message+(preview?'\nReady to publish to Nitrado with a verified backup.':''));
 }catch(error){setStatus('Preview blocked: '+error.message,true);}
});
$('stPublish').addEventListener('click',async()=>{
 if(busy||!preview)return;
 const pending=preview;
 if(!window.confirm('Publish '+selected+' to LIVE Nitrado?\n\n'+pending.source.relative+
   '\n\nConfirm your DayZ server is STOPPED. A verified backup is required before this file is replaced.'))return;
 setBusy(true);setStatus('Validating current Nitrado file, creating backup and publishing…');
 try{
   const result=await bridge.publish(pending.source,pending.content);
   invalidate();
   setStatus('UPLOAD VERIFIED — '+pending.source.relative+
     '\nBackup: '+result.backupPath+'\nStart your server to activate the new settings.');
   $('stFileState').textContent='Refreshing Nitrado…';
   snapshot=await bridge.read(pending.source.relative);
   $('stFileState').textContent='Live: '+snapshot.relative;
 }catch(error){
   invalidate();snapshot=null;
   setStatus('UPLOAD NOT VERIFIED: '+error.message+
     '\nInspect server file and backups before retrying.',true);
   $('stFileState').textContent='Reload required';
 }finally{setBusy(false);}
});
render();
window.BUILD_IT_TOOLS=Object.freeze({count:TOOLS.length,ready:ACTIVE.size,mode:'nitrado'});
})();
