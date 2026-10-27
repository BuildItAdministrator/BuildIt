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
    '@media(max-height:500px){#biPanel{top:65px;max-height:calc(100vh - 70px)}}'
  ].join('');
  document.head.appendChild(style);

  const toggle = document.createElement('button');
  toggle.id = 'biToggle'; toggle.type = 'button'; toggle.textContent = '⚙ Event Manager';
  document.body.appendChild(toggle);
  const panel = document.createElement('div');
  panel.id = 'biPanel'; panel.hidden = true;
  panel.innerHTML = [
    '<div class="biRow"><h3 style="flex:1">Event Manager</h3><button type="button" id="biClose">✕</button></div>',
    '<div class="biSmall">Select a location on the map, then configure a vehicle or loot drop. Drafts stay in this browser.</div>',
    '<div class="biRow"><button type="button" id="biPick">📍 Pick on map</button><span id="biPoint" class="biPoint">No location selected</span></div>',
    '<label for="biName">Unique event name</label><input id="biName" value="BuildIt_Event1" maxlength="90">',
    '<div class="biRow"><div><label for="biKind">Type</label><select id="biKind"><option value="vehicle">Vehicle / motorcycle</option><option value="loot">Loot drop in container</option></select></div>',
    '<div><label for="biAngle">Rotation (°)</label><input id="biAngle" type="number" min="0" max="359.99" step="0.01" value="0"></div></div>',
    '<div id="biVehicleSection"><label for="biVehicleSearch">Search vehicles (name or classname)</label><input id="biVehicleSearch" type="search" autocomplete="off" placeholder="Motorbike, Sedan, Truck ..."><div id="biVehicleMatches" class="biMatches"></div>',
    '<p class="biSmall">Parts and their spawn probabilities are controlled by your existing cfgspawnabletypes.xml.</p></div>',
    '<div id="biLootSection" hidden><label for="biContainer">Container</label><select id="biContainer"><option>SeaChest</option><option>WoodenCrate</option><option>SmallProtectorCase</option><option>Barrel_Green</option><option>Barrel_Blue</option></select>',
    '<label for="biItemSearch">Search items (all classnames from types.xml)</label><input id="biItemSearch" type="search" autocomplete="off" placeholder="M4, Bandage, Nail ..."><div id="biItemMatches" class="biMatches"></div>',
    '<div id="biItems"></div>',
    '<div class="biWarn">WARNING: cfgspawnabletypes.xml applies cargo rules to an entire container classname, NOT to individual locations. Any container of the same classname may receive this cargo. Use only a container type reserved for this purpose.</div>',
    '<label style="font-weight:400"><input type="checkbox" id="biAcknowledge"> I understand this cargo configuration applies to every container of this classname.</label></div>',
    '<div class="biRow" style="margin-top:12px"><button type="button" id="biSave">Save draft</button><button type="button" id="biNew">New</button></div>',
    '<div class="biDivider"></div><h4>Saved events</h4><div id="biDrafts"></div>',
    '<div class="biDivider"></div><h4>Catalog &amp; Nitrado files</h4>',
    '<div id="biCatalog" class="biSmall">Loading official classnames ...</div>',
    '<label for="biFiles">Import existing XML files (recommended)</label>',
    '<input id="biFiles" type="file" accept=".xml" multiple>',
    '<div class="biSmall">Select db/events.xml, cfgeventspawns.xml, cfgspawnabletypes.xml and optionally db/types.xml. Existing entries are kept during export. Files remain in your browser.</div>',
    '<div id="biImportStatus" class="biSmall">No server files imported yet.</div>',
    '<div class="biDivider"></div><h4>Deploy vehicle events to Nitrado</h4>',
    '<div class="biSmall">Uses your live events.xml and cfgeventspawns.xml. No manual files needed. Before uploading, stop DayZ in Nitrado and review the planned changes. Vehicles use your existing cfgspawnabletypes.xml attachment rules.</div>',
    '<button type="button" id="biLoadServer" style="width:100%">1. Load live Nitrado XML files</button>',
    '<button type="button" id="biPreviewServer" style="width:100%;margin-top:6px" disabled>2. Preview vehicle changes</button>',
    '<div id="biServerPreview" class="biSmall" role="status" aria-live="polite">Not connected to live XML files yet.</div>',
    '<label style="font-weight:400"><input type="checkbox" id="biServerStopped"> I stopped the DayZ server and reviewed these changes.</label>',
    '<button type="button" id="biUploadServer" style="width:100%;margin-top:6px" disabled>3. Backup &amp; upload to Nitrado</button>',
    '<div class="biRow" style="margin-top:10px"><button type="button" id="biExportEvents">events.xml</button><button type="button" id="biExportPositions">cfgeventspawns.xml</button></div>',
    '<button type="button" id="biExportCargo" style="width:100%;margin-top:7px">cfgspawnabletypes.xml (loot)</button>',
    '<div class="biWarn" style="margin-top:8px">Without imported source files, exports contain additions ONLY, not complete Nitrado configuration files. Never upload these additions as replacements. Back up and validate changes before uploading; a server restart is generally required.</div>',
    '<div id="biStatus" role="status" aria-live="polite"></div>'
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
    const set = kind === 'vehicle' ? vehicleNames : itemNames;
    const matches = [...set].filter(n => !term || n.toLowerCase().includes(term)).sort((a,b) => a.localeCompare(b)).slice(0,25);
    target.replaceChildren();
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
        target.replaceChildren();
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
    $('biSave').textContent = 'Save draft';
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
    persist(); resetForm(); message('Draft saved. Nothing has been changed on Nitrado.');
  });
  function renderDrafts() {
    layer.clearLayers();
    const list = $('biDrafts'); list.replaceChildren();
    if (!drafts.length) list.textContent = 'No saved events yet.';
    drafts.forEach((d,index) => {
      const m = L.marker(gameToLeaflet(d.x,d.z), {title:d.name}).addTo(layer);
      m.bindTooltip(d.name + ' (' + d.kind + ')');
      m.on('click', () => { setForm(d,index); message('Event loaded: ' + d.name); });
      const div = document.createElement('div'); div.className = 'biDraft';
      const text = document.createElement('div'); text.textContent = d.name + ' · ' + (d.kind === 'vehicle' ? d.vehicle : d.container) + ' · X ' + d.x + ', Z ' + d.z;
      text.style.marginBottom = '6px'; div.appendChild(text);
      const row = document.createElement('div'); row.className = 'biRow';
      const edit = document.createElement('button'); edit.textContent = 'Edit'; edit.addEventListener('click', () => setForm(d,index));
      const remove = document.createElement('button'); remove.textContent = 'Delete';
      remove.addEventListener('click', () => { if (!confirm('Event ' + d.name + ' from your saved drafts?')) return; drafts.splice(index,1); persist(); resetForm(); });
      row.append(edit,remove); div.appendChild(row); list.appendChild(div);
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
      drafts.forEach(d => {
        const exists = Array.from(doc.documentElement.children).some(el => el.nodeName === 'event' && el.getAttribute('name') === d.name);
        if (exists) throw new Error('Event "' + d.name + '" already exists in ' + filename + '. Rename the event before exporting.');
        doc.documentElement.appendChild(kind === 'events' ? createEvent(doc,d) : createPos(doc,d));
      });
    }
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(doc);
    return {filename: original ? filename : 'BuildIt_ADD_ONLY_' + filename,xml,complete:!!original};
  }
  // Nitrado deployment: vehicle events only. Client previews are never treated as
  // replacements unless BOTH matching complete server files were loaded first.
  // Each POST goes through the Worker with MAP_WRITE_KEY + checksum and backup.
  const eventDeploy = {
    mission:'', paths:{}, signatures:{}, staged:null, loading:false, sending:false
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
  }
  deployLoad.addEventListener('click',async()=>{
    if(eventDeploy.loading||eventDeploy.sending)return;
    eventDeploy.loading=true;deployLoad.disabled=true;
    clearStaged();deployPreview.disabled=true;
    setDeploy('Finding mission and downloading complete live XML files…');
    try{
      if(typeof nitradoRequest!=='function')throw new Error('Nitrado connection is unavailable. Set up Logs → Automatic Nitrado Sync first.');
      const mission=await discoverServerMission();
      const paths={
        'events.xml':mission+'/db/events.xml',
        'cfgeventspawns.xml':mission+'/cfgeventspawns.xml'
      };
      const [events,positions]=await Promise.all([
        serverXmlRead(paths['events.xml']),serverXmlRead(paths['cfgeventspawns.xml'])
      ]);
      parseXML(events.content,'events');parseXML(positions.content,'eventposdef');
      files['events.xml']=events.content;
      files['cfgeventspawns.xml']=positions.content;
      eventDeploy.mission=mission;
      eventDeploy.paths=paths;
      eventDeploy.signatures={'events.xml':events.sha256,'cfgeventspawns.xml':positions.sha256};
      addCatalog(parseXML(events.content,'events'),'events');
      catalogStatus();updateChoices('vehicle');
      $('biImportStatus').textContent='Loaded complete events.xml and cfgeventspawns.xml from Nitrado.';
      deployPreview.disabled=false;
      setDeploy('Live XML loaded from '+mission+'. Save a vehicle draft, then click Preview vehicle changes.');
    }catch(e){setDeploy('Could not load live Nitrado XML: '+e.message,true);}
    finally{eventDeploy.loading=false;deployLoad.disabled=false;}
  });
  deployPreview.addEventListener('click',()=>{
    clearStaged();
    try{
      const selected=vehicleDrafts();
      if(!eventDeploy.mission)throw new Error('Load live Nitrado XML files first.');
      // The existing composer verifies duplicates and preserves the rest of the XML.
      const events=buildOutput('events'), positions=buildOutput('positions');
      if(!events.complete||!positions.complete)
        throw new Error('Incomplete Nitrado XML; refusing an additions-only replacement.');
      if(new TextEncoder().encode(events.xml).byteLength>512*1024||
         new TextEncoder().encode(positions.xml).byteLength>512*1024)
        throw new Error('Generated XML exceeds the 512 KB write limit. No upload attempted.');
      eventDeploy.staged={
        xml:{'events.xml':events.xml,'cfgeventspawns.xml':positions.xml},
        snapshot:deploymentSnapshot()
      };
      const previewNames=selected.map(d=>d.name+' → '+d.vehicle+
        ' (X '+d.x+', Z '+d.z+', rotation '+d.a+'°)').join('\n');
      setDeploy('READY FOR REVIEW — no server files changed.\n'+
        'Add '+selected.length+' vehicle event(s):\n'+previewNames+
        '\n\nWill back up and replace these live files:\n'+
        eventDeploy.paths['events.xml']+'\n'+eventDeploy.paths['cfgeventspawns.xml']+
        '\n\nIMPORTANT: both writes must succeed. If the second fails, the first may already be updated; use the displayed backup path to restore it.');
      deployUpload.disabled=false;
    }catch(e){setDeploy('Preview failed: '+e.message,true);}
  });
  deployUpload.addEventListener('click',async()=>{
    if(eventDeploy.sending)return;
    const staged=eventDeploy.staged;
    if(!staged){setDeploy('Preview the changes first.',true);return;}
    if(staged.snapshot!==deploymentSnapshot()){
      clearStaged();setDeploy('Drafts changed since preview. Preview again before uploading.',true);return;
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
      setDeploy('UPLOAD VERIFIED — '+drafts.length+' vehicle event(s), both files updated.\n'+
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
