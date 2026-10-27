/* Build It!++ live DayZ PS custom bases, read-only Nitrado sync.
 * Cloudflare Worker endpoints: /api/files/list, /api/files/read (small),
 * and /api/files/custom-content (streamed read-only custom JSON).
 * No file is changed on the live DayZ server. Does not cache raw server JSON.
 */
(function () {
  'use strict';
  const filter=document.getElementById('filterCustomBases');
  const panel=document.getElementById('filterPanel');
  if (!filter || !panel || typeof nitradoRequest!=='function' ||
      typeof window.BUILD_IT_renderCustomBases!=='function') return;

  const row=filter.closest('.filter-row')||filter.parentElement;
  const section=document.createElement('div');
  section.id='customBasesSync';
  section.innerHTML=[
    '<button type="button" class="log-btn" id="customBasesRefresh">↻ Refresh from Nitrado</button>',
    '<div class="filter-note" id="customBasesSyncStatus" role="status" aria-live="polite">Saved base preview. Connect Nitrado to load custom files automatically.</div>'
  ].join('');
  section.style.cssText='padding:4px 2px 9px;';
  if(row) row.insertAdjacentElement('afterend',section);else panel.appendChild(section);
  const button=section.querySelector('#customBasesRefresh');
  const status=section.querySelector('#customBasesSyncStatus');
  button.style.cssText='width:100%;padding:8px 10px;border-radius:7px;font-size:11px;cursor:pointer;';
  status.style.cssText='line-height:1.5;overflow-wrap:anywhere;';
  const MAX_EDITOR_READ_BYTES=512*1024; // Unchanged File Manager edit/download safety limit.
  const MAX_CUSTOM_READ_BYTES=20*1024*1024; // Streamed, read-only custom spawner JSON.
  const MAX_JSON_FILES=200;
  const MAX_DIRECTORY_SCANS=60;
  const MIN_REFRESH_MS=5*60*1000;
  let busy=false,lastLoaded=0,liveCount=0,liveFiles=0,failedFiles=[];

  function display(text,failed=false){
    status.textContent=text;
    status.style.color=failed?'#f17c7c':'';
    status.title=text;
  }

  function hasConnection(){
    const worker=document.getElementById('nitradoWorkerUrl')?.value.trim();
    const access=document.getElementById('nitradoAccessKey')?.value.trim();
    return Boolean(worker&&access);
  }

  function normalizeRoot(root){
    const match=String(root||'').match(/^\/games\/([a-zA-Z0-9_-]{1,100})\/(?:noftp|ftproot)$/);
    if(!match) throw new Error('Unexpected Nitrado file root. Open the File Manager to verify server access.');
    return [
      '/games/'+match[1]+'/ftproot',
      '/games/'+match[1]+'/noftp'
    ];
  }

  function safePath(path,roots){
    return typeof path==='string' && path.startsWith('/') &&
      !path.includes('//') && !path.includes('/../') && !path.includes('/./') &&
      roots.some(root=>path===root||path.startsWith(root+'/'));
  }

  async function readFolder(dir=''){
    const route='/api/files/list'+(dir?'?dir='+encodeURIComponent(dir):'');
    const result=await nitradoRequest(route);
    if(!Array.isArray(result?.entries))throw new Error('Invalid directory listing from Nitrado.');
    return result;
  }

  // Small JSON retains compatibility with the existing Worker. Larger object
  // spawner JSON uses the new streamed, read-only endpoint.
  async function readObjectSpawnerFile(item){
    const query='?file='+encodeURIComponent(item.path);
    if(item.size>0 && item.size<=MAX_EDITOR_READ_BYTES){
      try{
        const response=await nitradoRequest('/api/files/read'+query);
        if(response?.path!==item.path||typeof response.content!=='string')
          throw new Error('Invalid file response');
        return response.content;
      }catch(error){
        // Nitrado may advertise a stale or incorrect size. Retry by streaming
        // only if the old endpoint rejected the file for being too large.
        if(!/512\\s*KB|too large|exceed|413/i.test(String(error.message||error)))throw error;
      }
    }
    const base=normalizeWorkerUrl(document.getElementById('nitradoWorkerUrl').value);
    if(!base)throw new Error('Missing Nitrado Worker URL');
    const url=base+'/api/files/custom-content'+query;
    const response=await fetch(url,{headers:nitradoHeaders(),cache:'no-store'});
    if(!response.ok){
      // Nitrado sometimes omits file sizes in directory metadata.
      if(item.size===0 && (response.status===404 || response.status===405)){
        const fallback=await nitradoRequest('/api/files/read'+query);
        if(fallback?.path!==item.path||typeof fallback.content!=='string')
          throw new Error('Invalid file response');
        return fallback.content;
      }
      if(response.status===404 || response.status===405){
        throw new Error('Deploy the large-custom-file Worker upgrade (stream endpoint missing)');
      }
      let detail='';
      try{
        const error=await response.json();
        detail=String(error?.error||error?.message||'').slice(0,160);
      }catch(_){}
      throw new Error('Large custom file HTTP '+response.status+(detail?': '+detail:''));
    }
    const claimed=Number(response.headers.get('content-length')||0);
    if(claimed>MAX_CUSTOM_READ_BYTES)throw new Error('Exceeds 20 MB map limit');
    const text=await response.text();
    if(new Blob([text]).size>MAX_CUSTOM_READ_BYTES)throw new Error('Exceeds 20 MB map limit');
    return text;
  }

  function isLoadout(path){
    return /(?:load[\s_-]*out|player[\s_-]*loadout|spawn[\s_-]*gear)/i.test(String(path));
  }

  function readableName(filename){
    let label=String(filename).replace(/\.json$/i,'')
      .replace(/^objects?[_\s.-]*/i,'')
      .replace(/[_-]+/g,' ')
      .replace(/([a-z])([A-Z])/g,'$1 $2')
      .trim();
    if(/^base(?=[a-z])/i.test(label))label=label.slice(4).trim()+' Base';
    if(!label)label='Custom objects';
    return label.replace(/\b[a-z]/g,c=>c.toUpperCase());
  }

  // The documented DayZ Object Spawner format uses [X, height, Z].
  // The height component is NEVER used as the map's north/south axis.
  function positionFrom(object){
    const raw=object?.pos||object?.position;
    let x,z;
    if(Array.isArray(raw)&&raw.length>=3){
      x=Number(raw[0]);z=Number(raw[2]);
    }else if(raw&&typeof raw==='object'){
      x=Number(raw.x);z=Number(raw.z);
    }else return null;
    if(!Number.isFinite(x)||!Number.isFinite(z)||
       x<0||z<0||x>15360||z>15360)return null;
    return [x,z];
  }

  function collectPositions(data){
    const items=Array.isArray(data?.Objects)?data.Objects:
      Array.isArray(data?.objects)?data.objects:null;
    if(!items)return null; // Loadouts, config, and other non-spawner JSON are not bases.
    return items.map(positionFrom).filter(Boolean);
  }

  function hull(points){
    if(points.length<3)return [];
    const list=[...new Map(points.map(([x,z])=>[x.toFixed(2)+'/'+z.toFixed(2),[x,z]])).values()]
      .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    if(list.length<3)return [];
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const lower=[],upper=[];
    for(const p of list){
      while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();
      lower.push(p);
    }
    for(let i=list.length-1;i>=0;i--){
      const p=list[i];
      while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();
      upper.push(p);
    }
    lower.pop();upper.pop();
    return lower.concat(upper).map(([x,z])=>[+x.toFixed(2),+z.toFixed(2)]);
  }

  // Group a file's objects by connected 100-metre map cells. A file may
  // contain multiple POIs across Chernarus; never draw one enormous polygon.
  function splitClusters(points){
    const CELL=100;
    const cells=new Map();
    for(const p of points){
      const gx=Math.floor(p[0]/CELL),gz=Math.floor(p[1]/CELL),key=gx+':'+gz;
      if(!cells.has(key))cells.set(key,{gx,gz,points:[]});
      cells.get(key).points.push(p);
    }
    const seen=new Set(),groups=[];
    for(const [key,node] of cells){
      if(seen.has(key))continue;
      const queue=[node],bucket=[];seen.add(key);
      for(let i=0;i<queue.length;i++){
        const cell=queue[i];bucket.push(...cell.points);
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
          const nkey=(cell.gx+dx)+':'+(cell.gz+dz);
          if(!seen.has(nkey)&&cells.has(nkey)){
            seen.add(nkey);queue.push(cells.get(nkey));
          }
        }
      }
      groups.push(bucket);
    }
    return groups.sort((a,b)=>b.length-a.length);
  }

  function basesForFile(path,text){
    const content=JSON.parse(text);
    const points=collectPositions(content);
    if(points===null)return {type:'not-spawner',bases:[]};
    if(!points.length)return {type:'no-valid-positions',bases:[]};
    const clusters=splitClusters(points);
    const name=readableName(path.split('/').pop());
    return {
      type:'spawner',
      bases:clusters.map((group,i)=>{
        let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,sumX=0,sumZ=0;
        for(const [x,z] of group){
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);
          minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
          sumX+=x;sumZ+=z;
        }
        const width=maxX-minX,height=maxZ-minZ;
        return {
          name:clusters.length===1?name:name+' ('+(i+1)+'/'+clusters.length+')',
          file:path,
          x:sumX/group.length,z:sumZ/group.length,
          objects:group.length,footprintObjects:group.length,
          width,height,
          hull:width<500&&height<500?hull(group):[]
        };
      })
    };
  }

  async function locateCustomFolder(){
    const initial=await readFolder();
    const roots=normalizeRoot(initial.root);
    // Both roots, then both known console mission locations. No arbitrary filesystem crawl.
    for(const root of roots){
      for(const mission of ['dayzps_missions/dayzOffline.chernarusplus','mpmissions/dayzOffline.chernarusplus']){
        const candidate=root+'/'+mission+'/custom';
        try{
          const response=await readFolder(candidate);
          if(response.dir!==candidate || !Array.isArray(response.entries))continue;
          return {candidate,roots,initial:response};
        }catch(_){}
      }
    }
    throw new Error('Custom folder not found in the Chernarus mission. Check FTP root → dayzps_missions → dayzOffline.chernarusplus → custom.');
  }

  async function listCustomJson(base,roots,initial){
    const files=[],directories=[{path:base,listing:initial}];
    const visited=new Set();
    let scanned=0,skippedLoadouts=0,skippedOthers=0;
    while(directories.length){
      const current=directories.shift();
      if(visited.has(current.path))continue;
      visited.add(current.path);
      if(++scanned>MAX_DIRECTORY_SCANS)throw new Error('More than '+MAX_DIRECTORY_SCANS+' custom folders. Narrow the custom directory.');
      const response=current.listing||await readFolder(current.path);
      for(const item of response.entries){
        const path=String(item.path||'');
        if(!safePath(path,roots)||!path.startsWith(base+'/'))continue;
        const name=String(item.name||path.split('/').pop());
        const type=String(item.type||'file').toLowerCase();
        if(isLoadout(path)){skippedLoadouts++;continue;}
        if(['dir','directory','folder'].includes(type)){
          directories.push({path});continue;
        }
        if(!/\.json$/i.test(name)){skippedOthers++;continue;}
        if(files.length>=MAX_JSON_FILES)throw new Error('More than '+MAX_JSON_FILES+' custom JSON files; sync limit reached.');
        files.push({name,path,size:Number(item.size)||0});
      }
    }
    return {files,skippedLoadouts,skippedOthers};
  }

  async function reload({manual=false}={}){
    if(busy)return;
    if(!hasConnection()){
      display('Saved base preview. Enter the Worker URL and Map Access Key in Logs → Automatic Nitrado Sync.',manual);
      return;
    }
    busy=true;button.disabled=true;
    let folder='',scan;
    try{
      display('Locating live Chernarus custom folder…');
      const found=await locateCustomFolder();
      folder=found.candidate;
      scan=await listCustomJson(folder,found.roots,found.initial);
      const bases=[],failures=[],skips=[];
      let mappedFiles=0;
      for(let i=0;i<scan.files.length;i++){
        const item=scan.files[i];
        display('Reading custom object files: '+(i+1)+'/'+scan.files.length+' ('+item.name+')');
        if(item.size>MAX_CUSTOM_READ_BYTES){
          failures.push(item.name+' (exceeds 20 MB map limit)');
          continue;
        }
        try{
          const text=await readObjectSpawnerFile(item);
          const parsed=basesForFile(item.path,text);
          if(parsed.type==='spawner'){
            mappedFiles++;
            bases.push(...parsed.bases);
          }else skips.push(item.name+' ('+parsed.type+')');
        }catch(e){
          failures.push(item.name+' ('+String(e.message||e).slice(0,80)+')');
        }
      }
      if(scan.files.length>0&&mappedFiles===0&&failures.length){
        throw new Error('No custom bases could be read. '+failures.slice(0,3).join('; '));
      }
      // Only replace the embedded preview once the live folder was located
      // and parsed. Empty folders correctly render zero custom bases.
      window.BUILD_IT_renderCustomBases(bases);
      liveCount=bases.length;
      liveFiles=mappedFiles;
      failedFiles=failures;
      lastLoaded=Date.now();
      const message='Live Nitrado: '+mappedFiles+'/'+scan.files.length+' object files mapped ('+
        bases.length+' map locations). Loadouts excluded: '+scan.skippedLoadouts+
        '. Other formats skipped: '+(scan.skippedOthers+skips.length)+
        '. Source: '+folder.split('/').slice(-2).join('/')+'.'+
        (failures.length?' COULD NOT LOAD: '+failures.join('; ')+
        '. These files are NOT shown.':'');
      display(message,failures.length>0);
    }catch(error){
      display('Custom Bases sync failed: '+String(error.message||error)+
        '. Previously displayed base markers remain; no Nitrado files were changed.',true);
    }finally{
      busy=false;button.disabled=false;
    }
  }

  button.addEventListener('click',()=>reload({manual:true}));
  filter.addEventListener('change',()=>{
    if(filter.checked&&Date.now()-lastLoaded>60000)reload();
  });
  document.getElementById('nitradoAccessKey')?.addEventListener('change',()=>reload());
  document.getElementById('nitradoWorkerUrl')?.addEventListener('change',()=>reload());
  // On page open, load the latest server data even if Custom Bases is hidden.
  setTimeout(()=>{if(hasConnection())reload();},1200);
  setInterval(()=>{
    if(filter.checked&&hasConnection()&&Date.now()-lastLoaded>=MIN_REFRESH_MS)reload();
  },MIN_REFRESH_MS);

  // Expose read-only state for regression tests (never keys or raw JSON).
  window.BUILD_IT_customBasesSync={
    refresh:()=>reload({manual:true}),
    summary:()=>({count:liveCount,mappedFiles:liveFiles,failedFiles:[...failedFiles],lastLoaded})
  };
})();
