/* Build It!++ — authenticated, existing-file Nitrado bridge for Server Tools.
 * No local-file requirements, no passwords persisted, no silent writes.
 * Only an explicitly reviewed, unchanged source may be updated.
 */
(function(){
  'use strict';
  const ALLOWED=/^(?:(?:db|custom|env)\/)?[A-Za-z0-9_.-]+\.(?:xml|json|txt)$/i;
  const MAX_BYTES=4*1024*1024;
  const utf8=s=>new TextEncoder().encode(s).byteLength;
  const requireRequest=()=>{
    if(typeof nitradoRequest!=='function')
      throw new Error('Nitrado connection is not available. Reload Build It!++.');
    const worker=document.getElementById('nitradoWorkerUrl');
    const key=document.getElementById('nitradoAccessKey');
    if(!worker?.value.trim()||!key?.value.trim())
      throw new Error('Connect to Nitrado in Logs → Connection settings first.');
  };
  function checkRelative(path){
    if(typeof path!=='string'||path.length>200||!ALLOWED.test(path)||
       path.split('/').some(s=>s==='.'||s==='..'||s==='')||
       path.includes('\\'))
      throw new Error('Invalid mission-relative file path.');
    return path;
  }
  async function list(path){
    requireRequest();
    const data=await nitradoRequest('/api/files/list'+
      (path?'?dir='+encodeURIComponent(path):''));
    if(!Array.isArray(data?.entries))
      throw new Error('The Worker did not return a valid directory listing.');
    // Truncated Nitrado listings must never be treated as authoritative
    // confirmation that an existing file is absent.
    if(data.entries.length>=500)
      throw new Error('Nitrado returned too many directory entries to inspect safely.');
    return data;
  }
  async function discover(){
    const initial=await list();
    const root=String(initial.root||'');
    const match=root.match(/^\/games\/([A-Za-z0-9_-]{1,100})\/(?:noftp|ftproot)$/);
    if(!match)throw new Error('Nitrado root was not recognized.');
    for(const place of ['ftproot','noftp']){
      for(const mission of ['dayzps_missions/dayzOffline.chernarusplus','mpmissions/dayzOffline.chernarusplus']){
        const path='/games/'+match[1]+'/'+place+'/'+mission;
        try{
          const found=await list(path);
          if(found.dir===path && found.entries.some(e=>e.name==='db'))return path;
        }catch(_){}
      }
    }
    throw new Error('Active Chernarus mission not found. Confirm the mission and Nitrado server selection.');
  }
  let missionPromise=null;
  async function mission({refresh=false}={}){
    if(refresh)missionPromise=null;
    if(!missionPromise)missionPromise=discover().catch(e=>{missionPromise=null;throw e;});
    return missionPromise;
  }
  async function available(){
    const base=await mission({refresh:true});
    const results=[];
    for(const folder of ['','db','custom','env']){
      const dir=base+(folder?'/'+folder:'');
      let data;
      try{data=await list(dir);}
      catch(error){
        if(folder==='custom'||folder==='env')continue;
        throw new Error('Cannot list '+(folder||'mission')+' folder: '+error.message);
      }
      for(const entry of data.entries){
        if(!entry||!/\.(xml|json|txt)$/i.test(String(entry.name||'')))continue;
        const relative=(folder?folder+'/':'')+entry.name;
        if(!ALLOWED.test(relative))continue;
        if(!['file','regular',''].includes(String(entry.type||'file').toLowerCase()))continue;
        results.push({relative,path:base+'/'+relative,size:Number(entry.size)||0});
      }
    }
    return results.sort((a,b)=>a.relative.localeCompare(b.relative));
  }
  async function read(relative){
    requireRequest();checkRelative(relative);
    const base=await mission();
    const path=base+'/'+relative;
    const data=await nitradoRequest('/api/files/read?file='+encodeURIComponent(path));
    if(data?.path!==path||typeof data?.content!=='string'||!/^[0-9a-f]{64}$/.test(data.sha256||''))
      throw new Error('Nitrado returned an incomplete response for '+relative+'.');
    if(utf8(data.content)>MAX_BYTES)
      throw new Error(relative+' exceeds the Worker 4 MB edit limit.');
    return Object.freeze({relative,path,content:data.content,sha256:data.sha256});
  }
  const sameSource=(a,b)=>a?.path===b?.path&&a?.sha256===b?.sha256;
  function validateContent(path,content){
    if(typeof content!=='string'||!content.length||utf8(content)>MAX_BYTES)
      throw new Error('Generated file is empty or exceeds 4 MB.');
    window.BUILD_IT_FORMAT?.validate(path,content);
    // Fail closed for invalid UTF-8 XML declarations, as the Worker writes UTF-8.
    if(/\.xml$/i.test(path)){
      const match=content.match(/^\uFEFF?\s*<\?xml[^?]*encoding\s*=\s*(['"])(.*?)\1/i);
      if(match&&!/^utf-?8$/i.test(match[2]))throw new Error('XML declares non-UTF-8 encoding; upload blocked.');
    }
  }
  function writeKeyReady(){
    const field=document.getElementById('nitradoWriteKey');
    return !!field&&field.value.trim().length>=8;
  }
  async function publish(snapshot,content){
    requireRequest();
    if(!writeKeyReady())throw new Error('Enter MAP_WRITE_KEY once under Server Tools → Connection.');
    if(!snapshot?.relative||!snapshot?.path||!snapshot?.sha256||!checkRelative(snapshot.relative))
      throw new Error('No verified server source is loaded.');
    if(snapshot.path!==(await mission())+'/'+snapshot.relative)
      throw new Error('Mission path changed. Reload server files.');
    if(content===snapshot.content)throw new Error('No changes detected. Nothing will be uploaded.');
    validateContent(snapshot.path,content);
    const current=await read(snapshot.relative);
    if(!sameSource(current,snapshot)||current.content!==snapshot.content)
      throw new Error('The server file changed after preview. Refresh before publishing; no write occurred.');
    const result=await nitradoRequest('/api/files/write',{
      method:'POST',writeKey:true,body:{
        path:snapshot.path,content,expectedSha256:snapshot.sha256,confirm:true
      }
    });
    if(!result?.verified||!result?.backupPath)
      throw new Error('Upload could not be verified by Nitrado. Inspect the file before retrying.');
    return Object.freeze({path:snapshot.path,backupPath:result.backupPath,verified:true});
  }
  window.BUILD_IT_SERVER_FILES=Object.freeze({
    mission,available,read,publish,writeKeyReady,validateContent,checkRelative
  });
})();