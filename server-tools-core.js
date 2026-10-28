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
  function ignoredXmlRanges(source){
    return [...source.matchAll(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g)]
      .map(m=>[m.index,m.index+m[0].length]);
  }
  function inXmlComment(ranges,position){return ranges.some(([a,b])=>position>=a&&position<b);}
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
    const tier=String(options?.tier||'');
    if(tier&&!/^Tier[1-4]$/.test(tier))throw new Error('Select a valid DayZ loot tier.');
    if(only&&!/^[A-Za-z0-9_]+$/.test(only))throw new Error('Invalid classname filter.');
    let changed=0,skipped=0,matched=0;
    const ignored=ignoredXmlRanges(source);
    const fieldRe=new RegExp('(<'+field+'\\s*>)(\\s*)(\\d+)(\\s*)(<\\/'+field+'\\s*>)','i');
    const result=source.replace(/<type\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/type\s*>/gi,(block,quote,name,offset)=>{
      if(inXmlComment(ignored,offset))return block;
      if(only&&name.toLowerCase()!==only.toLowerCase())return block;
      // Only target entries with an explicit <value name="TierN"/>.
      // Custom user aliases are deliberately not guessed.
      if(tier&&!new RegExp('<value\\b[^>]*\\bname\\s*=\\s*(["\\x27])'+tier+'\\1','i').test(block))return block;
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
    if(!matched)throw new Error(tier?'No explicit '+tier+' entries matched. Custom tier aliases are not expanded.':only?'No type named '+only+' exists in this file.':'No <type> entries found.');
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

  // CE globals editor — only changes an existing numeric "value" attribute.
  // All unrelated XML nodes, comments and formatting remain exactly intact.
  function globalsList(source){
    const doc=xmlDoc(source,'variables'),vars=[];
    for(const element of doc.documentElement.children){
      if(element.nodeName!=='var')continue;
      const name=element.getAttribute('name'),type=element.getAttribute('type'),value=element.getAttribute('value');
      if(name&&['0','1'].includes(type)&&value!==null)
        vars.push({name,type,value});
    }
    return vars;
  }
  function editGlobal(source,name,newValue){
    const vars=globalsList(source);
    const target=vars.find(v=>v.name===name);
    if(!target)throw new Error('Select an existing numeric global from globals.xml.');
    if(vars.filter(v=>v.name===name).length!==1)throw new Error('Duplicate global '+name+'; manual repair required.');
    const number=Number(newValue);
    if(newValue===''||!Number.isFinite(number)||Math.abs(number)>100000000)
      throw new Error('A finite numeric value is required (maximum 100,000,000).');
    if(target.type==='0'&&!Number.isSafeInteger(number))
      throw new Error(name+' requires an integer.');
    const attr=/(^|[\s])name\s*=\s*(["'])(.*?)\2/i;
    const valueAttr=/(\bvalue\s*=\s*)(["'])([^"']*)\2/i;
    let matched=0;
    const ignored=ignoredXmlRanges(source);
    const content=source.replace(/<var\b[^>]*\/\s*>/gi,(tag,offset)=>{
      if(inXmlComment(ignored,offset))return tag;
      const label=tag.match(attr);
      if(!label||label[3]!==name)return tag;
      matched++;
      if(!valueAttr.test(tag))throw new Error(name+' has no value attribute.');
      return tag.replace(valueAttr,(_,prefix,quote)=>prefix+quote+String(number)+quote);
    });
    if(matched!==1)throw new Error('Could not safely find one '+name+' entry in the source XML.');
    xmlDoc(content,'variables');
    return {content,changed:target.value!==String(number)?1:0,previous:target.value,current:String(number),name};
  }
  function spawnableDuplicates(source){
    const doc=xmlDoc(source,'spawnabletypes'),seen=new Map(),findings=[];
    let total=0;
    for(const item of doc.documentElement.children){
      if(item.nodeName!=='type')continue;
      total++;
      const name=item.getAttribute('name')||'';
      if(!name){findings.push('Unnamed spawnable type at entry '+total);continue;}
      const key=name.toLowerCase();
      if(seen.has(key))findings.push('Duplicate spawnable type '+name+' at entries '+seen.get(key)+' and '+total);
      else seen.set(key,total);
    }
    return {total,findings};
  }
  function objectDuplicates(source){
    const data=JSON.parse(source);
    if(!data||Array.isArray(data)||!Array.isArray(data.Objects))
      throw new Error('Expected DayZ JSON Object Spawner with Objects[].');
    const positions=new Map(),findings=[];
    for(let i=0;i<data.Objects.length;i++){
      const object=data.Objects[i];
      if(!object||typeof object.name!=='string'||!Array.isArray(object.pos)||
         object.pos.length!==3||object.pos.some(n=>typeof n!=='number'||!Number.isFinite(n)))
        throw new Error('Invalid object at entry '+(i+1));
      const key=object.name.toLowerCase()+'|'+object.pos.map(n=>n.toFixed(3)).join('|');
      if(positions.has(key))findings.push('Duplicate '+object.name+' at entries '+positions.get(key)+' and '+(i+1));
      else positions.set(key,i+1);
    }
    return {total:data.Objects.length,findings};
  }


  // Append a repeat notification to an EXISTING Nitrado messages.xml.
  // Keep all original XML bytes and comments intact.
  function addMessage(source,message,minutes){
    const doc=xmlDoc(source,'messages');
    const text=String(message||'').trim();
    const interval=Number(minutes);
    if(!text||text.length>160)throw new Error('Message must be 1 to 160 characters.');
    if(!Number.isInteger(interval)||interval<1||interval>1440)
      throw new Error('Repeat interval must be between 1 and 1440 minutes.');
    if(text.includes('#tmin'))
      throw new Error('Countdown placeholder #tmin cannot be used in a simple repeat notification.');
    for(const item of doc.documentElement.children){
      if(item.nodeName!=='message')continue;
      const old=item.getElementsByTagName('text')[0]?.textContent?.trim();
      const repeat=item.getElementsByTagName('repeat')[0]?.textContent?.trim();
      if(old===text&&repeat===String(interval))
        throw new Error('Identical message and repeat interval already exist.');
    }
    const closing=[...source.matchAll(/<\/messages\s*>/gi)].pop();
    if(!closing)throw new Error('messages.xml has no closing </messages> tag.');
    const newline=source.includes('\r\n')?'\r\n':source.includes('\n')?'\n':'\r';
    const escape=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
    const snippet='    <message>'+newline+
      '        <repeat>'+interval+'</repeat>'+newline+
      '        <text>'+escape(text)+'</text>'+newline+
      '    </message>'+newline;
    const start=source.slice(0,closing.index),end=source.slice(closing.index);
    const updated=start+(start.endsWith(newline)?'':newline)+snippet+end;
    const doc2=xmlDoc(updated,'messages');
    if(doc2.getElementsByTagName('message').length!==doc.getElementsByTagName('message').length+1)
      throw new Error('Could not safely append message.');
    return {content:updated,changed:1,interval,text};
  }


  function findClassnames(source,term){
    const doc=xmlDoc(source,'types');
    const query=String(term||'').toLowerCase().trim();
    if(query.length<2)throw new Error('Enter at least 2 characters to search classnames.');
    const matches=[];
    let scanned=0;
    for(const element of doc.documentElement.children){
      if(element.nodeName!=='type')continue;
      scanned++;
      const name=element.getAttribute('name')||'';
      if(name.toLowerCase().includes(query)){
        const nominal=element.getElementsByTagName('nominal')[0]?.textContent?.trim()||'—';
        const min=element.getElementsByTagName('min')[0]?.textContent?.trim()||'—';
        matches.push({name,nominal,min});
      }
    }
    return {scanned,total:matches.length,results:matches.slice(0,100)};
  }


  // Edit an existing spawnable classname only; never invent attachments,
  // damage rules, or new spawnable entries.
  function editSpawnableChance(source,classname,section,newChance){
    xmlDoc(source,'spawnabletypes');
    const name=String(classname||'').trim();
    if(!/^[A-Za-z0-9_]{1,100}$/.test(name))throw new Error('Enter one existing spawnable classname.');
    if(!['attachments','cargo'].includes(section))throw new Error('Choose attachments or cargo.');
    const chance=Number(newChance);
    if(newChance===''||!Number.isFinite(chance)||chance<0||chance>1)
      throw new Error('Chance must be between 0 and 1.');
    const chanceStr=chance.toFixed(2);
    const ignored=ignoredXmlRanges(source);
    let targetMatches=0,changed=0,groups=0;
    const content=source.replace(/<type\b[^>]*\bname\s*=\s*(["'])([^"']+)\1[^>]*>[\s\S]*?<\/type\s*>/gi,
      (block,quote,current,offset)=>{
      if(inXmlComment(ignored,offset)||current.toLowerCase()!==name.toLowerCase())return block;
      targetMatches++;
      const groupRE=new RegExp('<'+section+'\\b[^>]*>[\\s\\S]*?<\\/'+section+'\\s*>','gi');
      return block.replace(groupRE,group=>{
        groups++;
        // Change only existing chance attributes within this section. Missing
        // chances keep DayZ's default behavior, rather than inserting guesses.
        return group.replace(/\bchance\s*=\s*(["'])([0-9]*\.?[0-9]+)\1/gi,
          (attr,q,old)=>{
          if(Number(old)!==chance)changed++;
          return 'chance='+q+chanceStr+q;
        });
      });
    });
    if(targetMatches!==1)throw new Error(targetMatches?'Duplicate '+name+' entries found; repair before editing.':
      'Spawnable '+name+' does not exist in cfgspawnabletypes.xml.');
    if(!groups)throw new Error(name+' has no existing '+section+' sections to adjust.');
    xmlDoc(content,'spawnabletypes');
    return {content,changed,groups,classname:name,section,chance:chanceStr};
  }

  root.BUILD_IT_SERVER_CORE=Object.freeze({validate,splitJSON,editTypes,eventConflicts,globalsList,editGlobal,spawnableDuplicates,objectDuplicates,addMessage,findClassnames,editSpawnableChance,xmlDoc});
})(window);
