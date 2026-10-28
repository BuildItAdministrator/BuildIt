/* Build It!++ native Nitrado configuration transformations.
 * Pure, schema-limited helpers. No API calls, no unconfirmed server writes.
 */
(function(root){
'use strict';
const u=(content)=>{const nl=content.includes('\r\n')?'\r\n':content.includes('\r')&&!content.includes('\n')?'\r':'\n';const indent=content.match(/(?:\r\n|\n|\r)([ \t]+)"/)?.[1]||'  ';return{nl,indent}};
function jsonObject(src,expected){
  let data;try{data=JSON.parse(src);}catch(e){throw Error('Invalid source JSON: '+e.message);}
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Expected JSON object.');
  if(expected&&!Array.isArray(data[expected]))throw Error('Expected '+expected+' array.');
  return data;
}
function stringify(data,source){
  const fmt=u(source);
  const text=JSON.stringify(data,null,fmt.indent).replace(/\n/g,fmt.nl);
  return text+(source.endsWith(fmt.nl)?fmt.nl:'');
}
const GAMEPLAY_SETTINGS=Object.freeze({
 'GeneralData.disableBaseDamage':{type:'boolean',label:'Disable base damage'},
 'GeneralData.disableContainerDamage':{type:'boolean',label:'Disable container damage'},
 'GeneralData.disableRespawnDialog':{type:'boolean',label:'Disable respawn dialog'},
 'GeneralData.disableRespawnInUnconsciousness':{type:'boolean',label:'Disable unconscious respawn'},
 'PlayerData.disablePersonalLight':{type:'boolean',label:'Disable personal light'},
 'PlayerData.StaminaData.staminaMax':{type:'number',min:0,max:100000,label:'Maximum stamina'},
 'PlayerData.StaminaData.staminaMinCap':{type:'number',min:0,max:100000,label:'Minimum stamina cap'},
 'PlayerData.StaminaData.sprintStaminaModifierErc':{type:'number',min:0,max:1000,label:'Sprint stamina modifier (upright)'},
 'PlayerData.StaminaData.sprintStaminaModifierCro':{type:'number',min:0,max:1000,label:'Sprint stamina modifier (crouched)'},
 'WorldsData.lightingConfig':{type:'integer',min:0,max:1,label:'Night lighting (0 bright, 1 dark)'}
});
function gameplayEntries(src){
 const data=jsonObject(src);
 return Object.entries(GAMEPLAY_SETTINGS).filter(([path])=>{
   let node=data;
   for(const part of path.split('.')){if(!node||!Object.prototype.hasOwnProperty.call(node,part))return false;node=node[part];}
   return typeof node==='number'||typeof node==='boolean';
 }).map(([path,spec])=>{
   let node=data;for(const part of path.split('.'))node=node[part];
   return{path,label:spec.label,type:spec.type,value:node};
 });
}
function changeGameplay(src,path,newValue){
 const schema=GAMEPLAY_SETTINGS[path];
 if(!schema)throw Error('This gameplay setting is not in the verified supported list.');
 const data=jsonObject(src),pieces=path.split('.');
 let node=data;
 for(const key of pieces.slice(0,-1)){
   if(!node||typeof node!=='object'||Array.isArray(node)||
      !Object.prototype.hasOwnProperty.call(node,key))throw Error(path+' does not exist in the active gameplay file.');
   node=node[key];
 }
 const last=pieces[pieces.length-1];
 if(!node||!Object.prototype.hasOwnProperty.call(node,last))
   throw Error(path+' does not exist in the active gameplay file. No new settings were invented.');
 const previous=node[last];let value;
 if(schema.type==='boolean'){
   if(newValue!==true&&newValue!==false&&newValue!=='true'&&newValue!=='false')
     throw Error('Select true or false.');
   value=newValue===true||newValue==='true';
 }else{
   if(newValue===''||newValue===null||!Number.isFinite(Number(newValue)))
     throw Error('Enter a finite number.');
   value=Number(newValue);
   if(value<schema.min||value>schema.max||(schema.type==='integer'&&!Number.isInteger(value)))
     throw Error('Value outside allowed range for '+schema.label+'.');
 }
 if(typeof previous!==typeof value)throw Error('Existing gameplay field type differs; refusing unsafe change.');
 node[last]=value;
 return{content:stringify(data,src),changed:Number(previous!==value),previous,value,path};
}
const WEATHER_PATHS=[
 ['weather.enable','Weather system enabled (1/0)'],
 ['overcast.current.actual','Current overcast (0–1)'],
 ['overcast.limits.min','Minimum overcast (0–1)'],
 ['overcast.limits.max','Maximum overcast (0–1)'],
 ['fog.current.actual','Current fog (0–1)'],
 ['fog.limits.min','Minimum fog (0–1)'],
 ['fog.limits.max','Maximum fog (0–1)'],
 ['rain.current.actual','Current rain (0–1)'],
 ['rain.limits.min','Minimum rain (0–1)'],
 ['rain.limits.max','Maximum rain (0–1)']
];
function xml(source,rootName){
 const doc=new DOMParser().parseFromString(source,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement?.nodeName!==rootName)
   throw Error('Expected valid <'+rootName+'> XML.');
 const declaration=source.match(/^\uFEFF?\s*<\?xml[^?]*encoding\s*=\s*(['"])(.*?)\1/i);
 if(declaration&&!/^utf-?8$/i.test(declaration[2]))throw Error('Non-UTF8 XML cannot be safely rewritten.');
 return doc;
}
function commentRanges(source){
 return [...source.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g)].map(x=>[x.index,x.index+x[0].length]);
}
function outside(ranges,start,end){return !ranges.some(([a,b])=>start<b&&end>a);}
function weatherEntries(src){
 const doc=xml(src,'weather'),out=[];
 for(const [path,label] of WEATHER_PATHS){
  const pieces=path.split('.');
  const element=pieces[0]==='weather'?doc.documentElement:
   doc.documentElement.querySelector(':scope > '+pieces[0]+' > '+pieces[1]);
  const attr=pieces.at(-1);
  if(element?.hasAttribute(attr))out.push({path,label,value:element.getAttribute(attr)});
 }
 return out;
}
function changeWeather(src,path,newValue){
 if(!WEATHER_PATHS.some(entry=>entry[0]===path))throw Error('Unsupported weather field.');
 const old=weatherEntries(src).find(e=>e.path===path);
 if(!old)throw Error('This weather attribute does not exist in cfgweather.xml.');
 const numeric=Number(newValue);
 if(newValue===''||!Number.isFinite(numeric)||numeric<0||numeric>1)
   throw Error('Enter a weather value from 0 to 1.');
 if(path==='weather.enable'&&!Number.isInteger(numeric))
   throw Error('Weather enable must be 0 or 1.');
 const pieces=path.split('.'),key=pieces.at(-1);
 const ranges=commentRanges(src);
 const originalDoc=xml(src,'weather');
 const parent=originalDoc.documentElement;
 const target=pieces[0]==='weather'?parent:parent.querySelector(':scope > '+pieces[0]+' > '+pieces[1]);
 if(!target||!target.hasAttribute(key))throw Error('Weather target does not exist.');
 // Replace only the attribute inside the single specific existing tag.
 const outer=pieces[0],inner=pieces[1];
 const candidates=[];
 if(outer==='weather'){
   for(const match of src.matchAll(/<weather\b[^>]*>/gi)){
     if(outside(ranges,match.index,match.index+match[0].length))candidates.push({begin:match.index,tag:match[0]});
   }
 }else{
   const sectionRe=new RegExp('<'+outer+'\\b[^>]*>[\\s\\S]*?<\\/'+outer+'\\s*>','gi');
   for(const section of src.matchAll(sectionRe)){
     const sectionOpening=section[0].indexOf('>')+1;
     if(!outside(ranges,section.index,section.index+sectionOpening))continue;
     const subRe=new RegExp('<'+inner+'\\b[^>]*\\/?>','gi');
     for(const sub of section[0].matchAll(subRe)){
       const start=section.index+sub.index;
       if(outside(ranges,start,start+sub[0].length))candidates.push({begin:start,tag:sub[0]});
     }
   }
 }
 if(candidates.length!==1)throw Error('Weather XML target is not uniquely identifiable. No changes made.');
 const match=candidates[0],re=new RegExp('(\\b'+key+'\\s*=\\s*)(["\\x27])([^"\\x27]*)\\2','i');
 if(!re.test(match.tag))throw Error('Weather attribute not present in original tag.');
 const updated=match.tag.replace(re,(_,prefix,quote)=>prefix+quote+String(numeric)+quote);
 const content=src.slice(0,match.begin)+updated+src.slice(match.begin+match.tag.length);
 const parsed=xml(content,'weather');
 const changedTarget=outer==='weather'?parsed.documentElement:parsed.documentElement.querySelector(':scope > '+outer+' > '+inner);
 const check=changedTarget?.getAttribute(key);
 if(check!==String(numeric))throw Error('Weather modification validation failed.');
 // Ensure min/max order when editing ranges.
 if(inner==='limits'){
  const min=Number(changedTarget.getAttribute('min')),max=Number(changedTarget.getAttribute('max'));
  if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)throw Error('Weather limits: min cannot exceed max.');
 }
 return{content,changed:Number(old.value!==String(numeric)),previous:old.value,value:numeric,path};
}
function spawnObjects(src){
 const d=jsonObject(src,'Objects');
 for(const [i,o] of d.Objects.entries()){
  if(!o||typeof o.name!=='string'||!Array.isArray(o.pos)||o.pos.length!==3||
     !o.pos.every(x=>typeof x==='number'&&Number.isFinite(x)))
    throw Error('Object '+(i+1)+' has an invalid DayZ [X,Y,Z] position.');
 }
 return d;
}
function objectList(src){return spawnObjects(src).Objects.map((o,i)=>({index:i,name:o.name,pos:o.pos}));}
function changeObjectPosition(src,index,x,z){
 const d=spawnObjects(src),i=Number(index);
 if(!Number.isInteger(i)||i<0||i>=d.Objects.length)throw Error('Select one existing object.');
 const xx=Number(x),zz=Number(z);
 if(x===''||z===''||!Number.isFinite(xx)||!Number.isFinite(zz)||
    xx<0||xx>15360||zz<0||zz>15360)throw Error('Chernarus X and Z must be 0 to 15360.');
 const o=d.Objects[i],previous=o.pos.slice();
 o.pos=[Number(xx.toFixed(2)),o.pos[1],Number(zz.toFixed(2))];
 return{content:stringify(d,src),changed:Number(previous[0]!==o.pos[0]||previous[2]!==o.pos[2]),
        name:o.name,previous,current:o.pos,index:i};
}
function organizeObjects(src){
 const d=spawnObjects(src),original=d.Objects.map(o=>o.name+'|'+JSON.stringify(o.pos));
 const sorted=d.Objects.map((obj,i)=>({obj,i})).sort((a,b)=>
   a.obj.name.localeCompare(b.obj.name)||a.i-b.i).map(x=>x.obj);
 d.Objects=sorted;
 return{content:stringify(d,src),changed:Number(original.some((v,i)=>v!==sorted[i].name+'|'+JSON.stringify(sorted[i].pos))),
        total:sorted.length};
}
function spawnGroups(source){
 const doc=xml(source,'playerspawnpoints');
 const generator=doc.documentElement.querySelector(':scope > fresh > generator_posbubbles');
 if(!generator)throw Error('Fresh generator_posbubbles was not found.');
 const groups=[...generator.children].filter(el=>el.nodeName==='group');
 if(groups.length)return groups.map(g=>g.getAttribute('name')).filter(Boolean);
 return ['Direct positions'];
}
function addSpawnPoint(src,x,z,groupName=''){
 const doc=xml(src,'playerspawnpoints');
 const fresh=doc.documentElement.querySelector(':scope > fresh');
 const container=fresh?.querySelector(':scope > generator_posbubbles');
 if(!container)throw Error('Fresh generator_posbubbles was not found.');
 const xx=Number(x),zz=Number(z);
 if(x===''||z===''||!Number.isFinite(xx)||!Number.isFinite(zz)||
    xx<0||xx>15360||zz<0||zz>15360)
   throw Error('X/Z must be inside Chernarus (0–15360).');
 const X=Number(xx.toFixed(2)),Z=Number(zz.toFixed(2));
 for(const point of container.querySelectorAll('pos')){
   if(Math.abs(Number(point.getAttribute('x'))-X)<1&&Math.abs(Number(point.getAttribute('z'))-Z)<1)
     throw Error('A player spawn already exists within 1 meter of this position.');
 }
 const groups=[...container.children].filter(el=>el.nodeName==='group');
 let target;
 if(groups.length){
   const name=String(groupName||'');
   if(!name||!groups.some(g=>g.getAttribute('name')===name))
     throw Error('Select an existing fresh-spawn group before adding a position.');
   target='group';
 }else{
   if(groupName&&groupName!=='Direct positions')throw Error('This spawn file has no named groups.');
   target='generator_posbubbles';
 }
 const ranges=commentRanges(src),eligible=[];
 for(const m of src.matchAll(/<generator_posbubbles\b[^>]*>[\s\S]*?<\/generator_posbubbles\s*>/gi)){
   if(!outside(ranges,m.index,m.index+m[0].indexOf('>')+1))continue;
   const outerStart=src.slice(0,m.index);
   if(outerStart.lastIndexOf('<fresh')<=outerStart.lastIndexOf('</fresh'))continue;
   eligible.push(m);
 }
 if(eligible.length!==1)throw Error('Fresh spawn group cannot be identified uniquely.');
 const outer=eligible[0],nl=u(src).nl;
 let begin,closing,indent;
 if(target==='group'){
   const groupsInSource=[];
   for(const m of outer[0].matchAll(/<group\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/group\s*>/gi)){
     const start=outer.index+m.index;
     if(outside(ranges,start,start+m[0].indexOf('>')+1)&&m[2]===groupName)groupsInSource.push({m,start});
   }
   if(groupsInSource.length!==1)throw Error('Named group could not be located safely in XML.');
   const selected=groupsInSource[0];
   closing=selected.start+selected.m[0].lastIndexOf('</group');
   indent=selected.m[0].match(/(?:\r\n|\n|\r)([ \t]+)<pos\b/)?.[1]||'                ';
 }else{
   closing=outer.index+outer[0].lastIndexOf('</generator_posbubbles');
   indent=outer[0].match(/(?:\r\n|\n|\r)([ \t]+)<pos\b/)?.[1]||'            ';
 }
 const prefix=src.slice(0,closing),entry=indent+'<pos x="'+X+'" z="'+Z+'" />'+nl;
 const content=prefix+(prefix.endsWith(nl)?'':nl)+entry+src.slice(closing);
 const checked=xml(content,'playerspawnpoints');
 const after=checked.documentElement.querySelector(':scope > fresh > generator_posbubbles');
 if(after?.querySelectorAll('pos').length!==container.querySelectorAll('pos').length+1)
   throw Error('Player spawn count verification failed.');
 return{content,changed:1,x:X,z:Z,group:groupName||'Direct positions'};
}
root.BUILD_IT_SERVER_EXTENSIONS=Object.freeze({
 GAMEPLAY_SETTINGS,gameplayEntries,changeGameplay,weatherEntries,changeWeather,
 objectList,changeObjectPosition,organizeObjects,spawnGroups,addSpawnPoint
});
})(window);
