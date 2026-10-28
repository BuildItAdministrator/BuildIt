/**
 * Build It!++ — optional Cloudflare Worker create-file route.
 *
 * Hook into the EXISTING authenticated Worker router:
 *
 *   if (url.pathname === '/api/files/create' && request.method === 'POST') {
 *     // Perform the same MAP_ACCESS_KEY + MAP_WRITE_KEY checks as /api/files/write.
 *     return createDayzLootFile(request, {
 *       authorized: true,                 // ONLY after both checks pass!
 *       serviceId: selected.serviceId,    // verified server selection
 *       fileRoot: selected.fileRoot,      // e.g. /games/ni123/ftproot
 *       nitradoToken: env.NITRADO_TOKEN   // server-side secret; NEVER send to browser
 *     });
 *   }
 *
 * This module is NOT deployed by committing it to GitHub. It must be included
 * in the user's existing Cloudflare Worker bundle/deployment.
 *
 * No general-purpose file creation: only one controlled mission JSON filename.
 * New files only, no overwrite fallback, no backups on nonexistent files.
 */
export async function createDayzLootFile(request, config) {
  const respond = (status, data) => new Response(JSON.stringify(data), {
    status,
    headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'}
  });
  if (request.method !== 'POST') return respond(405,{error:'POST only'});
  if (config?.authorized !== true) return respond(403,{error:'Write authentication required'});
  const token = String(config.nitradoToken || '');
  const serviceId = String(config.serviceId || '');
  const fileRoot = String(config.fileRoot || '').replace(/\/$/,'');
  if (!token || !/^[0-9]{1,20}$/.test(serviceId) ||
      !/^\/games\/[A-Za-z0-9_-]{1,100}\/(?:ftproot|noftp)$/.test(fileRoot))
    return respond(500,{error:'Invalid Worker server configuration'});
  const fetcher = config.fetchImpl || fetch;
  let payload;
  try { payload = await request.json(); }
  catch (_) { return respond(400,{error:'Invalid request JSON'}); }
  if (!payload || payload.confirm !== true || payload.expectedAbsent !== true)
    return respond(400,{error:'Explicit create confirmation and expectedAbsent are required'});
  const path = String(payload.path || '');
  const allowed = [
    fileRoot+'/dayzps_missions/dayzOffline.chernarusplus/custom/builditlootdrop.json',
    fileRoot+'/mpmissions/dayzOffline.chernarusplus/custom/builditlootdrop.json'
  ];
  if (!allowed.includes(path)) return respond(400,{error:'Path is outside the allowed DayZ loot mission file'});
  const content = payload.content;
  if (typeof content !== 'string' || !content.length ||
      new TextEncoder().encode(content).byteLength > 512 * 1024)
    return respond(400,{error:'JSON content must be 1 to 524288 bytes'});
  let data;
  try { data = JSON.parse(content); }
  catch (_) { return respond(400,{error:'Invalid loot JSON'}); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !Array.isArray(data.Objects) || data.Objects.length === 0 || data.Objects.length > 200)
    return respond(400,{error:'Expected DayZ Objects array containing 1-200 entries'});
  for(const object of data.Objects) {
    if (!object || !/^[A-Za-z0-9_]{1,100}$/.test(object.name || '') ||
        !Array.isArray(object.pos) || object.pos.length !== 3 ||
        !object.pos.every(n=>typeof n==='number'&&Number.isFinite(n)) ||
        object.enableCEPersistency !== false)
      return respond(400,{error:'Invalid or persistent DayZ loot object'});
  }
  const dir = path.slice(0,path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/')+1);
  const apiBase = 'https://api.nitrado.net/services/'+serviceId+'/gameservers/file_server';
  const auth = {'authorization':'Bearer '+token};
  const readJson = async (url, init) => {
    const response = await fetcher(url,init);
    if (!response.ok) throw new Error('Nitrado HTTP '+response.status);
    const obj = await response.json();
    if (obj.status === 'error') throw new Error('Nitrado rejected the operation');
    return obj.data || obj;
  };
  const listing = async () => {
    const result = await readJson(apiBase+'/list?dir='+encodeURIComponent(dir),{headers:auth});
    if (!Array.isArray(result.entries)) throw new Error('Nitrado did not return a valid file listing');
    return result.entries;
  };
  try {
    // Check twice before issuing a write token. Nitrado does not expose an
    // atomic "create if absent" operation; avoid running this concurrently.
    for(let check=0;check<2;check++){
      if ((await listing()).some(item => String(item.name || '')===name))
        return respond(409,{error:'File already exists. Reload and use the safe update flow.'});
    }
    const upload = await readJson(apiBase+'/upload',{
      method:'POST',
      headers:{...auth,'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({path:dir,file:name}).toString()
    });
    const destination = upload.token;
    if(!destination?.token || !destination?.url ||
       new URL(destination.url).protocol!=='https:')
      throw new Error('Nitrado returned no secure upload destination');
    const sent=await fetcher(destination.url,{
      method:'POST',
      headers:{'content-type':'application/binary',token:destination.token},
      body:content
    });
    if(!sent.ok)throw new Error('Nitrado upload failed (HTTP '+sent.status+')');
    // Verify the actual remote bytes; a successful upload response alone is
    // not confirmation of safe file creation.
    const read = await readJson(apiBase+'/download?file='+encodeURIComponent(path),{headers:auth});
    if(!read.token?.token || !read.token?.url ||
       new URL(read.token.url).protocol!=='https:')
      throw new Error('Nitrado returned no secure download destination');
    const downloadUrl=new URL(read.token.url);
    downloadUrl.searchParams.set('token',read.token.token);
    const saved=await fetcher(downloadUrl.toString());
    if(!saved.ok)throw new Error('Could not read the created file for verification');
    const savedContent=await saved.text();
    if(savedContent!==content)throw new Error('Created file verification failed: content differs');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content));
    const sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    return respond(200,{verified:true,created:true,path,sha256});
  }catch(error){
    // No automatic overwrite, retry or deletion: these may destroy a file
    // created by another process. Operator must inspect server after failure.
    return respond(502,{error:'Create failed: '+error.message+'. Check Nitrado file listing before retrying.'});
  }
}
