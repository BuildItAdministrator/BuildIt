/* Build It!++ validated console-only economy and character helpers. */
(function(root){
'use strict';
function parseJSON(src){let d;try{d=JSON.parse(src);}catch(e){throw Error('Invalid JSON: '+e.message);}
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Expected JSON object.');
 return d;
}
function jsonWrite(src,d){const indent=src.match(/\n([ \t]+)"/)?.[1]||'  ',nl=src.includes('\r\n')?'\r\n':'\n';
 return JSON.stringify(d,null,indent).replace(/\n/g,nl)+(src.endsWith(nl)?nl:'');}
function xml(src,rootName){
 const doc=new DOMParser().parseFromString(src,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement?.nodeName!==rootName)
  throw Error('Expected valid <'+rootName+'> XML.');
 const encoding=src.match(/^\uFEFF?\s*<\?xml[^?]*encoding\s*=\s*(['"])(.*?)\1/i);
 if(encoding&&!/^utf-?8$/i.test(encoding[2]))throw Error('Non-UTF8 XML encoding cannot be rewritten safely.');
 return doc;
}
function ignored(src){return [...src.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g)].map(m=>[m.index,m.index+m[0].length]);}
function inside(ranges,offset){return ranges.some(([a,b])=>offset>=a&&offset<b);}
function addIgnore(src,classname){
 const doc=xml(src,'ignore'),name=String(classname||'').trim();
 if(!/^[A-Za-z0-9_]{1,100}$/.test(name))throw Error('Enter a valid existing DayZ classname.');
 if([...doc.documentElement.children].some(e=>e.nodeName==='type'&&e.getAttribute('name')===name))
  throw Error(name+' is already in cfgIgnoreList.xml.');
 const match=[...src.matchAll(/<\/ignore\s*>/gi)].pop();
 if(!match)throw Error('Missing closing ignore tag.');
 const nl=src.includes('\r\n')?'\r\n':'\n';
 const prefix=src.slice(0,match.index);
 const output=prefix+(prefix.endsWith(nl)?'':nl)+'    <type name="'+name+'"/>'+nl+src.slice(match.index);
 const checked=xml(output,'ignore');
 if([...checked.documentElement.children].filter(e=>e.nodeName==='type'&&e.getAttribute('name')===name).length!==1)
  throw Error('Ignore list entry could not be verified.');
 return{content:output,changed:1,name};
}
function organizeTypes(src){
 const doc=xml(src,'types'),types=[...doc.documentElement.children].filter(e=>e.nodeName==='type');
 if(!types.length)throw Error('No types in types.xml.');
 const re=/<type\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/type\s*>/gi;
 const ranges=ignored(src),matches=[...src.matchAll(re)];
 if(matches.some(m=>inside(ranges,m.index))||matches.length!==types.length)
  throw Error('Unexpected or commented type entries — sorting disabled to preserve comments.');
 const names=matches.map(m=>m[2]),lower=names.map(n=>n.toLowerCase());
 if(new Set(lower).size!==lower.length)throw Error('Duplicate type classnames. Repair duplicates before sorting.');
 if(matches.some((m,i)=>i>0 && !/^\s*$/.test(src.slice(matches[i-1].index+matches[i-1][0].length,m.index))))
  throw Error('Comments or other text between types; sorting disabled to prevent misplaced annotations.');
 const delimiter=matches.length>1?src.slice(matches[0].index+matches[0][0].length,matches[1].index):(src.includes('\r\n')?'\r\n':'\n');
 const sorted=matches.map(m=>({name:m[2],block:m[0]})).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base'}));
 const begin=matches[0].index,end=matches.at(-1).index+matches.at(-1)[0].length;
 const output=src.slice(0,begin)+sorted.map(x=>x.block).join(delimiter)+src.slice(end);
 xml(output,'types');
 return{content:output,changed:Number(output!==src),count:sorted.length};
}
function eventNames(src){
 const doc=xml(src,'events');
 return[...doc.documentElement.children].filter(e=>e.nodeName==='event')
  .map(e=>e.getAttribute('name')).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}
function editEvent(src,name,field,value){
 xml(src,'events');const target=String(name||''),allowed=['nominal','min','max','lifetime','restock','saferadius','distanceradius','cleanupradius'];
 if(!allowed.includes(field))throw Error('Unsupported event field.');
 const numeric=Number(value);
 if(value===''||!Number.isSafeInteger(numeric)||numeric<0||numeric>1000000)throw Error('Event value must be an integer 0–1,000,000.');
 const matches=[...src.matchAll(/<event\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/event\s*>/gi)]
  .filter(m=>m[2]===target&&!inside(ignored(src),m.index));
 if(matches.length!==1)throw Error('Choose a unique existing event.');
 const m=matches[0],fieldRE=new RegExp('(<'+field+'\\s*>)(\\s*)(\\d+)(\\s*)(<\\/'+field+'\\s*>)','i');
 if(!fieldRE.test(m[0]))throw Error('Event has no existing '+field+' field.');
 const next=m[0].replace(fieldRE,(_,start,spaces,old,end,close)=>start+spaces+numeric+end+close);
 const content=src.slice(0,m.index)+next+src.slice(m.index+m[0].length);
 const doc=xml(content,'events');
 const node=[...doc.documentElement.children].find(e=>e.getAttribute('name')===target);
 const n=fieldname=>Number(node.getElementsByTagName(fieldname)[0]?.textContent||0);
 if(n('min')>n('max'))throw Error('Min cannot exceed max. Set max first.');
 return{content,changed:Number(content!==src),name:target,field,value:numeric};
}
function presetFiles(gameplay){
 const data=parseJSON(gameplay);
 const list=data.PlayerData?.spawnGearPresetFiles;
 if(!Array.isArray(list))return[];
 return list.filter(name=>typeof name==='string'&&/^(?:custom\/)?[A-Za-z0-9_.-]+\.json$/i.test(name));
}
function loadoutDetails(src){
 const data=parseJSON(src);
 if(!Number.isInteger(data.spawnWeight)||data.spawnWeight<1||
  !Array.isArray(data.attachmentSlotItemSets)||!Array.isArray(data.discreteUnsortedItemSets))
  throw Error('Not a compatible DayZ spawn gear preset. Existing valid arrays required.');
 return{name:data.name||'(unnamed)',weight:data.spawnWeight,
   groups:data.discreteUnsortedItemSets.map((g,i)=>({index:i,name:g.name||'Group '+(i+1)}))};
}
function addLoadoutCargo(src,classname){
 const data=parseJSON(src);loadoutDetails(src);
 const name=String(classname||'').trim();
 if(!/^[A-Za-z0-9_]{1,100}$/.test(name))throw Error('Enter a valid item classname.');
 if(!data.discreteUnsortedItemSets.length)
  data.discreteUnsortedItemSets.push({name:'Build It!++ cargo',spawnWeight:1,
    simpleChildrenTypes:[name]});
 else{
  const set=data.discreteUnsortedItemSets[0];
  if(!Array.isArray(set.simpleChildrenTypes))
   throw Error('First cargo group is incompatible; no changes made.');
  if(set.simpleChildrenTypes.includes(name))throw Error('First cargo group already includes '+name+'.');
  set.simpleChildrenTypes.push(name);
 }
 return{content:jsonWrite(src,data),changed:1,item:name,preset:data.name||'(unnamed)'};
}
function triggers(src){
 const data=parseJSON(src);
 if(!Array.isArray(data.Triggers))throw Error('Expected cfgundergroundtriggers.json Triggers array.');
 return data.Triggers.map((t,i)=>({index:i,pos:t.Position||[],darkness:t.EyeAccommodation}))
  .filter(t=>Array.isArray(t.pos)&&t.pos.length===3&&typeof t.darkness==='number');
}
function editTrigger(src,index,value){
 const data=parseJSON(src),entries=triggers(src),i=Number(index),n=Number(value);
 if(!entries.some(e=>e.index===i))throw Error('Select an existing underground trigger.');
 if(value===''||!Number.isFinite(n)||n<0||n>1)throw Error('Eye accommodation must be 0–1.');
 const previous=data.Triggers[i].EyeAccommodation;
 data.Triggers[i].EyeAccommodation=n;
 return{content:jsonWrite(src,data),changed:Number(previous!==n),previous,current:n,index:i};
}
root.BUILD_IT_SERVER_FINAL=Object.freeze({
 addIgnore,organizeTypes,eventNames,editEvent,presetFiles,loadoutDetails,addLoadoutCargo,triggers,editTrigger
});
})(window);
