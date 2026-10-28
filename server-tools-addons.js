/* Build It!++ optional DayZ console server-file editors.
 * Only modifies existing Nitrado mission files with known vanilla schemas.
 * Does not call the network or save anything on its own.
 */
(function(root){
'use strict';
function object(src,key){
 let o;try{o=JSON.parse(src);}catch(e){throw Error('Invalid JSON: '+e.message);}
 if(!o||typeof o!=='object'||Array.isArray(o)||!Array.isArray(o[key]))
  throw Error('Existing file needs a '+key+' array.');
 return o;
}
function jsonWrite(src,o){const indent=src.match(/\n([ \t]+)"/)?.[1]||'  ',nl=src.includes('\r\n')?'\r\n':'\n';
 return JSON.stringify(o,null,indent).replace(/\n/g,nl)+(src.endsWith(nl)?nl:'');
}
function location(x,z){let a=Number(x),b=Number(z);
 if(x===''||z===''||!Number.isFinite(a)||!Number.isFinite(b)||a<0||a>15360||b<0||b>15360)
  throw Error('Chernarus X and Z must be between 0 and 15360.');
 return [Number(a.toFixed(2)),Number(b.toFixed(2))];
}
function moveBuild(src,x,z){
 const data=object(src,'Objects'),list=data.Objects;
 if(!list.length||list.length>5000)throw Error('Select a JSON with 1–5000 objects.');
 const [targetX,targetZ]=location(x,z);
 for(const entry of list){
  if(!entry||!Array.isArray(entry.pos)||entry.pos.length!==3||
     entry.pos.some(n=>typeof n!=='number'||!Number.isFinite(n)))
   throw Error('Source JSON has an invalid object coordinate.');
 }
 // Recenter the build around the average position, maintaining relative offsets
 // and Y elevations. No terrain height is assumed.
 const centerX=list.reduce((sum,o)=>sum+o.pos[0],0)/list.length;
 const centerZ=list.reduce((sum,o)=>sum+o.pos[2],0)/list.length;
 const dx=targetX-centerX,dz=targetZ-centerZ;
 for(const o of list){
  const xx=Number((o.pos[0]+dx).toFixed(2)),zz=Number((o.pos[2]+dz).toFixed(2));
  if(xx<0||xx>15360||zz<0||zz>15360)throw Error('One or more moved objects would fall outside the Chernarus map.');
  o.pos=[xx,o.pos[1],zz];
 }
 return {content:jsonWrite(src,data),changed:Number(Math.abs(dx)>1e-5||Math.abs(dz)>1e-5),
  count:list.length,original:[Number(centerX.toFixed(2)),Number(centerZ.toFixed(2))],target:[targetX,targetZ]};
}
function staticZones(src){
 const data=object(src,'Areas'),zones=[];
 for(let i=0;i<data.Areas.length;i++){
  const area=data.Areas[i];
  if(area&&area.Type==='ContaminatedArea_Static'&&area.Data&&
    Array.isArray(area.Data.Pos)&&area.Data.Pos.length===3&&
    typeof area.Data.Radius==='number'&&typeof area.AreaName==='string')
   zones.push({index:i,name:area.AreaName,pos:area.Data.Pos,radius:area.Data.Radius});
 }
 return zones;
}
function addGasZone(src,name,x,y,z,radius){
 const data=object(src,'Areas'),templates=staticZones(src);
 if(!templates.length)throw Error('No existing vanilla static contaminated zone available as a schema template.');
 const title=String(name||'').trim(),Y=Number(y),R=Number(radius);
 const [X,Z]=location(x,z);
 if(!/^[A-Za-z0-9 _-]{2,60}$/.test(title))throw Error('Zone name must be 2–60 letters, numbers, spaces or _-.');
 if(data.Areas.some(a=>String(a?.AreaName||'').toLowerCase()===title.toLowerCase()))
  throw Error('Zone name already exists.');
 if(y===''||!Number.isFinite(Y)||Y< -100||Y>1200)throw Error('Enter a verified ground elevation Y.');
 if(radius===''||!Number.isFinite(R)||R<10||R>300)throw Error('Gas-zone radius must be 10–300 m.');
 const selected=data.Areas[templates[0].index];
 // Clone a working static area: particle names, PPE and height settings
 // remain exactly as already validated by the running mission.
 const area=JSON.parse(JSON.stringify(selected));
 area.AreaName=title;area.Data.Pos=[X,Number(Y.toFixed(2)),Z];area.Data.Radius=Number(R.toFixed(2));
 data.Areas.push(area);
 return {content:jsonWrite(src,data),changed:1,name:title,pos:area.Data.Pos,radius:area.Data.Radius,
   total:data.Areas.length};
}
function tagRanges(src){return [...src.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g)].map(m=>[m.index,m.index+m[0].length]);}
function appendEquipment(src,parent,item,kind,groupChance,itemChance){
 const p=String(parent||'').trim(),i=String(item||'').trim();
 if(!/^[A-Za-z0-9_]{1,100}$/.test(p)||!/^[A-Za-z0-9_]{1,100}$/.test(i))
  throw Error('Use existing valid classnames for the parent and the item.');
 if(!['attachments','cargo'].includes(kind))throw Error('Choose attachments or cargo.');
 const gc=Number(groupChance),ic=Number(itemChance);
 if(groupChance===''||itemChance===''||!Number.isFinite(gc)||!Number.isFinite(ic)||gc<0||gc>1||ic<0||ic>1)
  throw Error('Chances must be between 0 and 1.');
 const parsed=new DOMParser().parseFromString(src,'application/xml');
 if(parsed.querySelector('parsererror')||parsed.documentElement?.nodeName!=='spawnabletypes')
  throw Error('Expected valid cfgspawnabletypes.xml with <spawnabletypes>.');
 const comments=tagRanges(src),matches=[];
 const re=/<type\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/type\s*>/gi;
 for(const m of src.matchAll(re)){
  if(comments.some(([a,b])=>m.index>=a&&m.index<b)||m[2]!==p)continue;
  matches.push(m);
 }
 if(matches.length!==1)throw Error(matches.length?'Duplicate parent classname in spawnabletypes.':'Parent classname does not exist in spawnabletypes.');
 const m=matches[0],old=m[0],end=old.search(/<\/type\s*>/i);
 if(end<0)throw Error('No closing type element.');
 const nl=src.includes('\r\n')?'\r\n':'\n';
 const indent=old.match(/(?:\r\n|\n|\r)([ \t]+)<(?:attachments|cargo|damage)\b/)?.[1]||
   ((src.match(/(?:\r\n|\n|\r)([ \t]+)<type\b/)?.[1]||'  ')+'  ');
 const inner=indent+'  ';
 const section=nl+indent+'<'+kind+' chance="'+gc.toFixed(2)+'">'+nl+
   inner+'<item name="'+i+'" chance="'+ic.toFixed(2)+'" />'+nl+
   indent+'</'+kind+'>'+nl;
 const updated=src.slice(0,m.index+end)+section+src.slice(m.index+end);
 const recheck=new DOMParser().parseFromString(updated,'application/xml');
 if(recheck.querySelector('parsererror')||recheck.documentElement?.nodeName!=='spawnabletypes')
  throw Error('Generated spawnable XML failed validation.');
 return {content:updated,changed:1,parent:p,item:i,kind,groupChance:gc,itemChance:ic};
}
function economyStats(src){
 const doc=new DOMParser().parseFromString(src,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement?.nodeName!=='types')
  throw Error('Expected valid types.xml.');
 const types=[...doc.documentElement.children].filter(e=>e.nodeName==='type');
 const total=types.reduce((sum,e)=>sum+Number(e.getElementsByTagName('nominal')[0]?.textContent||0),0);
 const byCategory=new Map();
 for(const t of types){
  const category=t.getElementsByTagName('category')[0]?.getAttribute('name')||'Uncategorized';
  const nominal=Number(t.getElementsByTagName('nominal')[0]?.textContent||0);
  const row=byCategory.get(category)||{name:category,count:0,nominal:0};
  row.count++;row.nominal+=Number.isFinite(nominal)?nominal:0;byCategory.set(category,row);
 }
 return{totalTypes:types.length,nominalTotal:total,categories:[...byCategory.values()].sort((a,b)=>b.nominal-a.nominal)};
}

function territoryTypes(src){
 const doc=new DOMParser().parseFromString(src,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement?.nodeName!=='territory-type')
  throw Error('Expected vanilla <territory-type> zombie_territories.xml.');
 const names=new Map();
 for(const zone of doc.documentElement.querySelectorAll('territory > zone')){
   const name=zone.getAttribute('name')||'';
   if(!/^[A-Za-z0-9_]+$/.test(name))continue;
   names.set(name,(names.get(name)||0)+1);
 }
 return[...names].map(([name,count])=>({name,count})).sort((a,b)=>a.name.localeCompare(b.name));
}
function addHorde(src,type,x,z,radius,minCount,maxCount){
 const available=territoryTypes(src),classname=String(type||'').trim();
 if(!available.some(e=>e.name===classname))
  throw Error('Choose an existing infected event type from zombie_territories.xml.');
 const [X,Z]=location(x,z);
 const radiusN=Number(radius),min=Number(minCount),max=Number(maxCount);
 if(radius===''||!Number.isFinite(radiusN)||radiusN<10||radiusN>300)
  throw Error('Horde radius must be 10–300 meters.');
 if(minCount===''||maxCount===''||!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>75||min>max)
  throw Error('Infected min/max must be whole numbers between 1 and 75, min ≤ max.');
 const re=/<territory\b[^>]*>[\s\S]*?<\/territory\s*>/gi;
 const comments=tagRanges(src);
 let parent=null;
 for(const match of src.matchAll(re)){
   if(comments.some(([a,b])=>match.index>=a&&match.index<b))continue;
   const group=new DOMParser().parseFromString('<territory-type>'+match[0]+'</territory-type>','application/xml');
   if(group.querySelector('parsererror'))continue;
   const zones=[...group.querySelectorAll('territory > zone')];
   if(!zones.some(e=>e.getAttribute('name')===classname))continue;
   if(zones.some(e=>e.getAttribute('name')===classname &&
      Math.hypot(Number(e.getAttribute('x'))-X,Number(e.getAttribute('z'))-Z)<20))
     throw Error('An infected zone of the same type already exists within 20 m.');
   parent=match;break;
 }
 if(!parent)throw Error('Could not locate one existing territory group for '+classname+'.');
 const closing=parent.index+parent[0].lastIndexOf('</territory');
 const nl=src.includes('\r\n')?'\r\n':'\n';
 const indent=parent[0].match(/(?:\r\n|\n|\r)([ \t]+)<zone\b/)?.[1]||'    ';
 const text=indent+'<zone name="'+classname+'" smin="0" smax="0" dmin="'+min+
   '" dmax="'+max+'" x="'+X+'" z="'+Z+'" r="'+Number(radiusN.toFixed(2))+'" />'+nl;
 const before=src.slice(0,closing);
 const updated=before+(before.endsWith(nl)?'':nl)+text+src.slice(closing);
 const after=territoryTypes(updated);
 if(after.find(e=>e.name===classname)?.count!==available.find(e=>e.name===classname).count+1)
   throw Error('The generated zombie territory did not validate.');
 return{content:updated,changed:1,type:classname,x:X,z:Z,min,max,radius:radiusN};
}

root.BUILD_IT_SERVER_ADDONS=Object.freeze({moveBuild,staticZones,addGasZone,appendEquipment,economyStats,territoryTypes,addHorde});
})(window);
