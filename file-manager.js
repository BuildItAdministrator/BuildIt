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
    '<p class="fm-note">DayZ PS5 mission files are usually in dayzps_missions/dayzOffline.chernarusplus, not dayzps/config. Search both Nitrado file roots below. Opening folders never changes your server.</p>',
    '<p class="fm-note">Download or edit XML, JSON and TXT files up to 512 KB. Uploads require a verified backup.</p>',
    '<label class="fm-label" for="nitradoWriteKey">Separate file-write key (MAP_WRITE_KEY)</label>',
    '<input id="nitradoWriteKey" type="password" autocomplete="off" placeholder="Enter Cloudflare file-write key">',
    '<p class="fm-note">This key stays in this tab only. It is not saved in browser storage.</p>',
    '<div class="fm-row"><button id="fmFindMission" type="button" class="log-btn">Find Chernarus mission</button></div>',
    '<div class="fm-row"><button id="fmBrowse" type="button" class="log-btn">NoFTP root</button><button id="fmFtpRoot" type="button" class="log-btn">FTP root</button><button id="fmBack" type="button" class="log-btn" disabled>Parent</button></div>',
    '<div id="fmCurrentDir" class="fm-path" aria-label="Current directory"></div>',
    '<div id="fmEntries" class="fm-entries"></div>',
    '<div id="fmFileBox" hidden>',
      '<label class="fm-label" for="fmEditor">Selected server file</label>',
      '<div id="fmSelected" class="fm-path"></div>',
      '<textarea id="fmEditor" spellcheck="false" rows="12" aria-label="Server file editor"></textarea>',
      '<div class="fm-row"><button type="button" id="fmRepairXml" class="log-btn" hidden>Fix duplicate XML header</button></div>',
      '<label class="fm-label" for="fmLocalFile">Load a local replacement into the editor</label>',
      '<input id="fmLocalFile" type="file" accept=".xml,.json,.txt">',
      '<div class="fm-row"><button type="button" id="fmDownload" class="log-btn">Download copy</button><button type="button" id="fmSave" class="log-btn">Backup &amp; upload</button></div>',
    '</div>',
    '<div id="fmStatus" class="log-auto-status" role="status" aria-live="polite">Browse your server files after the Cloudflare Worker upgrade is deployed.</div>'
  ].join('');
  testBlock.insertAdjacentElement('afterend',panel);
  // Put the actual write-key input NEXT TO the write-test button rather than
  // below it in File Manager. It remains the same input used by file uploads.
  const keySlot=document.createElement('div');
  keySlot.id='fileWriteKeySlot';
  const keyLabel=panel.querySelector('label[for="nitradoWriteKey"]');
  const keyInput=panel.querySelector('#nitradoWriteKey');
  const keyHelp=keyInput?.nextElementSibling;
  const keyCount=document.createElement('div');
  keyCount.id='nitradoWriteKeyLength';
  keyCount.setAttribute('role','status');
  keyCount.setAttribute('aria-live','polite');
  if(keyLabel&&keyInput){
    keySlot.append(keyLabel,keyInput);
    if(keyHelp)keySlot.appendChild(keyHelp);
    keySlot.appendChild(keyCount);
    testBlock.querySelector('#nitradoFileWriteTest')?.before(keySlot);
    keyInput.setAttribute('minlength','8');
    keyInput.setAttribute('spellcheck','false');
    keyInput.setAttribute('autocapitalize','off');
    const updateKeyCount=()=>{
      const length=keyInput.value.trim().length;
      keyCount.textContent=length>=8
        ? 'Length OK ('+length+' characters). Cloudflare match not yet tested.'
        : length===0
          ? 'No MAP_WRITE_KEY entered. Minimum 8 characters.'
          : 'MAP_WRITE_KEY too short: '+length+'/8 characters.';
      keyCount.dataset.valid=String(length>=8);
    };
    keyInput.addEventListener('input',updateKeyCount);
    updateKeyCount();
  }
  const style=document.createElement('style');
  style.textContent=[
    '#fileWriteKeySlot{margin:10px 0 2px;display:block}',
    '#fileWriteKeySlot .fm-label{display:block;font-weight:700;margin:0 0 5px}',
    '#fileWriteKeySlot .fm-note{font-size:11px;line-height:1.45;color:#b9c7cc;margin:5px 0}',
    '#fileWriteKeySlot #nitradoWriteKey{box-sizing:border-box;width:100%;border:1px solid #50616a;background:#101a20;color:#fff;border-radius:6px;padding:9px;font:inherit}',
    '#nitradoWriteKeyLength{font-size:11px;line-height:1.4;padding:5px 0;color:#dda1a1}',
    '#nitradoWriteKeyLength[data-valid="true"]{color:#9ddcad}',
    'html[data-buildit-theme="light"] #fileWriteKeySlot #nitradoWriteKey{background:#fff;color:#1b3345;border-color:#aebfce}',
    'html[data-buildit-theme="light"] #fileWriteKeySlot .fm-note{color:#526778}',
    'html[data-buildit-theme="light"] #nitradoWriteKeyLength{color:#a22c32}',
    'html[data-buildit-theme="light"] #nitradoWriteKeyLength[data-valid="true"]{color:#176636}',
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
  let root='',dir='',currentRoot='',storageRoots=[],selected='',sourceDigest='',running=false;
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
      $('fmBack').disabled=!dir || dir===currentRoot;
      $('fmSave').disabled=!selected;
      $('fmDownload').disabled=!selected;
      $('fmRepairXml').disabled=!selected || !/\.xml$/i.test(selected);
    }
  }
  function discoverRoots(serverRoot){
    const match=String(serverRoot||'').match(/^\/games\/([a-zA-Z0-9_-]{1,100})\/(noftp|ftproot)$/);
    if(!match) throw new Error('The Worker returned an unfamiliar Nitrado root. Check the Worker setup.');
    const base='/games/'+match[1];
    return [base+'/ftproot',base+'/noftp'];
  }
  function allowedServerPath(path){
    return typeof path==='string'&&!path.includes('//')&&!path.includes('/../')&&!path.includes('/./')
      &&storageRoots.some(r=>path===r||path.startsWith(r+'/'));
  }
  async function listDirectory(path=''){
    const response=await nitradoRequest('/api/files/list'+(path?'?dir='+encodeURIComponent(path):''));
    const serverRoot=String(response.root||root);
    const nextRoots=discoverRoots(serverRoot);
    const target=String(response.dir||path||serverRoot);
    if(!nextRoots.some(r=>target===r||target.startsWith(r+'/'))||
       target.includes('/../')||target.includes('/./')||target.includes('//')){
      throw new Error('Unexpected server directory path.');
    }
    if(!Array.isArray(response.entries))throw new Error('Nitrado returned no file listing.');
    root=serverRoot;
    storageRoots=nextRoots;
    return {target,items:response.entries};
  }
  async function browse(path=''){
    state('Loading server directory…');
    const {target,items}=await listDirectory(path);
    dir=target;
    currentRoot=storageRoots.find(r=>target===r||target.startsWith(r+'/'))||'';
    $('fmCurrentDir').textContent=dir;
    entries.replaceChildren();
    selected='';
    sourceDigest='';
    box.hidden=true;
    for(const item of items){
      const folder=['dir','directory','folder'].includes(String(item.type).toLowerCase());
      if(!allowedServerPath(item.path)||!item.path.startsWith(dir+'/'))continue;
      const button=document.createElement('button');
      button.type='button';
      button.className='fm-entry';
      button.textContent=(folder?'[Folder] ':'[File] ')+item.name;
      button.addEventListener('click',()=>perform(()=>folder?browse(item.path):openFile(item.path)));
      entries.appendChild(button);
    }
    if(!entries.childElementCount)entries.textContent='No supported files or subfolders in this directory.';
    const isSettings=dir.endsWith('/dayzps')||dir.endsWith('/dayzps/config');
    state(isSettings
      ? 'This folder contains server settings, not Chernarus mission XMLs. Select Find Chernarus mission, or FTP root.'
      : 'Folder loaded. Select a file to open or download.');
  }
  async function findMission(){
    state('Looking for dayzps_missions/dayzOffline.chernarusplus in both Nitrado roots…');
    if(!root){
      const response=await listDirectory();
      if(!response.target)throw new Error('Unable to identify the server file roots.');
    }
    const suffixes=[
      '/dayzps_missions/dayzOffline.chernarusplus',
      '/mpmissions/dayzOffline.chernarusplus'
    ];
    const checked=[];
    for(const fileRoot of storageRoots){
      for(const suffix of suffixes){
        const candidate=fileRoot+suffix;
        try{
          const {items}=await listDirectory(candidate);
          const isMission=items.some(item=>{
            const name=String(item.name||'').toLowerCase();
            return name==='db'||name==='env'||name==='cfggameplay.json'||
              name==='cfgspawnabletypes.xml'||name==='cfgeventspawns.xml';
          });
          if(isMission){
            await browse(candidate);
            state('Chernarus mission found: '+candidate+'\nOpen db for events.xml, types.xml and messages.xml.');
            return;
          }
          checked.push(candidate+' (mission files absent)');
        }catch(error){checked.push(candidate+' ('+String(error.message||'unavailable').slice(0,110)+')');}
      }
    }
    // Even when direct probing is blocked, the user can inspect each root by hand.
    state('Chernarus mission not found automatically in NoFTP or FTP root. Try FTP root and look for dayzps_missions. If it is also missing there, compare with Nitrado Tools > Filebrowser. No files were changed.',true);
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
    refreshRepairButton();
    if($('fmRepairXml').hidden)
      state('File opened. A backup will be verified before any upload.');
    else
      state('Duplicate XML declaration detected. Click Fix duplicate XML header to repair the editor copy. No server file has been changed.',true);
  }
  function refreshRepairButton(){
    const btn=$('fmRepairXml');
    btn.hidden=!selected || !/\.xml$/i.test(selected);
    if(btn.hidden)return;
    // Only offer repair if we can prove the extra header is directly after
    // the first, without any other XML content between them.
    btn.hidden=!/^\uFEFF?<\?xml\s+[^?]*\?>[ \t\r\n]+<\?xml\s+[^?]*\?>/i.test(editor.value);
  }
  editor.addEventListener('input',refreshRepairButton);
  $('fmRepairXml').addEventListener('click',()=>{
    if(!selected || !/\.xml$/i.test(selected))return;
    try{
      const repaired=window.BUILD_IT_XML.repairDuplicateDeclarations(editor.value);
      if(!repaired.removed)throw new Error('No duplicate XML declaration found. No changes made.');
      editor.value=repaired.content;
      refreshRepairButton();
      state('Removed '+repaired.removed+' duplicate XML declaration(s) from the EDITOR COPY. Review the text and use Backup & upload to save it to Nitrado. No files were uploaded.');
    }catch(e){state('XML repair not possible: '+e.message,true);}
  });
  function validateText(path,text){
    if(new Blob([text]).size>512*1024)throw new Error('File exceeds 512 KB.');
    if(/\.json$/i.test(path)) JSON.parse(text);
    if(/\.xml$/i.test(path))window.BUILD_IT_XML.validate(text);
  }
  $('fmBrowse').addEventListener('click',()=>perform(async()=>{
    if(!root)await browse();
    else await browse(storageRoots[1]);
  }));
  $('fmFtpRoot').addEventListener('click',()=>perform(async()=>{
    if(!root)await listDirectory();
    await browse(storageRoots[0]);
  }));
  $('fmFindMission').addEventListener('click',()=>perform(findMission));
  $('fmBack').addEventListener('click',()=>perform(()=>{
    if(!currentRoot||dir===currentRoot)return Promise.resolve();
    const parent=dir.substring(0,dir.lastIndexOf('/'));
    return browse(parent.length<currentRoot.length?currentRoot:parent);
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
    try {validateText(selected,text);editor.value=text;refreshRepairButton();state('Local replacement loaded into editor. Not yet uploaded.')}
    catch(e){state(e.message,true)}
  });
  $('fmSave').addEventListener('click',()=>perform(async()=>{
    if(!selected||!sourceDigest)throw new Error('Open a server file first.');
    const key=$('nitradoWriteKey').value.trim();
    if(key.length<8)throw new Error('Enter the separate MAP_WRITE_KEY (at least 8 characters).');
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
