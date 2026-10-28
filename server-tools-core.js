/* Build It!++ Server Tools core — client-only transformation helpers.
 * All sources stay local. No automatic Nitrado writes.
 * The XML type editor changes numeric values in-place to preserve file layout
 * and UTF-8 declaration. It deliberately avoids XML serialization.
 */
(function(root){
  'use strict';
  const TYPES_FIELDS=['nominal','min','lifetime','restock','quantmin','quantmax','cost'];
  function xmlDoc(source,expected){
    if(typeof source!=='string'||!source.trim())throw new Error('Upload a nonempty XML file.');
    const doc=new DOMParser().parseFromString(source,'application/xml');
    if(doc.querySelector('parsererror')||doc.documentElement?.localName==='parsererror')
      throw new Error('Invalid XML. Check syntax before editing.');
    if(expected&&doc.documentElement?.nodeName!==expected)
      throw new Error('Expected <'+expected+'>, found <'+doc.documentElement?.nodeName+'>.');
    const enc=source.match(/^\uFEFF?\s*<\?xml\s+[^?]*encoding\s*=\s*["']([^"']+)["']/i);
    if(enc&&!/^utf-?8$/i.test(enc[1]))
      throw new Error('Source declares '+enc[1]+' encoding; in-browser UTF-8 export disabled to prevent corruption.');
    return doc;
  }
  function validate(source,name){
    const filename=String(name||'').toLowerCase();
    if(filename.endsWith('.json')){
      const data=JSON.parse(source);
      if(!data||typeof data!=='object')throw new Error('JSON root must be an object or array.');
      const objects=Array.isArray(data?.Objects)?data.Objects:null;
      const dup=[];
      if(objects){
        const positions=new Map();
        for(let i=0;i<objects.length;i++){
          const item=objects[i];
          if(!item||typeof item.name!=='string'||!Array.isArray(item.pos)||item.pos.length!==3||
             item.pos.some(n=>typeof n!=='number'||!Number.isFinite(n)))
            throw new Error('Object Spawner entry '+(i+1)+' has invalid classname or [X,Y,Z] position.');
          const key=item.name+'|'+item.pos.map(n=>Number(n).toFixed(3)).join(',');
          if(positions.has(key))dup.push('Duplicate object '+item.name+' at entries '+positions.get(key)+' and '+(i+1));
          else positions.set(key,i+1);
        }
      }
      return {kind:'JSON',count:objects?.length||0,warnings:dup,description:objects?'DayZ Object Spawner: '+objects.length+' objects':'Valid JSON'};
    }
    const doc=xmlDoc(source);
    const warnings=[];
    if(filename==='types.xml'&&doc.documentElement.nodeName!=='types')
      throw new Error('types.xml requires <types> root.');
    if(filename==='events.xml'&&doc.documentElement.nodeName!=='events')
      throw new Error('events.xml requires <events> root.');
    if(doc.documentElement.nodeName==='types'){
      const names=new Map();
      for(const el of doc.documentElement.children){
        if(el.nodeName!=='type')continue;
        const name=el.getAttribute('name');
        if(!name){warnings.push('Unnamed <type> entry');continue;}
        if(names.has(name))warnings.push('Duplicate type: '+name);
        names.set(name,true);
      }
    }
    return {kind:'XML',count:doc.documentElement.childElementCount,warnings,description:'Valid XML <'+doc.documentElement.nodeName+'>'};
  }
  function splitJSON(source,size){
    const chunkSize=Number(size);
    if(!Number.isInteger(chunkSize)||chunkSize<1||chunkSize>10000)
      throw new Error('Chunk size must be 1–10,000 entries.');
    const data=JSON.parse(source);
    const rootArray=Array.isArray(data);
    const list=rootArray?data:Array.isArray(data?.Objects)?data.Objects:null;
    if(!list)throw new Error('JSON Splitter supports a root array or an Object Spawner with Objects[]. Other JSON must not be split arbitrarily.');
    if(!list.length)throw new Error('There are no entries to split.');
    if(Math.ceil(list.length/chunkSize)>200)throw new Error('More than 200 output files. Increase chunk size.');
    return Array.from({length:Math.ceil(list.length/chunkSize)},(_,i)=>({
      filename:'buildit_part_'+String(i+1).padStart(3,'0')+'.json',
      content:JSON.stringify(rootArray?list.slice(i*chunkSize,(i+1)*chunkSize):
        {...data,Objects:list.slice(i*chunkSize,(i+1)*chunkSize)},null,2)+'\n',
      count:Math.min(chunkSize,list.length-i*chunkSize)
    }));
  }
  function editTypes(source,options){
    xmlDoc(source,'types');
    const mode=options?.mode;
    if(!['multiply','set'].includes(mode))throw new Error('Choose multiply or set operation.');
    const field=String(options?.field||'');
    if(!TYPES_FIELDS.includes(field))throw new Error('Unsupported types.xml field.');
    const value=Number(options.value);
    if(!Number.isFinite(value)||value<0||value>100000000)
      throw new Error('Value must be between 0 and 100,000,000.');
    if(mode==='multiply'&&value>1000)throw new Error('Multiplier must not exceed 1000.');
    const only=String(options?.classname||'').trim();
    if(only&&!/^[A-Za-z0-9_]+$/.test(only))throw new Error('Invalid classname filter.');
    let changed=0,skipped=0,matched=0;
    const fieldRe=new RegExp('(<'+field+'\\s*>)(\\s*)(\\d+)(\\s*)(<\\/'+field+'\\s*>)','i');
    const result=source.replace(/<type\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/type\s*>/gi,(block,quote,name)=>{
      if(only&&name.toLowerCase()!==only.toLowerCase())return block;
      matched++;
      if(!fieldRe.test(block)){skipped++;return block;}
      return block.replace(fieldRe,(whole,open,white,num,tail,close)=>{
        const previous=Number(num);
        const next=mode==='set'?Math.round(value):Math.round(previous*value);
        if(!Number.isSafeInteger(next)||next<0||next>100000000)throw new Error('Result for '+name+' exceeds supported bounds.');
        if(previous===next)return whole;
        changed++;
        return open+white+next+tail+close;
      });
    });
    if(!matched)throw new Error(only?'No type named '+only+' exists in this file.':'No <type> entries found.');
    xmlDoc(result,'types');
    return {content:result,changed,skipped,matched,field,mode};
  }
  function eventConflicts(source){
    const doc=xmlDoc(source,'events'),findings=[];
    const groups=new Map();
    for(const event of doc.documentElement.children){
      if(event.nodeName!=='event')continue;
      const name=event.getAttribute('name')||'(unnamed)';
      if(groups.has(name))findings.push('Duplicate event name: '+name);
      groups.set(name,true);
      const n=tag=>{const raw=event.getElementsByTagName(tag)[0]?.textContent?.trim();return raw!==undefined&&raw!==''?Number(raw):null;};
      const min=n('min'),max=n('max'),nom=n('nominal');
      if(min!==null&&max!==null&&min>max)findings.push(name+': min ('+min+') exceeds max ('+max+')');
      if(nom!==null&&nom<0)findings.push(name+': nominal is negative');
      if(max!==null&&max<0)findings.push(name+': max is negative');
      for(const type of event.getElementsByTagName('child')){
        if(!type.getAttribute('type'))findings.push(name+': event child has no type');
      }
    }
    return {total:groups.size,findings};
  }
  root.BUILD_IT_SERVER_CORE=Object.freeze({validate,splitJSON,editTypes,eventConflicts,xmlDoc});
})(window);
