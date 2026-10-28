/* Build It!++ vanilla DayZ object-spawner loot exporter.
 * No persistence for untouched loot; pickup switches to normal CE persistence.
 * Writes can be deployed through the connected Nitrado Worker when its create route is installed.
 */
(function(){
  'use strict';
  const FILENAME='builditlootdrop.json';
  const SPAWNER_REF='custom/'+FILENAME;
  const MAX_OBJECTS=200;
  function number(v,min,max,label){
    if(v===null||v===undefined||v==='')throw new Error(label+' is required.');
    const n=Number(v);
    if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+' must be between '+min+' and '+max+'.');
    return n;
  }
  function build(drafts){
    const loot=drafts.filter(d=>d.kind==='loot');
    if(!loot.length)throw new Error('Save a JSON loot drop first.');
    const objects=[];
    for(const d of loot){
      const x=number(d.x,0,15360,'X coordinate');
      const z=number(d.z,0,15360,'Z coordinate');
      const y=number(d.y,-100,1000,'Terrain height (Y) for '+d.name);
      const a=number(d.a,0,359.99,'Rotation');
      const spacing=number(d.spacing??1.5,0.5,10,'Item spacing');
      if(!Array.isArray(d.items)||!d.items.length)throw new Error(d.name+' has no items.');
      const expanded=[];
      for(const item of d.items){
        if(!/^[A-Za-z0-9_]{1,100}$/.test(item.name||''))throw new Error('Invalid loot classname in '+d.name);
        const qty=number(item.qty,1,20,'Quantity for '+item.name);
        if(!Number.isInteger(qty))throw new Error('Loot quantities must be whole numbers.');
        for(let i=0;i<qty;i++)expanded.push(item.name);
      }
      if(objects.length+expanded.length>MAX_OBJECTS)throw new Error('Maximum '+MAX_OBJECTS+' total spawned items. Reduce quantities.');
      const cols=Math.ceil(Math.sqrt(expanded.length));
      const rows=Math.ceil(expanded.length/cols);
      expanded.forEach((name,i)=>{
        const dx=(i%cols-(cols-1)/2)*spacing;
        const dz=(Math.floor(i/cols)-(rows-1)/2)*spacing;
        // Object Spawner coordinates use [X, elevation Y, Z].
        const ox=Number((x+dx).toFixed(3)),oz=Number((z+dz).toFixed(3));
        if(ox<0||ox>15360||oz<0||oz>15360)
          throw new Error('Items in '+d.name+' extend outside the map.');
        objects.push({name,pos:[ox,y,oz],ypr:[a,0,0],scale:1,enableCEPersistency:false});
      });
    }
    const json=JSON.stringify({Objects:objects},null,2)+'\n';
    const fmt=window.BUILD_IT_FORMAT;
    if(fmt)fmt.validate(FILENAME,json);
    else if(!Array.isArray(JSON.parse(json).Objects))throw new Error('Invalid Object Spawner JSON.');
    return Object.freeze({filename:FILENAME,content:json,count:objects.length,events:loot.length});
  }
  function gameplay(content,filename=SPAWNER_REF){
    const data=JSON.parse(content);
    if(!data||typeof data!=='object'||Array.isArray(data)||
       !data.WorldsData||typeof data.WorldsData!=='object'||Array.isArray(data.WorldsData))
      throw new Error('Existing cfggameplay.json must contain a WorldsData object. No defaults will be overwritten.');
    if(data.WorldsData.objectSpawnersArr!==undefined&&!Array.isArray(data.WorldsData.objectSpawnersArr))
      throw new Error('WorldsData.objectSpawnersArr must be an array.');
    const arr=data.WorldsData.objectSpawnersArr||[];
    if(!arr.every(v=>typeof v==='string'))throw new Error('Existing spawner entries must be strings.');
    // Retire only references created by older Build It!++ versions.
    // This avoids spawning the same configured loot from two different files.
    const previous=new Set(['BuildIt_LootDrops.json','custom/BuildIt_LootDrops.json']);
    const updated=filename===SPAWNER_REF?arr.filter(ref=>!previous.has(ref)):arr.slice();
    if(!updated.includes(filename))updated.push(filename);
    data.WorldsData.objectSpawnersArr=updated;
    const json=JSON.stringify(data,null,2)+'\n';
    window.BUILD_IT_FORMAT?.validate('cfggameplay.json',json);
    return json;
  }
  function download(filename,content){
    const blob=new Blob([content],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);
    anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  window.BUILD_IT_LOOT=Object.freeze({FILENAME,SPAWNER_REF,MAX_OBJECTS,build,gameplay,download});
})();