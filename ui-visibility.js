/* Build It!++ map-focused UI: reversible menu visibility, one map picker at a time.
 * Never changes Nitrado data; preserves open panel state and draft values.
 */
(function(){
'use strict';
const KEY='buildit_menus_hidden_v1';
const root=document.documentElement;
const saved=()=>{try{return localStorage.getItem(KEY)==='true';}catch{return false;}};
let manuallyHidden=saved();
let active=null;
const dock=document.getElementById('placeSearchBox');
if(!dock)return;
const toggle=document.createElement('button');
toggle.id='builditMenusToggle';
toggle.type='button';
dock.appendChild(toggle);
const cancel=document.createElement('div');
cancel.id='builditMapPickToolbar';cancel.hidden=true;
cancel.setAttribute('role','status');
cancel.innerHTML='<span id="builditMapPickHint">Click a position on the map</span>'+
  '<button type="button" id="builditMapPickCancel">Cancel selection</button>';
document.body.appendChild(cancel);
const hint=cancel.querySelector('#builditMapPickHint');
function refresh(){
 if(manuallyHidden||active){
  // Close autocomplete so an old search dropdown cannot keep the dock
  // hidden after the menu-toggle restores its normal state.
  const results=document.getElementById('placeSearchResults');
  results?.classList.add('hidden');
  if(document.activeElement?.id==='placeSearchInput')document.activeElement.blur();
 }
 root.dataset.builditMenusHidden=String(manuallyHidden);
 root.dataset.builditMapPicking=String(!!active);
 cancel.hidden=!active;
 toggle.setAttribute('aria-pressed',String(!manuallyHidden));
 toggle.setAttribute('aria-label',manuallyHidden?'Show menus':'Hide menus');
 toggle.title=manuallyHidden?'Show menus':'Hide menus';
 toggle.textContent=manuallyHidden?'Show menus':'Hide menus';
 if(active)hint.textContent=active.hint;
}
function cancelPick(owner){
 if(!active||owner&&active.owner!==owner)return false;
 const previous=active;
 active=null;
 refresh();
 if(typeof previous.onCancel==='function')previous.onCancel();
 return true;
}
function finishPick(owner){
 if(!active||active.owner!==owner)return false;
 active=null;
 refresh();
 return true;
}
function beginPick(owner,{onCancel=null,hintText='Click one position on the Chernarus map'}={}){
 if(typeof owner!=='string'||!owner)throw new Error('Invalid map picker.');
 // Cancel any previous picker (and detach its map listener) before switching.
 if(active)cancelPick();
 active={owner,onCancel,hint:String(hintText)};
 refresh();
 return true;
}
function setManuallyHidden(value,{persist=true}={}){
 manuallyHidden=!!value;
 if(active&&manuallyHidden===false)cancelPick();
 refresh();
 if(persist){
  try{localStorage.setItem(KEY,String(manuallyHidden));}catch(_){}
 }
}
toggle.addEventListener('click',()=>{
 if(active){cancelPick();setManuallyHidden(false);return;}
 setManuallyHidden(!manuallyHidden);
});
cancel.querySelector('#builditMapPickCancel').addEventListener('click',()=>cancelPick());
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&active){
  e.preventDefault();e.stopImmediatePropagation();
  cancelPick();
 }
},true);
window.addEventListener('buildit:nitrado-profile-changing',()=>cancelPick());
window.BUILD_IT_UI_VISIBILITY=Object.freeze({
 beginPick,finishPick,cancelPick,
 toggleMenus:()=>setManuallyHidden(!manuallyHidden),
 showMenus:()=>setManuallyHidden(false),
 hideMenus:()=>setManuallyHidden(true),
 isManuallyHidden:()=>manuallyHidden,
 isPicking:()=>!!active,
 activePicker:()=>active?.owner||''
});
refresh();
})();