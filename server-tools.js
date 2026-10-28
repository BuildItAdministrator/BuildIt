/* Build It!++ — compact DayZ console tools hub.
 * 53-item roadmap; only working tools have an action.
 * No network writes: use existing File Manager for reviewed Nitrado uploads.
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
const ACTIVE=new Set(['XML Validator','JSON Validator','JSON Splitter','Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer','Event Conflict Check']);
const RELATED={'Events Organizer':'biToggle','Build A Vehicle':'biToggle'};
const ROOT=document.createElement('div');ROOT.id='serverToolsRoot';
ROOT.innerHTML=`
<button type="button" id="toolHubToggle" aria-haspopup="dialog" aria-expanded="false" aria-controls="toolHubPanel">Server Tools <span class="st-count">${ACTIVE.size} ready · ${TOOLS.length} listed</span></button>
<section id="toolHubPanel" hidden role="dialog" aria-label="DayZ Server Tools">
 <header class="st-header">
   <div><strong>Server Tools</strong><small>Console configuration studio · ${TOOLS.length} catalogued</small></div>
   <button type="button" id="toolHubClose" aria-label="Close Server Tools">×</button>
 </header>
 <div class="st-toolbar">
   <label class="st-field"><span>Find a tool</span><input id="stSearch" type="search" autocomplete="off" placeholder="Search all ${TOOLS.length} tools…"></label>
   <label class="st-field"><span>Category</span><select id="stCategory"><option value="">All categories</option>${C.map(([name])=>'<option>'+name+'</option>').join('')}</select></label>
 </div>
 <div class="st-summary">Ready tools can process your local files. Planned entries are listed for the roadmap only.</div>
 <div id="stCards" class="st-cards" aria-live="polite"></div>
 <div id="stWorkspace" class="st-workspace" hidden>
   <div class="st-work-head"><strong id="stWorkTitle"></strong><button type="button" id="stBack">Back to tools</button></div>
   <p id="stHelp" class="st-help"></p>
   <label class="st-field"><span>Import a local source file</span><input id="stFile" type="file" accept=".xml,.json,text/xml,application/json"></label>
   <label class="st-field"><span>Source XML or JSON (can also paste here)</span><textarea id="stSource" rows="8" spellcheck="false" placeholder="Import your file or paste its complete contents"></textarea></label>
   <div id="stParameters" class="st-params" hidden>
     <label class="st-field"><span>Modify</span><select id="stField"><option value="nominal">Nominal amount</option><option value="min">Minimum amount</option><option value="lifetime">Lifetime (seconds)</option><option value="restock">Restock (seconds)</option><option value="quantmin">Quantity minimum</option><option value="quantmax">Quantity maximum</option><option value="cost">Cost</option></select></label>
     <label class="st-field"><span id="stValueLabel">Multiplier</span><input type="number" id="stValue" value="2" min="0" max="1000" step="0.1"></label>
     <label class="st-field st-wide"><span>Classname filter (optional)</span><input id="stClassname" type="text" placeholder="Empty applies to all types"></label>
   </div>
   <div id="stSplitControls" class="st-params" hidden>
     <label class="st-field"><span>Entries per JSON file</span><input type="number" id="stChunkSize" min="1" max="10000" step="1" value="100"></label>
   </div>
   <div class="st-actions"><button id="stRun" type="button">Validate / Generate</button><button id="stDownload" type="button" hidden>Download edited file</button></div>
   <pre id="stResult" class="st-result" role="status" aria-live="polite"></pre>
   <div id="stParts" class="st-parts"></div>
 </div>
</section>`;
document.body.appendChild(ROOT);
const $=id=>ROOT.querySelector('#'+id);
const panel=$('toolHubPanel'),cards=$('stCards'),workspace=$('stWorkspace');
let selected=null,sourceName='',result=null,urls=[];
function clearDownloads(){urls.forEach(url=>URL.revokeObjectURL(url));urls=[]; $('stParts').replaceChildren();}
function fileUrl(content){const url=URL.createObjectURL(new Blob([content],{type:'application/json;charset=utf-8'}));urls.push(url);return url;}
function download(name,content){const a=document.createElement('a');a.href=fileUrl(content);a.download=name;document.body.appendChild(a);a.click();a.remove();}
function open(){
  panel.hidden=false;$('toolHubToggle').setAttribute('aria-expanded','true');
  const bi=document.getElementById('biPanel');if(bi)bi.hidden=true;
  for(const id of ['filterPanel','logPanel'])document.getElementById(id)?.classList.add('hidden');
}
function close(){
  panel.hidden=true;$('toolHubToggle').setAttribute('aria-expanded','false');clearDownloads();
}
$('toolHubToggle').addEventListener('click',()=>panel.hidden?open():close());
$('toolHubClose').addEventListener('click',close);
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
    const box=document.createElement('div');box.className='st-card'+(ready?' st-ready':'');
    const name=document.createElement('strong');name.textContent=tool.name;
    const meta=document.createElement('small');meta.textContent=tool.group+' · '+(ready?'Ready':related?'Partly available in Event Manager':'Planned');
    box.append(name,meta);
    if(ready||related){
      const btn=document.createElement('button');btn.type='button';btn.textContent=ready?'Open tool':'Open Event Manager';
      btn.addEventListener('click',()=>{
        if(ready)choose(tool.name);
        else{close();document.getElementById(related)?.click();}
      });
      box.appendChild(btn);
    }
    cards.appendChild(box);
  }
  if(!shown){const empty=document.createElement('p');empty.className='st-help';empty.textContent='No tools found. Adjust your search.';cards.appendChild(empty);}
}
$('stSearch').addEventListener('input',render);
$('stCategory').addEventListener('change',render);
function choose(name){
  selected=name;sourceName='';result=null;clearDownloads();cards.hidden=true;workspace.hidden=false;
  $('stWorkTitle').textContent=name;$('stSource').value='';$('stFile').value='';
  $('stResult').textContent='';$('stDownload').hidden=true;
  const isTypes=['Types Booster','Types Reducer','Advanced Types Editor','Lifetime Reducer'].includes(name);
  $('stParameters').hidden=!isTypes;
  $('stSplitControls').hidden=name!=='JSON Splitter';
  const isSet=name==='Advanced Types Editor';
  $('stValueLabel').textContent=isSet?'Set numeric value':'Multiplier';
  $('stValue').value=name==='Types Reducer'?'0.5':name==='Lifetime Reducer'?'0.5':name==='Advanced Types Editor'?'100':'2';
  $('stValue').max=isSet?'100000000':'1000';
  $('stField').value=name==='Lifetime Reducer'?'lifetime':'nominal';
  $('stRun').textContent=['JSON Validator','XML Validator'].includes(name)?'Validate':name==='Event Conflict Check'?'Check events':name==='JSON Splitter'?'Split JSON':'Generate revised types.xml';
  $('stHelp').textContent=isTypes?'Import types.xml. Values change only in the selected numeric field; XML formatting and declaration are preserved. Inspect the result before uploading.':
    name==='JSON Splitter'?'Split a JSON array or DayZ Object Spawner Objects[] into downloadable parts. Other JSON structures are not silently modified.':
    name==='Event Conflict Check'?'Check events.xml for duplicate event names and numeric inconsistencies. Does not overwrite or upload server files.':
    'Validate a JSON or XML file locally, without changing its content or uploading it.';
}
$('stBack').addEventListener('click',()=>{workspace.hidden=true;cards.hidden=false;selected=null;clearDownloads();});
$('stFile').addEventListener('change',async()=>{
  const file=$('stFile').files?.[0];if(!file)return;
  if(file.size>2*1024*1024){$('stResult').textContent='Maximum local source size is 2 MB.';return;}
  try{
    sourceName=file.name;
    $('stSource').value=await file.text();$('stResult').textContent='Loaded '+file.name+'. Run the tool to analyze it.';
  }catch(error){$('stResult').textContent=error.message;}
});
$('stRun').addEventListener('click',()=>{
  clearDownloads();result=null;$('stDownload').hidden=true;
  const source=$('stSource').value;
  try{
    if(!source.trim())throw new Error('Select or paste a source file first.');
    if(new Blob([source]).size>2*1024*1024)throw new Error('Source file exceeds the 2 MB local processing limit.');
    const core=window.BUILD_IT_SERVER_CORE;
    if(selected==='XML Validator'||selected==='JSON Validator'){
      const name=selected==='XML Validator'?(sourceName.endsWith('.xml')?sourceName:'input.xml'):
        (sourceName.endsWith('.json')?sourceName:'input.json');
      const info=core.validate(source,name);
      $('stResult').textContent='VALID '+info.kind+' — '+info.description+
        (info.warnings.length?'\nWarnings:\n'+info.warnings.slice(0,30).join('\n'):'\nNo issues detected by this validator.');
    }else if(selected==='Event Conflict Check'){
      const info=core.eventConflicts(source);
      $('stResult').textContent='Scanned '+info.total+' events. '+info.findings.length+' issue(s) found.'+
        (info.findings.length?'\n'+info.findings.slice(0,100).join('\n'):'\nNo conflicts detected by the basic checks.');
    }else if(selected==='JSON Splitter'){
      const parts=core.splitJSON(source,$('stChunkSize').value);
      $('stResult').textContent='Split into '+parts.length+' file(s). Download each part below; no server files were changed.';
      for(const part of parts){
        const a=document.createElement('a');a.href=fileUrl(part.content);a.download=part.filename;
        a.textContent=part.filename+' ('+part.count+' entries)';
        $('stParts').appendChild(a);
      }
    }else if(selected){
      const mode=selected==='Advanced Types Editor'?'set':'multiply';
      const field=selected==='Lifetime Reducer'?'lifetime':$('stField').value;
      const val=Number($('stValue').value);
      if(selected==='Types Booster'&&val<1)throw new Error('Boost multiplier must be 1 or higher.');
      if(selected==='Types Reducer'&&(val<0||val>1))throw new Error('Reducer multiplier must be from 0 to 1.');
      if(selected==='Lifetime Reducer'&&(val<0||val>1))throw new Error('Lifetime reduction must be from 0 to 1.');
      result=core.editTypes(source,{mode,field,value:val,classname:$('stClassname').value});
      $('stResult').textContent=result.changed+' <type> entries updated. '+result.skipped+' skipped (field absent). '+result.matched+' matched.\nNo server file changed. Download, review and upload using File Manager with backup.';
      if(result.changed)$('stDownload').hidden=false;
    }
  }catch(error){$('stResult').textContent='ERROR — '+error.message;}
});
$('stDownload').addEventListener('click',()=>{if(result?.content)download('types.xml',result.content);});
render();
window.BUILD_IT_TOOLS=Object.freeze({count:TOOLS.length,ready:ACTIVE.size});
})();
