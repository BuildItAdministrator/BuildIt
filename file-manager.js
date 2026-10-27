/* Build It!++ file browser. Files stay in browser except for explicitly confirmed saves.
 * Requires the separate, manually deployed Cloudflare Worker upgrade.
 */
(function () {
  'use strict';
  const logPanel=document.getElementById('logPanel');
  const testBlock=logPanel?.querySelector('.log-file-test');
  if(!testBlock || document.getElementById('fileManager')) return;
  const panel=document.createElement('section');
  panel.id='fileManager';
  panel.innerHTML=[
    '<div class="log-divider"></div>',
    '<div class="log-auto-title">Nitrado File Manager</div>',
    '<p class="fm-note">Browse and download XML, JSON and TXT files. Uploading overwrites only an existing file after a verified server-side backup. Files over 512 KB are not supported.</p>',
    '<label class="fm-label" for="nitradoWriteKey">Separate file-write key (MAP_WRITE_KEY)</label>',
    '<input id="nitradoWriteKey" type="password" autocomplete="off" placeholder="Enter Cloudflare file-write key">',
    '<p class="fm-note">This key stays in this tab only. It is not saved in browser storage.</p>',
    '<div class="fm-row"><button id="fmBrowse" type="button" class="log-btn">Browse server files</button><button id="fmBack" type="button" class="log-btn" disabled>Parent folder</button></div>',
    '<div id="fmCurrentDir" class="fm-path" aria-label="Current directory"></div>',
    '<div id="fmEntries" class="fm-entries"></div>',
    '<div id="fmFileBox" hidden>',
      '<label class="fm-label" for="fmEditor">Selected server file</label>',
      '<div id="fmSelected" class="fm-path"></div>',
      '<textarea id="fmEditor" spellcheck="false" rows="12" aria-label="Server file editor"></textarea>',
      '<label class="fm-label" for="fmLocalFile">Load a local replacement into the editor</label>',
      '<input id="fmLocalFile" type="file" accept=".xml,.json,.txt">',
      '<div class="fm-row"><button type="button" id="fmDownload" class="log-btn">Download copy</button><button type="button" id="fmSave" class="log-btn">Backup &amp; upload</button></div>',
    '</div>',
    '<div id="fmStatus" class="log-auto-status" role="status" aria-live="polite">Browse your server files after the Cloudflare Worker upgrade is deployed.</div>'
  ].join('');
  testBlock.insertAdjacentElement('afterend',panel);
  const style=document.createElement('style');
  style.textContent=[
    '#fileManager{padding:12px;border:1px solid rgba(255,255,255,.14);border-radius:8px;margin:12px 0;background:rgba(16,30,35,.65);color:#eee;font-size:12px}',
    '#fileManager .fm-note{font-size:11px;line-height:1.5;color:#b9c7cc;margin:8px 0}',
    '#fileManager .fm-label{display:block;font-weight:700;margin:10px 0 5px}',
    '#fileManager input[type=password],#fileManager textarea,#fileManager input[type=file]{box-sizing:border-box;width:100%;border:1px solid #50616a;background:#101a20;color:#fff;border-radius:6px;padding:9px;font:inherit}',
    '#fileManager textarea{display:block;min-height:185px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.55;tab-size:2}',
    '#fileManager .fm-path{font-family:ui-monospace,monospace;word-break:break-all;color:#b9c7cc;padding:5px 0;font-size:10px}',
    '#fileManager .fm-row{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}',
    '#fileManager .fm-row button{flex:1;min-width:95px}',
    '#fileManager .fm-entries{max-height:220px;overflow:auto;border:1px solid #40535e;border-radius:7px;margin-top:7px}',
    '#fileManager .fm-entry{background:#1c2c35;color:#e8f0f4;border:0;border-bottom:1px solid #3c4c55;text-align:left;width:100%;padding:9px 7px;cursor:pointer;display:block;overflow-wrap:anywhere}',
    '#fileManager .fm-entry:hover{background:#304c58}',
    '#fileManager button:disabled{opacity:.5;cursor:not-allowed}',
    '#fmStatus{white-space:pre-wrap;line-height:1.45}'
  ].join('\n');
  document.head.appendChild(style);
  const $=id=>document.getElementById(id);
  const entries=$('fmEntries'), editor=$('fmEditor'), box=$('fmFileBox');
  let root='',dir='',selected='',sourceDigest='',running=false;
  const state=(message,error=false)=>{
    $('fmStatus').textContent=message;
    $('fmStatus').style.color=error?'#ffadad':'#a8d6e4';
  };
  async function perform(action){
    if(running)return;
    running=true;
    const controls=panel.querySelectorAll('button');
    controls.forEach(b=>b.disabled=true);
    try{await action()}catch(e){state(e.message||'File operation failed.',true)}
    finally{
      running=false;
      controls.forEach(b=>b.disabled=false);
      $('fmBack').disabled=!dir || dir===root;
      $('fmSave').disabled=!selected;
      $('fmDownload').disabled=!selected;
    }
  }
  function withinRoot(p){return typeof p==='string'&&p.startsWith(root+'/')&&!p.includes('/../')&&!p.includes('/./')}
  async function browse(path=''){
    state('Loading server directory…');
    const requestPath='/api/files/list'+(path?'?dir='+encodeURIComponent(path):'');
    const response=await nitradoRequest(requestPath);
    root=String(response.root||root);
    dir=String(response.dir||path||root);
    if(!root||!(dir===root||withinRoot(dir)))throw new Error('Unexpected server path.');
    $('fmCurrentDir').textContent=dir;
    entries.replaceChildren();
    for(const item of response.entries||[]){
      const folder=['dir','directory','folder'].includes(item.type);
      if(!withinRoot(item.path))continue;
      const button=document.createElement('button');
      button.type='button';
      button.className='fm-entry';
      button.textContent=(folder?'[Folder] ':'[File] ')+item.name;
      button.addEventListener('click',()=>perform(()=>folder?browse(item.path):openFile(item.path)));
      entries.appendChild(button);
    }
    if(!entries.childElementCount)entries.textContent='No supported files or subfolders in this directory.';
    state('Folder loaded. Select a file to open or download.');
  }
  async function openFile(path){
    state('Downloading selected file…');
    const result=await nitradoRequest('/api/files/read?file='+encodeURIComponent(path));
    selected=result.path;
    sourceDigest=result.sha256;
    editor.value=result.content;
    $('fmSelected').textContent=selected;
    $('fmLocalFile').value='';
    box.hidden=false;
    state('File opened. A backup will be verified before any upload.');
  }
  function validateText(path,text){
    if(new Blob([text]).size>512*1024)throw new Error('File exceeds 512 KB.');
    if(/\.json$/i.test(path)) JSON.parse(text);
    if(/\.xml$/i.test(path)){
      const parsed=new DOMParser().parseFromString(text,'application/xml');
      if(parsed.querySelector('parsererror'))throw new Error('XML is not well-formed. Upload cancelled.');
    }
  }
  $('fmBrowse').addEventListener('click',()=>perform(()=>browse()));
  $('fmBack').addEventListener('click',()=>perform(()=>{
    if(!root||dir===root)return Promise.resolve();
    const parent=dir.substring(0,dir.lastIndexOf('/'));
    return browse(parent.length<root.length?root:parent);
  }));
  $('fmDownload').addEventListener('click',()=>{
    if(!selected)return;
    const blob=new Blob([editor.value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=selected.split('/').pop();
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    state('Downloaded editor copy. This action did not modify Nitrado.');
  });
  $('fmLocalFile').addEventListener('change',async()=>{
    const file=$('fmLocalFile').files[0];
    if(!file||!selected)return;
    if(file.name.split('.').pop().toLowerCase()!==selected.split('.').pop().toLowerCase()){
      state('Choose a local file with the same extension as the selected server file.',true);return;
    }
    if(file.size>512*1024){state('Local file exceeds 512 KB.',true);return}
    const text=await file.text();
    try {validateText(selected,text);editor.value=text;state('Local replacement loaded into editor. Not yet uploaded.')}
    catch(e){state(e.message,true)}
  });
  $('fmSave').addEventListener('click',()=>perform(async()=>{
    if(!selected||!sourceDigest)throw new Error('Open a server file first.');
    const key=$('nitradoWriteKey').value.trim();
    if(key.length<24)throw new Error('Enter the separate MAP_WRITE_KEY (at least 24 characters).');
    validateText(selected,editor.value);
    if(!window.confirm('Overwrite '+selected.split('/').pop()+' on your LIVE DayZ server?\n\nA backup must be created and verified before the upload proceeds. Continue?')){
      state('Upload cancelled.');return;
    }
    state('Creating and verifying server backup before uploading…');
    const result=await nitradoRequest('/api/files/write',{
      method:'POST',body:{path:selected,content:editor.value,expectedSha256:sourceDigest,confirm:true},writeKey:true
    });
    state('Upload verified. Original backup: '+result.backupPath+'\nRestart the DayZ server when appropriate.');
    const refresh=await nitradoRequest('/api/files/read?file='+encodeURIComponent(selected));
    sourceDigest=refresh.sha256;
  }));
})();
