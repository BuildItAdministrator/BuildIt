/* BuildItPlus workspace shell v2. Navigation only; delegates every edit to existing tested tools. */
(function(){
'use strict';
if(document.getElementById('biWorkspaceHeader'))return;
const root=document.documentElement;
const $=id=>document.getElementById(id);
const iconPaths={
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 tools:'<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3z"/>',
 events:'<path d="M8 3h8l5 5v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M16 3v5h5M7 13h10M7 17h7"/>',
 logs:'<path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h4"/>',
 files:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
 servers:'<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h7M11 17h7"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 maximize:'<path d="M8 3H3v5M21 8V3h-5M3 16v5h5M16 21h5v-5"/>',
 close:'<path d="M18 6 6 18M6 6l12 12"/>'
};
const svg=name=>'<svg aria-hidden="true" viewBox="0 0 24 24">'+iconPaths[name]+'</svg>';
const header=document.createElement('header');header.id='biWorkspaceHeader';
header.setAttribute('aria-label','BuildItPlus workspace');
header.innerHTML='<div class="bw-brand"><div class="bw-logo" aria-hidden="true">'+svg('layers')+'</div><div class="bw-name">BuildItPlus<small>DAYZ SERVER STUDIO</small></div></div>'+
 '<div class="bw-title"><strong id="bwViewTitle">Map overview</strong><span id="bwViewSubtitle">Plan and manage your server</span></div>'+
 '<div class="bw-grow"></div><div class="bw-head-actions" id="bwHeaderActions">'+
 '<button type="button" id="bwQuickFind" class="bw-icon-button" title="Find a tool (Ctrl+K)" aria-label="Find a tool">'+svg('search')+'<span class="bw-label">Find a tool</span></button>'+
 '<button type="button" id="bwFocusMap" class="bw-icon-button" title="Toggle map focus" aria-label="Toggle map focus">'+svg('maximize')+'</button></div>';
const rail=document.createElement('nav');rail.id='biWorkspaceRail';rail.setAttribute('aria-label','Main navigation');
const items=[
 {id:'map',title:'Map',subtitle:'Explore locations and spawns'},
 {id:'tools',title:'Server tools',subtitle:'Configure and validate files'},
 {id:'events',title:'Event manager',subtitle:'Build and publish events'},
 {id:'time',title:'Day / night planner',subtitle:'Estimate day and night durations'},
 {id:'logs',title:'Server activity',subtitle:'Review logs and player activity'},
 {id:'files',title:'File manager',subtitle:'Edit server files safely'},
 {id:'layers',title:'Map layers',subtitle:'Filter locations and markers'},
 {id:'servers',title:'Server profiles',subtitle:'Select and manage connections'}
];
const addSection=(label)=>{const e=document.createElement('div');e.className='bw-section';e.textContent=label;rail.appendChild(e);};
addSection('Workspace');
for(const item of items){
 if(item.id==='layers')addSection('Preferences');
 const button=document.createElement('button');
 button.type='button';button.className='bw-nav';button.dataset.view=item.id;
 button.setAttribute('aria-label',item.title);button.title=item.title;
 button.innerHTML=svg(item.id)+'<span>'+item.title+'</span>';
 button.addEventListener('click',()=>navigate(item.id));
 rail.appendChild(button);
}
const foot=document.createElement('div');foot.className='bw-bottom';
foot.innerHTML='<div class="bw-hint">Edits are previewed and validated before upload.</div>';
rail.appendChild(foot);
const dialog=document.createElement('div');dialog.id='biCommandDialog';dialog.hidden=true;
dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Find tools and actions');
dialog.innerHTML='<div class="bw-palette"><div class="bw-palette-head">'+svg('search')+
 '<input id="bwCommandInput" type="search" placeholder="Search tools or actions…" autocomplete="off" aria-label="Search tools or actions">'+
 '<button id="bwCommandClose" type="button" aria-label="Close search">Esc</button></div>'+
 '<div id="bwCommandList" class="bw-palette-list" role="listbox" aria-label="Matching tools"></div></div>';
document.body.append(header,rail,dialog);
const timePanel=document.createElement('section');timePanel.id='bwTimePanel';timePanel.hidden=true;
timePanel.setAttribute('role','region');timePanel.setAttribute('aria-label','Day and night planner');
timePanel.innerHTML='<div class="bw-time-head"><div><strong>Day / night planner</strong><p>Calculate a server time cycle before changing Nitrado settings.</p></div><button id="bwTimeClose" type="button" aria-label="Close planner">×</button></div>'+
 '<div class="bw-time-fields"><label>Time acceleration <small>serverTimeAcceleration</small><input id="bwTimeRate" type="number" min="0.1" max="64" step="0.1" value="12"></label>'+
 '<label>Night acceleration <small>serverNightTimeAcceleration</small><input id="bwNightRate" type="number" min="0.1" max="64" step="0.1" value="4"></label></div>'+
 '<div class="bw-time-results"><div><small>Daytime · approx.</small><strong id="bwDayResult">—</strong></div><div><small>Nighttime · approx.</small><strong id="bwNightResult">—</strong></div><div><small>Full cycle · approx.</small><strong id="bwCycleResult">—</strong></div></div>'+
 '<div class="bw-time-file"><div>Suggested server settings</div><pre id="bwTimeConfig"></pre><button id="bwCopyTime" type="button">Copy settings</button></div>'+
 '<p class="bw-time-note">Uses 12 in-game hours of daylight and 12 of darkness as an estimate. Seasonal daylight lengths vary. No server settings are changed.</p>';
document.body.appendChild(timePanel);
const validRate=n=>Number.isFinite(n)&&n>=0.1&&n<=64;
const duration=mins=>{const h=Math.floor(mins/60),m=Math.round(mins%60);return (h?String(h)+'h ':'')+String(m)+'m';};
function updateTime(){
 const a=Number($('bwTimeRate').value),n=Number($('bwNightRate').value);
 const valid=validRate(a)&&validRate(n);
 $('bwDayResult').textContent=valid?duration(720/a):'—';
 $('bwNightResult').textContent=valid?duration(720/(a*n)):'—';
 $('bwCycleResult').textContent=valid?duration(720/a+720/(a*n)):'—';
 $('bwTimeConfig').textContent=valid?'serverTimeAcceleration = '+a+';\nserverNightTimeAcceleration = '+n+';':'Use values between 0.1 and 64.';
 $('bwCopyTime').disabled=!valid;
}
$('bwTimeRate').addEventListener('input',updateTime);
$('bwNightRate').addEventListener('input',updateTime);
$('bwCopyTime').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText($('bwTimeConfig').textContent);$('bwCopyTime').textContent='Copied';}
 catch(_){$('bwCopyTime').textContent='Select and copy the text above';}
});
$('bwTimeClose').addEventListener('click',()=>navigate('map'));
updateTime();
const search=$('placeSearchBox'),profiles=$('biServerProfileDock'),actions=$('bwHeaderActions');
if(profiles)header.insertBefore(profiles,actions);
if(search)header.insertBefore(search,actions);
let preferred='map',paletteOpen=false,results=[],selectedIndex=0,previousFocus=null;
const openPanel=id=>{const p=$(id);return !!p&&!p.hidden&&!p.classList.contains('hidden');};
const click=id=>{const e=$(id);if(e&&typeof e.click==='function'){e.click();return true;}return false;};
function hidePanels(){
 if(openPanel('biPanel'))click('biClose');
 if(openPanel('toolHubPanel'))click('toolHubClose');
 if(openPanel('biServerProfilePanel'))click('bspClose');
 if(openPanel('filterPanel'))click('filterToggle');
 if(openPanel('logPanel'))click('logClose');
 window.BUILD_IT_QUICK_SPAWN?.close?.();
 timePanel.hidden=true;
}
function navigate(target){
 if(!items.some(item=>item.id===target))return;
 if(window.BUILD_IT_UI_VISIBILITY?.isPicking?.())return;
 hidePanels();
 preferred=target;
 if(target==='events')click('biToggle');
 else if(target==='time')timePanel.hidden=false;
 else if(target==='tools')click('toolHubToggle');
 else if(target==='logs'||target==='files'){
  click('logToggle');
  if(target==='files'){
   const details=$('logServerFiles');
   if(details){details.open=true;details.scrollIntoView({block:'nearest'});}
  }
 }else if(target==='layers')click('filterToggle');
 else if(target==='servers'){
  if(!click('biServerProfileManage')){
   preferred='map';
  }
 }
 if(target==='map'&&window.map&&typeof window.map.invalidateSize==='function')window.map.invalidateSize();
 syncActive();
}
function syncActive(){
 let active='map';
 if(!timePanel.hidden)active='time';
 else if(openPanel('biServerProfilePanel'))active='servers';
 else if(openPanel('toolHubPanel'))active='tools';
 else if(openPanel('biPanel'))active='events';
 else if(openPanel('filterPanel'))active='layers';
 else if(openPanel('logPanel'))active=preferred==='files'?'files':'logs';
 preferred=active;
 for(const button of rail.querySelectorAll('.bw-nav')){
  if(button.dataset.view===active)button.setAttribute('aria-current','page');
  else button.removeAttribute('aria-current');
 }
 const item=items.find(i=>i.id===active)||items[0];
 $('bwViewTitle').textContent=item.title;
 $('bwViewSubtitle').textContent=item.subtitle;
}
const panels=['biPanel','toolHubPanel','biServerProfilePanel','filterPanel','logPanel'];
for(const id of panels){
 const p=$(id);if(!p)continue;
 new MutationObserver(syncActive).observe(p,{attributes:true,attributeFilter:['class','hidden']});
}
function toolList(){
 const cards=[...document.querySelectorAll('#stCards .st-card')];
 return cards.map(card=>{
  const name=card.querySelector('strong')?.textContent?.trim();
  const category=card.querySelector('small')?.textContent?.split(' · ')[0]?.trim()||'Server tools';
  return name?{name,category,go:()=>{
   navigate('tools');
   const input=$('stSearch'),filter=$('stCategory');
   if(input){input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}
   if(filter){filter.value='';filter.dispatchEvent(new Event('change',{bubbles:true}));}
   const found=[...document.querySelectorAll('#stCards .st-card')].find(c=>c.querySelector('strong')?.textContent?.trim()===name);
   found?.querySelector('button')?.click();
  }}:null;
 }).filter(Boolean);
}
function quickActions(){
 return items.map(i=>({name:i.title,category:'Navigation',go:()=>navigate(i.id)}));
}
function renderPalette(){
 const q=$('bwCommandInput').value.trim().toLocaleLowerCase();
 results=[...quickActions(),...toolList()].filter(x=>!q||(x.name+' '+x.category).toLocaleLowerCase().includes(q)).slice(0,50);
 if(selectedIndex>=results.length)selectedIndex=0;
 const list=$('bwCommandList');list.replaceChildren();
 if(!results.length){const el=document.createElement('div');el.className='bw-empty';el.textContent='No matching actions';list.appendChild(el);return;}
 results.forEach((item,i)=>{
  const b=document.createElement('button');b.type='button';b.className='bw-palette-item';
  b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===selectedIndex));
  const name=document.createElement('span');name.textContent=item.name;
  const category=document.createElement('small');category.textContent=item.category;
  b.append(name,category);
  b.addEventListener('mouseenter',()=>{selectedIndex=i;selectIndex();});
  b.addEventListener('click',()=>activate(i));
  list.appendChild(b);
 });
}
function selectIndex(){
 [...$('bwCommandList').querySelectorAll('.bw-palette-item')].forEach((b,i)=>b.setAttribute('aria-selected',String(i===selectedIndex)));
}
function openPalette(){
 if(paletteOpen||window.BUILD_IT_UI_VISIBILITY?.isPicking?.())return;
 previousFocus=document.activeElement;paletteOpen=true;dialog.hidden=false;
 $('bwCommandInput').value='';selectedIndex=0;renderPalette();$('bwCommandInput').focus();
}
function closePalette(){
 if(!paletteOpen)return;
 paletteOpen=false;dialog.hidden=true;
 if(previousFocus&&typeof previousFocus.focus==='function')previousFocus.focus();
}
function activate(i){
 const selected=results[i];if(!selected)return;
 closePalette();selected.go();
}
$('bwQuickFind').addEventListener('click',openPalette);
$('bwCommandClose').addEventListener('click',closePalette);
$('bwCommandInput').addEventListener('input',()=>{selectedIndex=0;renderPalette();});
$('bwCommandInput').addEventListener('keydown',e=>{
 if(e.key==='ArrowDown'){e.preventDefault();selectedIndex=Math.min(selectedIndex+1,results.length-1);selectIndex();}
 if(e.key==='ArrowUp'){e.preventDefault();selectedIndex=Math.max(0,selectedIndex-1);selectIndex();}
 if(e.key==='Enter'){e.preventDefault();activate(selectedIndex);}
});
dialog.addEventListener('click',e=>{if(e.target===dialog)closePalette();});
document.addEventListener('keydown',e=>{
 const typing=e.target?.matches?.('input,textarea,select,[contenteditable="true"]');
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();}
 else if(e.key==='/'&&!typing&&!paletteOpen&&!e.ctrlKey&&!e.metaKey){e.preventDefault();openPalette();}
 else if(e.key==='Escape'&&paletteOpen){e.preventDefault();closePalette();}
},true);
$('bwFocusMap').addEventListener('click',()=>{
 if(window.BUILD_IT_UI_VISIBILITY?.isPicking?.())return;
 hidePanels();
 window.BUILD_IT_UI_VISIBILITY?.toggleMenus?.();
 syncActive();
});
// Keep the old UI if initialization is interrupted; only activate new positioning after setup.
root.dataset.builditUi='v2';
syncActive();
window.BUILD_IT_WORKSPACE=Object.freeze({navigate,openSearch:openPalette});
})();
