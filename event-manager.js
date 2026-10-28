/* Build It!++ Event Manager. Client-side XML composer; does not access live Nitrado files. */
(function () {
  'use strict';
  if (typeof map === 'undefined' || typeof L === 'undefined' || typeof gameToLeaflet !== 'function' || typeof leafletToGame !== 'function') return;
  const BASE = 'https://raw.githubusercontent.com/BohemiaInteractive/DayZ-Central-Economy/master/dayzOffline.chernarusplus/';
  const STORE = 'buildit_events_drafts_v1';
  const $ = id => document.getElementById(id);
  const safe = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = v => /^[A-Za-z0-9_]{1,90}$/.test(v);
  const numbers = (n, min, max) => Number.isFinite(Number(n)) && Number(n) >= min && Number(n) <= max;
  const itemNames = new Set();
  const vehicleNames = new Set();
  const files = {};
  let chosen = null, placing = false, editingIndex = -1, itemList = [], drafts = [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) || '[]');
    if (Array.isArray(stored)) drafts = stored.filter(d => d && valid(d.name) && numbers(d.x,0,15360) && numbers(d.z,0,15360)).slice(0,150);
  } catch (e) { console.warn('Could not read event drafts', e); }
  const layer = L.layerGroup().addTo(map);
  const style = document.createElement('style');
  style.textContent = [
    '#biToggle{position:absolute;top:62px;left:12px;z-index:1155;color:#fff;background:#233846;border:1px solid #668293;border-radius:8px;padding:10px 13px;font-weight:800;cursor:pointer}',
    '#biPanel{position:absolute;top:110px;left:12px;z-index:1155;box-sizing:border-box;width:min(370px,calc(100vw - 24px));max-height:calc(100vh - 122px);overflow-y:auto;color:#f3f3f3;background:#151c21f5;border:1px solid #63717a;border-radius:11px;padding:14px;box-shadow:0 10px 25px #0008;font:13px Arial,sans-serif}',
    '#biPanel[hidden],#biPanel [hidden]{display:none!important}',
    '#biPanel h3{margin:2px 0 12px;font-size:17px;color:#fff}',
    '#biPanel h4{margin:12px 0 8px;font-size:13px;color:#cbd7df}',
    '#biPanel label{display:block;font-size:12px;font-weight:700;margin:9px 0 5px}',
    '#biPanel input:not([type="checkbox"]):not([type="file"]),#biPanel select{width:100%;box-sizing:border-box;background:#111820;border:1px solid #5b727f;color:#fff;border-radius:6px;padding:9px;font:13px Arial,sans-serif}',
    '#biPanel input[type="file"]{max-width:100%;color:#cbd4d9;font-size:11px}',
    '#biPanel button{padding:8px 10px;color:#fff;border:1px solid #506678;border-radius:6px;background:#294150;font-weight:700;cursor:pointer}',
    '#biPanel button:hover{background:#385566}#biPanel button:disabled{opacity:.45;cursor:not-allowed}',
    '.biRow{display:flex;gap:7px;align-items:center}.biRow>*{min-width:0;flex:1}.biRow button{flex:0 0 auto!important}',
    '.biSmall{font-size:11px;color:#b7c7d0;line-height:1.45;margin:7px 0}',
    '.biWarn{font-size:11px;line-height:1.55;padding:9px;background:#3b3021;border:1px solid #9c7741;border-radius:6px;color:#ffe1ad}',
    '.biMatches{max-height:155px;overflow:auto;border:1px solid #45545f;margin-top:4px;border-radius:6px}',
    '.biMatches button{display:block;width:100%;text-align:left;background:#202d36;border:none;border-radius:0;padding:8px 10px;overflow-wrap:anywhere}',
    '.biTag{color:#b8ccda;font-size:10px}',
    '.biDraft{margin:7px 0;padding:8px;border:1px solid #445764;border-radius:6px;background:#182831}',
    '.biDraft button{font-size:11px;padding:5px 8px}',
    '#biStatus{white-space:pre-wrap;line-height:1.4;color:#a8d6e4;min-height:16px;margin:9px 0}',
    '.biPoint{font-family:monospace;color:#d8eafb;font-size:12px}',
    '.biDivider{height:1px;background:#40515c;margin:14px 0}',
    '.biHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:10px;border-bottom:1px solid #40515c;margin-bottom:12px}',
    '.biHeader h3{font-size:18px!important;letter-spacing:.1px;margin:0!important}',
    '.biHeader .biSmall{margin:4px 0 0}',
    '#biClose{flex:0 0 auto!important;width:30px;height:30px;display:grid;place-items:center;font-size:21px;padding:0!important;border-radius:7px}',
    '.biSection{padding:12px;margin:0 0 11px;background:rgba(255,255,255,.025);border:1px solid #405460;border-radius:10px}',
    '.biSectionTitle{display:flex;align-items:center;gap:9px;margin:0 0 9px}',
    '.biSectionTitle h4{flex:1;margin:0!important;font-size:13px!important;letter-spacing:.15px}',
    '.biStep{display:grid;place-items:center;flex:0 0 auto;width:23px;height:23px;border-radius:6px;background:#2a5363;color:#d6f1fd;font:700 10px Arial,sans-serif}',
    '.biDraftCount{flex:0 0 auto;font-size:10px!important;margin:0!important;color:#b8cbd5}',
    '.biPickRow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.biPickRow #biPick{flex:0 0 auto}',
    '.biPoint{display:inline-flex;align-items:center;min-height:33px;min-width:0;overflow-wrap:anywhere;color:#b8d8e8}',
    '.biActions{margin-top:12px;align-items:stretch}',
    '#biPanel .biPrimary{background:#267b9c!important;border-color:#398eae!important;color:#fff!important;font-weight:700}',
    '#biPanel .biPrimary:hover:not(:disabled){background:#3290b3!important}',
    '#biPanel .biPrimary:disabled{opacity:.48!important}',
    '#biPanel .biQuiet{background:transparent!important;color:#c0d0db!important;border-color:#516674!important}',
    '.biActions #biSave{flex:1 1 auto!important}',
    '.biActions #biNew{flex:0 0 auto!important}',
    '#biPanel .biFull{display:block;width:100%;box-sizing:border-box;margin:8px 0 0;padding:10px 12px}',
    '.biMessage{white-space:pre-wrap;word-break:break-word;line-height:1.55;font-size:11px;max-height:210px;overflow:auto;border:1px solid #445e68;background:#12232d;border-radius:8px;padding:10px;margin:10px 0}',
    '.biConfirm{display:flex!important;align-items:flex-start;gap:9px;font-weight:400!important;line-height:1.5;background:rgba(255,255,255,.04);border-radius:7px;padding:10px 8px}',
    '.biConfirm input{margin:2px 0 0;flex:0 0 auto}',
    '.biAdvanced{border:1px solid #405460;border-radius:9px;padding:9px 11px;margin:12px 0;color:#b8cbd5}',
    '.biAdvanced summary{cursor:pointer;user-select:none;font-size:11px;font-weight:700;padding:3px 0}',
    '.biAdvanced[open] summary{margin-bottom:10px}',
    '#biDrafts:empty::before{content:"No saved events yet.";color:#9fb1bc;font-size:11px}',
    '#biPanel .biDraft{padding:9px 10px;margin:7px 0}',
    '.biDraft .biDraftTitle{display:block;font-size:12px;font-weight:700;color:#eff7fc;overflow-wrap:anywhere}',
    '.biDraft .biDraftDetails{margin-top:4px;font-size:11px;color:#b8cbd5;line-height:1.4;overflow-wrap:anywhere}',
    '.biDraft .biRow{justify-content:flex-end;margin-top:7px}',
    '.biDraft .biRow button{padding:4px 8px!important}',
    'html[data-buildit-theme="light"] #biPanel .biSection,html[data-buildit-theme="light"] #biPanel .biAdvanced{background:#f5f9fc;border-color:#c6d7e2}',
    'html[data-buildit-theme="light"] #biPanel .biMessage{background:#e6f1f7;color:#28435a;border-color:#c7dae7}',
    'html[data-buildit-theme="light"] #biPanel .biConfirm{background:#ecf4f9;color:#2d4a5e}',
    'html[data-buildit-theme="light"] #biPanel .biStep{background:#d9eaf4;color:#235671}',
    'html[data-buildit-theme="light"] #biPanel .biDraftTitle{color:#20384c}',
    'html[data-buildit-theme="light"] #biPanel .biDraftDetails{color:#49687b}',
    'html[data-buildit-theme="light"] #biPanel .biPrimary{background:#176d90!important;color:#fff!important;border-color:#176d90!important}',
    'html[data-buildit-theme="light"] #biPanel .biQuiet{background:#f5f9fc!important;color:#426178!important;border-color:#b5cbd8!important}',
    'html[data-buildit-theme="light"] #biPanel .biDraftCount{color:#537082}',
    '@media(max-height:500px){#biPanel{top:65px;max-height:calc(100vh - 70px)}}'
  ].join('');
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.id = 'biToggle'; toggle.type = 'button'; toggle.textContent = '⚙ Event Manager';
  document.body.appendChild(toggle);
  const panel = document.createElement('div');
  panel.id = 'biPanel'; panel.hidden = true;
  panel.innerHTML = [
    '<div class="biHeader"><div><h3>Event Manager</h3><div class="biSmall">Place, review and publish DayZ events.</div></div><button type="button" id="biClose" title="Close" aria-label="Close Event Manager">×</button></div>',
    '<section class="biSection"><div class="biSectionTitle"><span class="biStep">01</span><h4>Configure spawn</h4></div>',
    '<div class="biPickRow"><button type="button" id="biPick">Pick location on map</button><span id="biPoint" class="biPoint">No location selected</span></div>',
    '<label for="biName">Event name</label><input id="biName" value="BuildIt_Event1" maxlength="90" spellcheck="false">',
    '<div class="biRow"><div><label for="biKind">Event type</label><select id="biKind"><option value="vehicle">Vehicle / motorcycle</option><option value="loot">Loot drop (manual XML)</option></select></div>',
    '<div><label for="biAngle">Rotation (°)</label><input id="biAngle" type="number" min="0" max="359.99" step="0.01" value="0"></div></div>',
    '<div id="biVehicleSection"><label for="biVehicleSearch">Vehicle classname</label><input id="biVehicleSearch" type="search" autocomplete="off" placeholder="Search car, truck or motorcycle…"><div id="biVehicleMatches" class="biMatches"></div>',
    '<p class="biSmall">Vehicle parts use your existing cfgspawnabletypes.xml rules.</p></div>',
    '<div id="biLootSection" hidden><label for="biContainer">Container</label><select id="biContainer"><option>SeaChest</option><option>WoodenCrate</option><option>SmallProtectorCase</option><option>Barrel_Green</option><option>Barrel_Blue</option></select>',
    '<label for="biItemSearch">Item classname</label><input id="biItemSearch" type="search" autocomplete="off" placeholder="Search items…"><div id="biItemMatches" class="biMatches"></div>',
    '<div id="biItems"></div>',
    '<div class="biWarn">Loot cargo applies to every container of the same classname, not just this map location. Manual XML review is required.</div>',
    '<label style="font-weight:400"><input type="checkbox" id="biAcknowledge"> I understand the global cargo change.</label></div>',
    '<div class="biRow biActions"><button type="button" id="biSave" class="biPrimary">Save spawn</button><button type="button" id="biNew" class="biQuiet">Clear</button></div>',
    '<div id="biStatus" role="status" aria-live="polite"></div></section>',
    '<section class="biSection"><div class="biSectionTitle"><span class="biStep">02</span><h4>Queued events</h4><span id="biDraftCount" class="biSmall biDraftCount">0 saved</span></div>',
    '<div id="biDrafts"></div></section>',
    '<section class="biSection biPublish"><div class="biSectionTitle"><span class="biStep">03</span><h4>Publish to Nitrado</h4></div>',
    '<p class="biSmall">Review automatically loads fresh events.xml and cfgeventspawns.xml. Original lines and comments remain untouched.</p>',
    '<button type="button" id="biPreviewServer" class="biPrimary biFull">Review &amp; prepare changes</button>',
    '<div id="biServerPreview" class="biMessage" role="status" aria-live="polite">Save a vehicle event, then review the changes.</div>',
    '<label class="biConfirm" id="biRepairConfirm" hidden><input type="checkbox" id="biRepairAcknowledge"> I approve removing the duplicate XML declarations detected in the server files.</label>',
    '<label class="biConfirm"><input type="checkbox" id="biServerStopped"> My DayZ server is stopped and I have reviewed the changes.</label>',
    '<button type="button" id="biUploadServer" class="biPrimary biFull" disabled>Back up &amp; upload</button>',
    '<p class="biSmall">An upload requires your file-write key. Existing files are checked and backed up before replacement.</p></section>',
    '<details class="biAdvanced" id="biAdvanced"><summary>Advanced · Manual XML tools</summary>',
    '<button type="button" id="biLoadServer" class="biFull">Reload live server XML</button>',
    '<div class="biSmall" id="biCatalog">Loading official classnames…</div>',
    '<label for="biFiles">Import XML from your computer</label><input id="biFiles" type="file" accept=".xml" multiple>',
    '<div id="biImportStatus" class="biSmall">Optional: import existing XML for offline export.</div>',
    '<div class="biRow"><button type="button" id="biExportEvents">events.xml</button><button type="button" id="biExportPositions">cfgeventspawns.xml</button></div>',
    '<button type="button" id="biExportCargo" class="biFull">cfgspawnabletypes.xml (loot)</button>',
    '<div class="biWarn">Offline exports without original XML contain additions only. Never upload them as full replacements.</div>',
    '</details>'
  ].join('');
  document.body.appendChild(panel);
  const message = (s, error) => { $('biStatus').textContent = s; $('biStatus').style.color = error ? '#ffb2a2' : '#a8d6e4'; };
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) refresh(); });
  $('biClose').addEventListener('click', () => { panel.hidden = true; placing = false; $('biPick').textContent = '📍 Pick on map'; });
  $('biPick').addEventListener('click', () => {
    placing = !placing;
    $('biPick').textContent = placing ? 'Click a map location…' : '📍 Pick on map';
    message(placing ? 'Click your preferred location on the map.' : 'Map selection cancelled.');
  });
  map.on('click', e => {
    if (!placing) return;
    const p = leafletToGame(e.latlng);
    if (!numbers(p.x, 0, 15360) || !numbers(p.z, 0, 15360)) return message('This location is outside Chernarus.', true);
    chosen = {x:Number(p.x.toFixed(2)), z:Number(p.z.toFixed(2))};
    placing = false; $('biPick').textContent = '📍 Pick on map';
    $('biPoint').textContent = chosen.x + ' / ' + chosen.z;
    panel.hidden = false;
    message('Location selected. Choose an event and save the draft.');
  });
  function parseXML(text, root) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror') || !doc.documentElement || doc.documentElement.nodeName !== root) throw new Error('Invalid XML: expected <' + root + '>.');
    return doc;
  }
  function addCatalog(doc, source) {
    if (source === 'types' || source === 'spawnables') {
      Array.from(doc.getElementsByTagName('type')).forEach(t => {
        const name = t.getAttribute('name');
        if (name) itemNames.add(name);
      });
    } else if (source === 'events') {
      Array.from(doc.getElementsByTagName('event')).forEach(ev => {
        if (!/^Vehicle/i.test(ev.getAttribute('name') || '')) return;
        Array.from(ev.getElementsByTagName('child')).forEach(c => {
          const name = c.getAttribute('type');
          if (name) vehicleNames.add(name);
        });
      });
    }
  }
  function catalogStatus() {
    $('biCatalog').textContent = itemNames.size + ' items, ' + vehicleNames.size + ' vehicles. Official catalog plus any imported server classnames.';
  }
  Promise.allSettled([
    fetch(BASE + 'db/types.xml').then(r => { if (!r.ok) throw new Error('types.xml HTTP ' + r.status); return r.text(); }).then(s => addCatalog(parseXML(s, 'types'),'types')),
    fetch(BASE + 'db/events.xml').then(r => { if (!r.ok) throw new Error('events.xml HTTP ' + r.status); return r.text(); }).then(s => addCatalog(parseXML(s, 'events'),'events'))
  ]).then(results => {
    catalogStatus();
    if (results.some(r => r.status === 'rejected')) message('Some official catalogs could not be loaded. You can import the XML files manually.', true);
    updateChoices('vehicle'); updateChoices('item');
  });
  function updateChoices(kind) {
    const input = $(kind === 'vehicle' ? 'biVehicleSearch' : 'biItemSearch');
    const target = $(kind === 'vehicle' ? 'biVehicleMatches' : 'biItemMatches');
    const term = input.value.toLowerCase().trim();
    target.replaceChildren();
    // Empty suggestion lists used to occupy a large part of the phone panel.
    // Keep searches compact until someone actually starts typing.
    if(term.length<2){target.hidden=true;return;}
    target.hidden=false;
    const set = kind === 'vehicle' ? vehicleNames : itemNames;
    const matches = [...set].filter(n => n.toLowerCase().includes(term)).sort((a,b) => a.localeCompare(b)).slice(0,25);
    if (!matches.length) { target.textContent = 'No matching classnames found.'; return; }
    matches.forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = name;
      btn.addEventListener('click', () => {
        if (kind === 'vehicle') { input.value = name; message('Vehicle selected: ' + name); }
        else {
          if (itemList.length >= 40) return message('A loot drop can contain up to 40 item lines.', true);
          const found = itemList.find(x => x.name === name);
          if (found) found.qty = Math.min(found.qty+1, 20);
          else itemList.push({name,qty:1});
          input.value = ''; renderItems(); message(name + ' added.');
        }
        target.replaceChildren();target.hidden=true;
      });
      target.appendChild(btn);
    });
  }
  $('biVehicleSearch').addEventListener('input', () => updateChoices('vehicle'));
  $('biItemSearch').addEventListener('input', () => updateChoices('item'));
  $('biKind').addEventListener('change', () => {
    $('biVehicleSection').hidden = $('biKind').value !== 'vehicle';
    $('biLootSection').hidden = $('biKind').value !== 'loot';
  });
  function renderItems() {
    const box = $('biItems'); box.replaceChildren();
    itemList.forEach((item,index) => {
      const line = document.createElement('div'); line.className = 'biRow'; line.style.marginTop = '5px';
      const label = document.createElement('span'); label.textContent = item.name; label.style.overflowWrap = 'anywhere'; label.title = item.name;
      const qty = document.createElement('input'); qty.type = 'number'; qty.min = '1'; qty.max = '20'; qty.value = item.qty; qty.style.maxWidth = '64px';
      qty.addEventListener('change', () => item.qty = Math.max(1, Math.min(20, Number(qty.value) || 1)));
      const del = document.createElement('button'); del.type = 'button'; del.textContent = '✕';
      del.addEventListener('click', () => { itemList.splice(index,1); renderItems(); });
      line.append(label,qty,del); box.appendChild(line);
    });
  }
  function persist() {
    try { localStorage.setItem(STORE, JSON.stringify(drafts)); }
    catch (e) { message('Browser storage failed. Check available space and privacy settings.', true); }
    renderDrafts();
  }
  function setForm(d, index) {
    editingIndex = index;
    chosen = {x:d.x,z:d.z}; $('biPoint').textContent = d.x + ' / ' + d.z;
    $('biName').value = d.name; $('biKind').value = d.kind; $('biKind').dispatchEvent(new Event('change'));
    $('biAngle').value = d.a; $('biVehicleSearch').value = d.vehicle || '';
    $('biContainer').value = d.container || 'SeaChest';
    itemList = (d.items || []).map(i => ({name:i.name,qty:i.qty})); renderItems();
    $('biAcknowledge').checked = false;
    $('biSave').textContent = 'Save changes';
    panel.hidden = false;
  }
  function resetForm() {
    editingIndex = -1; chosen = null; itemList = []; renderItems(); $('biAcknowledge').checked = false;
    $('biPoint').textContent = 'No location selected';
    $('biName').value = 'BuildIt_Event' + (drafts.length + 1);
    $('biKind').value = 'vehicle'; $('biKind').dispatchEvent(new Event('change'));
    $('biAngle').value = '0'; $('biVehicleSearch').value = '';
    $('biSave').textContent = 'Save spawn';
  }
  $('biNew').addEventListener('click', () => { resetForm(); message('New event. Pick a location on the map.'); });
  $('biSave').addEventListener('click', () => {
    const name = $('biName').value.trim(), kind = $('biKind').value;
    const a = Number($('biAngle').value);
    if (!valid(name)) return message('Event names may contain only letters, digits and underscores (up to 90 characters).', true);
    if (!chosen) return message('Pick a map location first.', true);
    if (!numbers(a,0,359.99)) return message('Rotation must be between 0 and 359.99.', true);
    if (drafts.some((d,i) => i !== editingIndex && d.name.toLowerCase() === name.toLowerCase())) return message('This event name already exists.', true);
    const entry = {name,kind,x:chosen.x,z:chosen.z,a};
    if (kind === 'vehicle') {
      if (!vehicleNames.has($('biVehicleSearch').value.trim())) return message('Select a vehicle from the official or imported catalog.', true);
      entry.vehicle = $('biVehicleSearch').value.trim();
    } else {
      if (!itemList.length) return message('Add at least one item first.', true);
      if (!itemList.every(i => itemNames.has(i.name) && numbers(i.qty,1,20))) return message('An item or quantity is invalid.', true);
      if (!$('biAcknowledge').checked) return message('Acknowledge the global cargo warning first.', true);
      entry.container = $('biContainer').value;
      entry.items = itemList.map(i => ({name:i.name,qty:Number(i.qty)}));
    }
    if (editingIndex < 0) drafts.push(entry); else drafts[editingIndex] = entry;
    clearStaged(); persist(); resetForm(); message('Spawn queued. Review changes to prepare the upload.');
  });
  function renderDrafts() {
    layer.clearLayers();
    const list = $('biDrafts'); list.replaceChildren();
    $('biDraftCount').textContent=drafts.length+' saved';
    if (!drafts.length){
      const empty=document.createElement('div');empty.className='biSmall';
      empty.textContent='No queued events. Save a spawn to add one.';
      list.appendChild(empty);
    }
    drafts.forEach((d,index) => {
      const marker=L.marker(gameToLeaflet(d.x,d.z), {title:d.name}).addTo(layer);
      marker.bindTooltip(d.name+' ('+d.kind+')');
      marker.on('click', () => {setForm(d,index); message('Editing '+d.name);});
      const card=document.createElement('div');card.className='biDraft';
      const title=document.createElement('div');title.className='biDraftTitle';title.textContent=d.name;
      const details=document.createElement('div');details.className='biDraftDetails';
      details.textContent=(d.kind==='vehicle'?d.vehicle:d.container)+
        '  ·  X '+d.x+' / Z '+d.z+'  ·  '+d.a+'°';
      const row=document.createElement('div');row.className='biRow';
      const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';
      edit.title='Edit queued event '+d.name;
      edit.addEventListener('click',()=>setForm(d,index));
      const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';
      remove.title='Remove queued event '+d.name;
      remove.addEventListener('click',()=>{
        if(!confirm('Remove '+d.name+' from your saved drafts?'))return;
        drafts.splice(index,1);clearStaged();persist();resetForm();
      });
      row.append(edit,remove);card.append(title,details,row);list.appendChild(card);
    });
  }
  function refresh() { renderDrafts(); catalogStatus(); }
  renderDrafts();
  $('biFiles').addEventListener('change', async evt => {
    let imported = 0;
    for (const file of evt.target.files) {
      const name = file.name.toLowerCase(), type = ({'types.xml':'types','events.xml':'events','cfgeventspawns.xml':'eventposdef','cfgspawnabletypes.xml':'spawnabletypes'})[name];
      if (!type) { message('Unrecognized file skipped: ' + file.name, true); continue; }
      try {
        const content = await file.text(), doc = parseXML(content,type);
        files[name] = content;
        if (name === 'types.xml') addCatalog(doc,'types');
        if (name === 'events.xml') addCatalog(doc,'events');
        if (name === 'cfgspawnabletypes.xml') addCatalog(doc,'spawnables');
        imported++;
      } catch (err) { message(file.name + ': ' + err.message, true); }
    }
    $('biImportStatus').textContent = Object.keys(files).join(', ') || 'No imported files.';
    catalogStatus(); updateChoices('vehicle'); updateChoices('item');
    if (imported) message(imported + ' file(s) imported. Everything remains in your browser.');
    evt.target.value = '';
  });
  function node(doc,tag,text) {
    const n=doc.createElement(tag);
    if (text !== undefined) n.textContent=String(text);
    return n;
  }
  function child(doc,parent,tag,value) { const n=node(doc,tag,value); parent.appendChild(n); return n; }
  function createEvent(doc,d) {
    const ev=node(doc,'event'); ev.setAttribute('name',d.name);
    const cfg=[
      ['nominal',1],['min',0],['max',1],['lifetime',d.kind === 'vehicle' ? 300 : 3600],
      ['restock',0],['saferadius',0],['distanceradius',0],['cleanupradius',0]
    ];
    cfg.forEach(k => child(doc,ev,k[0],k[1]));
    const flags=child(doc,ev,'flags'); flags.setAttribute('deletable','0'); flags.setAttribute('init_random','0'); flags.setAttribute('remove_damaged','1');
    child(doc,ev,'position','fixed'); child(doc,ev,'limit','child'); child(doc,ev,'active',1);
    const children=child(doc,ev,'children'); const entry=child(doc,children,'child');
    [['lootmax',0],['lootmin',0],['max',1],['min',1],['type',d.kind === 'vehicle' ? d.vehicle : d.container]].forEach(x => entry.setAttribute(x[0],String(x[1])));
    return ev;
  }
  function createPos(doc,d) {
    const ev=node(doc,'event'); ev.setAttribute('name',d.name);
    const pos=child(doc,ev,'pos'); pos.setAttribute('x',String(d.x)); pos.setAttribute('z',String(d.z)); pos.setAttribute('a',String(d.a));
    return ev;
  }
  function createCargo(doc,container,items) {
    const t=node(doc,'type'); t.setAttribute('name',container);
    items.forEach(i => { for (let j=0;j<i.qty;j++) {
      const cargo=child(doc,t,'cargo'); cargo.setAttribute('chance','1.0');
      const item=child(doc,cargo,'item'); item.setAttribute('name',i.name); item.setAttribute('chance','1.0');
    } });
    return t;
  }
  // Only append new event nodes: DOM XMLSerializer rewrites all original
  // whitespace and can accidentally duplicate the XML declaration.
  function xmlEscapedText(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function xmlEscapedAttribute(value){
    return xmlEscapedText(value).replace(/"/g,'&quot;').replace(/\r/g,'&#13;')
      .replace(/\n/g,'&#10;').replace(/\t/g,'&#9;');
  }
  function formatNewXmlNode(element, level, unit, newline){
    const tag=element.tagName;
    const attrs=Array.from(element.attributes).map(a=>
      ' '+a.name+'="'+xmlEscapedAttribute(a.value)+'"').join('');
    const kids=Array.from(element.childNodes);
    if(!kids.length)return level+'<'+tag+attrs+'/>';
    if(kids.length===1 && kids[0].nodeType===3)
      return level+'<'+tag+attrs+'>'+xmlEscapedText(kids[0].nodeValue)+'</'+tag+'>';
    const inner=kids.map(n=>{
      if(n.nodeType===1)return formatNewXmlNode(n,level+unit,unit,newline);
      if(n.nodeType===3)return level+unit+xmlEscapedText(n.nodeValue);
      throw new Error('Unexpected event XML node type.');
    }).join(newline);
    return level+'<'+tag+attrs+'>'+newline+inner+newline+level+'</'+tag+'>';
  }
  function appendXmlEventsWithoutReformatting(original,root,newNodes){
    const originalDoc=parseXML(original,root);
    const declaration=original.match(/^\uFEFF?\s*<\?xml\b([\s\S]*?)\?>/i);
    const encoding=declaration?.[1]?.match(/\bencoding\s*=\s*(['"])(.*?)\1/i)?.[2];
    // Existing Worker always re-encodes UTF-8; block any other declaration.
    if(encoding && !/^utf-?8$/i.test(encoding))
      throw new Error('Server file declares '+encoding+' encoding; UTF-8 upload is blocked to prevent corruption.');
    const oldNames=new Set(Array.from(originalDoc.documentElement.children)
      .filter(n=>n.tagName==='event').map(n=>String(n.getAttribute('name')||'').toLowerCase()));
    for(const el of newNodes){
      const key=String(el.getAttribute('name')||'').toLowerCase();
      if(oldNames.has(key))throw new Error('Event "'+el.getAttribute('name')+'" already exists in the original '+root+' file.');
      oldNames.add(key);
    }
    const newline=original.includes('\r\n')?'\r\n':
      original.includes('\n')?'\n':original.includes('\r')?'\r':'\n';
    const closing=[...original.matchAll(new RegExp('</'+root+'\\s*>','gi'))].pop();
    if(!closing)throw new Error('Missing closing </'+root+'>; refusing to overwrite.');
    const closeStart=closing.index;
    const beforeClose=original.slice(0,closeStart);
    const lastLine=Math.max(beforeClose.lastIndexOf('\n'),beforeClose.lastIndexOf('\r'));
    const linePrefix=lastLine<0?beforeClose:beforeClose.slice(lastLine+1);
    const closeIndent=/^[ \t]*$/.test(linePrefix)?linePrefix:'';
    const indentEvent=(original.match(/(?:\r\n|\n|\r)([ \t]+)<event(?=[\s>])/i)||[])[1];
    const eventIndent=indentEvent || (closeIndent+(original.includes('\t')?'\t':'    '));
    const indentChild=(original.match(/(?:\r\n|\n|\r)([ \t]+)<(?:nominal|pos|flags|children)(?=[\s>])/i)||[])[1];
    const unit=indentChild&&indentChild.startsWith(eventIndent)&&indentChild.length>eventIndent.length
      ?indentChild.slice(eventIndent.length):
      eventIndent.includes('\t')?'\t':eventIndent.length>=2?' '.repeat(Math.min(4,eventIndent.length)):'    ';
    const insertionAt=closeStart-closeIndent.length;
    const prefix=original.slice(0,insertionAt);
    const blocks=newNodes.map(el=>formatNewXmlNode(el,eventIndent,unit,newline)).join(newline+newline);
    const insertion=(/[\r\n]$/.test(prefix)?'':newline)+blocks+newline;
    const merged=prefix+insertion+original.slice(insertionAt);
    const resultDoc=parseXML(merged,root);
    if(resultDoc.documentElement.children.length!==originalDoc.documentElement.children.length+newNodes.length)
      throw new Error('New XML failed its structure check; upload cancelled.');
    if(!merged.startsWith(prefix)||!merged.endsWith(original.slice(insertionAt)))
      throw new Error('Original XML preservation check failed.');
    return merged;
  }
  function buildOutput(kind) {
    if (!drafts.length) throw new Error('Create an event first.');
    if (kind === 'cargo' && !drafts.some(d => d.kind === 'loot')) throw new Error('There are no loot drops to export.');
    const filename = kind === 'events' ? 'events.xml' : kind === 'positions' ? 'cfgeventspawns.xml' : 'cfgspawnabletypes.xml';
    const root = kind === 'events' ? 'events' : kind === 'positions' ? 'eventposdef' : 'spawnabletypes';
    const original = files[filename];
    const doc = original ? parseXML(original,root) : document.implementation.createDocument(null,root,null);
    if (kind === 'cargo') {
      const loadouts = new Map();
      drafts.filter(d => d.kind === 'loot').forEach(d => {
        const spec = JSON.stringify(d.items.map(x => [x.name,x.qty]).sort((a,b)=>a[0].localeCompare(b[0])));
        if (loadouts.has(d.container) && loadouts.get(d.container).spec !== spec) throw new Error('Multiple loot drops use ' + d.container + ' with different cargo. DayZ cannot assign different cargo to the same classname per location. Use distinct container types or identical cargo.');
        loadouts.set(d.container,{spec,items:d.items});
      });
      loadouts.forEach((data,cls) => {
        let typeNode=Array.from(doc.documentElement.children).find(n => n.nodeName === 'type' && n.getAttribute('name') === cls);
        if (!typeNode) {typeNode=node(doc,'type'); typeNode.setAttribute('name',cls); doc.documentElement.appendChild(typeNode);}
        Array.from(typeNode.children).filter(n => n.nodeName === 'cargo').forEach(n => typeNode.removeChild(n));
        const cargo=createCargo(doc,cls,data.items);
        while (cargo.firstChild) typeNode.appendChild(cargo.firstChild);
      });
    } else {
      if(original){
        const elements=drafts.map(d=>kind==='events'?createEvent(doc,d):createPos(doc,d));
        const xml=appendXmlEventsWithoutReformatting(original,root,elements);
        return {filename,xml,complete:true};
      }
      drafts.forEach(d=>{
        const exists=Array.from(doc.documentElement.children).some(el=>
          el.nodeName==='event' && el.getAttribute('name')?.toLowerCase()===d.name.toLowerCase());
        if(exists)throw new Error('Event "'+d.name+'" already exists in '+filename+'. Rename it before exporting.');
        doc.documentElement.appendChild(kind==='events'?createEvent(doc,d):createPos(doc,d));
      });
    }
    // For offline add-only exports, indent every new element instead of
    // serializing the entire document onto a single unreadable line.
    // Existing cargo imports retain the legacy manual-only exporter.
    const xml = !original
      ? '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'+
        formatNewXmlNode(doc.documentElement,'','    ','\n')+'\n'
      : (()=>{
          const encoded=new XMLSerializer().serializeToString(doc);
          const declaration=original.match(/^\uFEFF?\s*<\?xml\b[\s\S]*?\?>/i);
          const withoutLeading=encoded.replace(/^\uFEFF?\s*<\?xml\b[\s\S]*?\?>\s*/i,'');
          return (declaration?.[0]||'<?xml version="1.0" encoding="UTF-8"?>')+'\n'+withoutLeading;
        })();
    return {filename: original ? filename : 'BuildIt_ADD_ONLY_' + filename,xml,complete:!!original};
  }
  // Nitrado deployment: vehicle events only. Client previews are never treated as
  // replacements unless BOTH matching complete server files were loaded first.
  // Each POST goes through the Worker with MAP_WRITE_KEY + checksum and backup.
  const eventDeploy = {
    mission:'', paths:{}, signatures:{}, repairs:{}, staged:null, loading:false, sending:false
  };
  const deploySummary = $('biServerPreview');
  const deployLoad = $('biLoadServer');
  const deployPreview = $('biPreviewServer');
  const deployUpload = $('biUploadServer');
  function setDeploy(text, error=false){
    deploySummary.textContent=text;
    deploySummary.style.color=error?'#ffafaf':'';
  }
  function deploymentSnapshot(){
    return JSON.stringify(drafts.map(d=>({
      name:d.name,kind:d.kind,x:d.x,z:d.z,a:d.a,vehicle:d.vehicle,container:d.container,items:d.items
    })));
  }
  async function serverXmlRead(path){
    const data=await nitradoRequest('/api/files/read?file='+encodeURIComponent(path));
    if(data?.path!==path||typeof data.content!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256||''))
      throw new Error('Worker returned incomplete file content or checksum for '+path.split('/').pop());
    if(new TextEncoder().encode(data.content).byteLength>512*1024)
      throw new Error(path.split('/').pop()+' is over the 512 KB editable file limit.');
    return data;
  }
  async function discoverServerMission(){
    const initial=await nitradoRequest('/api/files/list');
    const match=String(initial?.root||'').match(/^\/games\/([A-Za-z0-9_-]{1,100})\/(?:noftp|ftproot)$/);
    if(!match)throw new Error('Unexpected Nitrado file root. Check Logs → Nitrado File Manager.');
    const base='/games/'+match[1];
    for(const root of [base+'/ftproot',base+'/noftp']){
      for(const mission of ['dayzps_missions/dayzOffline.chernarusplus','mpmissions/dayzOffline.chernarusplus']){
        const path=root+'/'+mission;
        try {
          const list=await nitradoRequest('/api/files/list?dir='+encodeURIComponent(path));
          if(list?.dir===path&&Array.isArray(list.entries)&&
            list.entries.some(item=>item.name==='db')){
            return path;
          }
        } catch(_){}
      }
    }
    throw new Error('Chernarus mission directory not found. Verify the FTP/NoFTP root in the File Manager.');
  }
  function vehicleDrafts(){
    if(!drafts.length)throw new Error('Save an event draft before attempting to deploy.');
    if(drafts.some(d=>d.kind!=='vehicle'))
      throw new Error('Automated deployment currently supports vehicle drafts only. Download and inspect XML for loot containers.');
    return drafts;
  }
  function clearStaged(){
    eventDeploy.staged=null;
    deployUpload.disabled=true;
    $('biServerStopped').checked=false;
    $('biRepairAcknowledge').checked=false;
    $('biRepairConfirm').hidden=true;
  }
  async function loadLiveXml(){
    if(eventDeploy.loading||eventDeploy.sending)throw new Error('A Nitrado operation is already running.');
    eventDeploy.loading=true;
    deployLoad.disabled=true;
    setDeploy('Reading current XML from Nitrado…');
    try{
      if(typeof nitradoRequest!=='function')throw new Error('Connect Nitrado in Logs before publishing.');
      const mission=await discoverServerMission();
      const paths={
        'events.xml':mission+'/db/events.xml',
        'cfgeventspawns.xml':mission+'/cfgeventspawns.xml'
      };
      const [events,positions]=await Promise.all([
        serverXmlRead(paths['events.xml']),serverXmlRead(paths['cfgeventspawns.xml'])
      ]);
      // Repair ONLY repeated XML declarations directly at the top.
      // The live server files remain unchanged until the user authorizes an upload.
      const eventClean=window.BUILD_IT_XML.repairDuplicateDeclarations(events.content,'events');
      const positionClean=window.BUILD_IT_XML.repairDuplicateDeclarations(positions.content,'eventposdef');
      files['events.xml']=eventClean.content;
      files['cfgeventspawns.xml']=positionClean.content;
      eventDeploy.repairs={'events.xml':eventClean.removed,'cfgeventspawns.xml':positionClean.removed};
      eventDeploy.mission=mission;
      eventDeploy.paths=paths;
      eventDeploy.signatures={'events.xml':events.sha256,'cfgeventspawns.xml':positions.sha256};
      addCatalog(parseXML(eventClean.content,'events'),'events');
      catalogStatus();updateChoices('vehicle');
      $('biImportStatus').textContent='Latest events.xml and cfgeventspawns.xml loaded from Nitrado.';
    }finally{
      eventDeploy.loading=false;
      deployLoad.disabled=false;
    }
  }
  deployLoad.addEventListener('click',async()=>{
    if(eventDeploy.sending||eventDeploy.loading)return;
    clearStaged();deployPreview.disabled=true;
    try{
      await loadLiveXml();
      setDeploy('Server XML reloaded. Review changes to prepare an upload.');
    }catch(e){setDeploy('Nitrado reload failed: '+e.message,true);}
    finally{deployPreview.disabled=false;}
  });
  deployPreview.addEventListener('click',async()=>{
    if(eventDeploy.sending||eventDeploy.loading)return;
    clearStaged();
    deployPreview.disabled=true;
    try{
      const selected=vehicleDrafts();
      // Always refresh originals: an offline import or previous preview
      // must never be used as the source of a live server replacement.
      await loadLiveXml();
      const events=buildOutput('events'),positions=buildOutput('positions');
      if(!events.complete||!positions.complete)
        throw new Error('Incomplete Nitrado XML. Upload refused.');
      if(new TextEncoder().encode(events.xml).byteLength>512*1024||
         new TextEncoder().encode(positions.xml).byteLength>512*1024)
        throw new Error('Generated XML exceeds the 512 KB upload limit.');
      // Revalidate the final text, not only the source files. Never upload a
      // duplicate <?xml...?> or another malformed XML document.
      window.BUILD_IT_XML.validate(events.xml,'events');
      window.BUILD_IT_XML.validate(positions.xml,'eventposdef');
      eventDeploy.staged={
        xml:{'events.xml':events.xml,'cfgeventspawns.xml':positions.xml},
        snapshot:deploymentSnapshot()
      };
      const repairs=Object.entries(eventDeploy.repairs)
        .filter(([,count])=>count>0)
        .map(([file,count])=>file+': '+count+' extra declaration(s) removed');
      $('biRepairConfirm').hidden=repairs.length===0;
      const previewNames=selected.map(d=>d.name+' · '+d.vehicle+
        ' · X '+d.x+', Z '+d.z+', '+d.a+'°').join('\n');
      setDeploy('READY — '+selected.length+' vehicle event(s) will be added:\n\n'+previewNames+
        (repairs.length?'\n\nXML REPAIR NEEDED:\n'+repairs.join('\n')+
         '\nPlease approve the repair below before uploading.':'')+
        '\n\nFiles: db/events.xml and cfgeventspawns.xml.'+
        '\nOriginal event entries, indentation and comments will be retained.'+
        '\nBoth files receive verified backups before replacement. If the second upload fails, restore the first from its backup.');
      deployUpload.disabled=false;
    }catch(e){
      eventDeploy.mission='';
      setDeploy('Review failed: '+e.message,true);
    }finally{deployPreview.disabled=false;}
  });
  deployUpload.addEventListener('click',async()=>{
    if(eventDeploy.sending)return;
    const staged=eventDeploy.staged;
    if(!staged){setDeploy('Preview the changes first.',true);return;}
    if(staged.snapshot!==deploymentSnapshot()){
      clearStaged();setDeploy('Drafts changed since preview. Preview again before uploading.',true);return;
    }
    if(!$('biRepairConfirm').hidden && !$('biRepairAcknowledge').checked){
      setDeploy('Approve removing the duplicate XML headers before uploading.',true);return;
    }
    if(!$('biServerStopped').checked){
      setDeploy('Stop your DayZ server and check the confirmation box before uploading.',true);return;
    }
    if(!window.confirm('Upload '+drafts.length+' vehicle event(s) to your LIVE server?\n'+
      'This will back up and overwrite events.xml and cfgeventspawns.xml.\n'+
      'Nitrado must grant file-write permission. Continue?'))return;
    eventDeploy.sending=true;deployUpload.disabled=true;deployLoad.disabled=true;deployPreview.disabled=true;
    const results=[],changes=['events.xml','cfgeventspawns.xml'];
    try{
      // Preflight read both so stale files cannot overwrite other administrators' updates.
      for(const name of changes){
        const latest=await serverXmlRead(eventDeploy.paths[name]);
        if(latest.sha256!==eventDeploy.signatures[name])
          throw new Error(name+' changed on Nitrado since loading. Reload both files and preview again. No uploads started.');
      }
      for(const name of changes){
        const expectedRoot=name==='events.xml'?'events':'eventposdef';
        window.BUILD_IT_XML.validate(staged.xml[name],expectedRoot);
        setDeploy('Creating verified backup and uploading '+name+' ('+(results.length+1)+'/2)…');
        const result=await nitradoRequest('/api/files/write',{
          method:'POST',writeKey:true,
          body:{
            path:eventDeploy.paths[name],content:staged.xml[name],
            expectedSha256:eventDeploy.signatures[name],confirm:true
          }
        });
        if(!result?.verified||!result?.backupPath)throw new Error(name+' was not verified by the Worker.');
        results.push({name,backup:result.backupPath});
      }
      const deployed=drafts.length;
      // These were queued changes, not permanent user records. Only clear them
      // after both files have been verified on the server. This avoids trying
      // to publish identical event names on the next upload.
      drafts=[];persist();resetForm();
      setDeploy('UPLOAD VERIFIED — '+deployed+' vehicle event(s) published. Queue cleared.\n'+
        results.map(r=>r.name+' backup: '+r.backup).join('\n')+
        '\nStart the DayZ server to load the new economy event configuration.');
      clearStaged();
      // A new deployment can only be prepared after fetching the new server originals.
      eventDeploy.mission='';
      deployPreview.disabled=true;
    }catch(e){
      setDeploy('UPLOAD FAILED: '+e.message+'\n'+
        (results.length?'ALREADY UPLOADED: '+results.map(r=>r.name+' (backup '+r.backup+')').join(', ')+
          '. Restore these files from their backups before retrying.':
          'No file upload was verified. Check write permissions or directory settings.')+
        '\nNo automatic rollback was attempted.',true);
      clearStaged();
      eventDeploy.mission=''; // force reload after ambiguous partial failure
    }finally{
      eventDeploy.sending=false;deployLoad.disabled=false;
    }
  });

  function downloadXML(data) {
    const url=URL.createObjectURL(new Blob([data.xml],{type:'application/xml;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download=data.filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  [['biExportEvents','events'],['biExportPositions','positions'],['biExportCargo','cargo']].forEach(pair => {
    $(pair[0]).addEventListener('click', () => {
      try {
        const result=buildOutput(pair[1]); downloadXML(result);
        message(result.filename + ' downloaded. ' + (result.complete ? 'Merged with the imported source file. Back up and validate the XML before uploading.' : 'WARNING: additions only. Do not upload this file as a direct replacement.'));
      } catch(err) { message(err.message,true); }
    });
  });
})();
