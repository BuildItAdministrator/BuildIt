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
  // Verified vanilla DayZ 1.30 vehicle bodies, including rarely configured color variants.
  // Also augment with every official map's vehicle-event classnames and imported server events.
  const VEHICLE_LABELS={
  "OffroadHatchback": "Ada 4x4 - Green",
  "OffroadHatchback_Blue": "Ada 4x4 - Blue",
  "OffroadHatchback_White": "Ada 4x4 - White",
  "Hatchback_02": "Gunter 2 - Red",
  "Hatchback_02_Black": "Gunter 2 - Black",
  "Hatchback_02_Blue": "Gunter 2 - Blue",
  "CivilianSedan": "Olga 24 - White",
  "CivilianSedan_Black": "Olga 24 - Black",
  "CivilianSedan_Wine": "Olga 24 - Wine",
  "Sedan_02": "Sarka 120 - Yellow",
  "Sedan_02_Grey": "Sarka 120 - Grey",
  "Sedan_02_Red": "Sarka 120 - Red",
  "Truck_01_Covered": "M3S truck - Green",
  "Truck_01_Covered_Blue": "M3S truck - Blue",
  "Truck_01_Covered_Orange": "M3S truck - Orange",
  "Offroad_02": "M1025 Humvee - Green",
  "Offroad_02_Beige": "M1025 Humvee - Sand (beige)",
  "Boat_01_Black": "Rubber boat - Black",
  "Boat_01_Blue": "Rubber boat - Blue",
  "Boat_01_Camo": "Rubber boat - Camo",
  "Boat_01_Orange": "Rubber boat - Orange",
  "Motorbike_01_Blue": "Jana 50 moped - Blue",
  "Motorbike_01_Red": "Jana 50 moped - Red",
  "Motorbike_01_Yellow": "Jana 50 moped - Yellow",
  "Motorbike_02_Blue": "Bitrak 682 dirt bike - Blue",
  "Motorbike_02_Green": "Bitrak 682 dirt bike - Green",
  "Motorbike_02_Red": "Bitrak 682 dirt bike - Red",
  "Motorbike_02_Yellow": "Bitrak 682 dirt bike - Yellow"
};
  const vehicleNames = new Set(Object.keys(VEHICLE_LABELS));
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
  toggle.id = 'biToggle'; toggle.type = 'button'; toggle.textContent = 'Event Manager';
  document.body.appendChild(toggle);
  const panel = document.createElement('div');
  panel.id = 'biPanel'; panel.hidden = true;
  panel.innerHTML = [
    '<div class="biHeader"><div><h3>Event Manager</h3><div class="biSmall">Place, review and publish DayZ events.</div></div><button type="button" id="biClose" title="Close" aria-label="Close Event Manager">×</button></div>',
    '<section class="biSection"><div class="biSectionTitle"><span class="biStep">01</span><h4>Configure spawn</h4></div>',
    '<div class="biPickRow"><button type="button" id="biPick">Pick location on map</button><span id="biPoint" class="biPoint">No location selected</span></div>',
    '<label for="biName">Event name</label><input id="biName" value="BuildIt_Event1" maxlength="90" spellcheck="false">',
    '<div class="biRow"><div><label for="biKind">Event type</label><select id="biKind"><option value="vehicle">Vehicles / motorbikes / boats</option><option value="loot">Loot items (.json)</option></select></div>',
    '<div><label for="biAngle">Rotation (°)</label><input id="biAngle" type="number" min="0" max="359.99" step="0.01" value="0"></div></div>',
    '<div id="biVehicleSection"><label for="biVehicleSearch">Vehicle classname</label><input id="biVehicleSearch" type="search" autocomplete="off" placeholder="Search car, Humvee, bike or boat…"><div id="biVehicleMatches" class="biMatches"></div>',
    '<p class="biSmall">Vehicle parts use your existing cfgspawnabletypes.xml rules.</p></div>',
    '<div id="biLootSection" hidden><label for="biLootY">Terrain height Y (metres)</label><input id="biLootY" type="number" min="-100" max="1000" step="0.01" placeholder="Enter ground elevation">',
    '<label for="biItemSearch">Item classname</label><input id="biItemSearch" type="search" autocomplete="off" placeholder="Search items…"><div id="biItemMatches" class="biMatches"></div>',
    '<div id="biItems"></div><label for="biLootSpacing">Item spacing (metres)</label><input id="biLootSpacing" type="number" min="0.5" max="10" step="0.5" value="1.5">',
    '<div class="biSmall">Items spawn as separate objects around the selected location. Enter the real terrain height (Y); map selection supplies X and Z only. Loot left behind does not persist; taken loot follows normal CE rules.</div>',
    '</div>',
    '<div class="biRow biActions"><button type="button" id="biSave" class="biPrimary">Save spawn</button><button type="button" id="biNew" class="biQuiet">Clear</button></div>',
    '<div id="biStatus" role="status" aria-live="polite"></div></section>',
    '<section class="biSection"><div class="biSectionTitle"><span class="biStep">02</span><h4>Queued events</h4><span id="biDraftCount" class="biSmall biDraftCount">0 saved</span></div>',
    '<div id="biDrafts"></div></section>',
    '<section class="biSection biPublish"><div class="biSectionTitle"><span class="biStep">03</span><h4>Publish to Nitrado</h4></div>',
    '<p class="biSmall">Review automatically loads fresh events.xml and cfgeventspawns.xml. Original lines and comments remain untouched.</p>',
    '<button type="button" id="biPreviewServer" class="biPrimary biFull">Review &amp; prepare changes</button>',
    '<div id="biServerPreview" class="biMessage" role="status" aria-live="polite">Vehicle events publish as XML. Use the JSON loot tools below for loose items.</div>',
    '<label class="biConfirm" id="biRepairConfirm" hidden><input type="checkbox" id="biRepairAcknowledge"> I approve removing the duplicate XML declarations detected in the server files.</label>',
    '<label class="biConfirm"><input type="checkbox" id="biServerStopped"> My DayZ server is stopped and I have reviewed the changes.</label>',
    '<button type="button" id="biUploadServer" class="biPrimary biFull" disabled>Back up &amp; upload</button>',
    '<p class="biSmall">An upload requires your file-write key. Existing files are checked and backed up before replacement.</p></section>',
    '<section class="biSection" id="biJsonLootPublish"><div class="biSectionTitle"><h4>JSON loot spawner</h4></div>',
    '<p class="biSmall">Non-persistent loot, generated with the vanilla DayZ Object Spawner. After each restart the locations are populated again.</p>',
    '<button type="button" id="biExportLootJson" class="biPrimary biFull">Download loot JSON</button>',
    '<button type="button" id="biExportGameplayJson" class="biFull">Download updated cfggameplay.json</button>',
    '<button type="button" id="biPrepareLoot" class="biFull">Review live loot JSON upload</button>',
    '<div id="biLootReview" class="biMessage" role="status" aria-live="polite">Review your loot before publishing. New JSON files require the Worker create-file endpoint.</div>',
    '<label class="biConfirm"><input type="checkbox" id="biLootServerStopped"> My server is stopped and I reviewed the JSON.</label>',
    '<button type="button" id="biDeployLoot" class="biPrimary biFull" disabled>Back up &amp; upload loot JSON</button>',
    '<p class="biSmall">Use Review live loot JSON upload to publish both files through Nitrado once the Worker create-file handler is active. Manual download remains available. Existing cfgGameplay settings are preserved; ensure cfgGameplay is enabled before restarting.</p></section>',
    '<details class="biAdvanced" id="biAdvanced"><summary>Advanced · Manual XML / JSON tools</summary>',
    '<button type="button" id="biLoadServer" class="biFull">Reload live server XML</button>',
    '<div class="biSmall" id="biCatalog">Loading official classnames…</div>',
    '<label for="biFiles">Import XML or existing cfggameplay.json</label><input id="biFiles" type="file" accept=".xml,.json" multiple>',
    '<div id="biImportStatus" class="biSmall">Optional: import existing XML for offline export.</div>',
    '<div class="biRow"><button type="button" id="biExportEvents">events.xml</button><button type="button" id="biExportPositions">cfgeventspawns.xml</button></div>',
    '<p class="biSmall">XML exports are for vehicle events. Loot is handled through JSON above.</p>',
    '<div class="biWarn">Offline exports without original XML contain additions only. Never upload them as full replacements.</div>',
    '</details>'
  ].join('');
  document.body.appendChild(panel);
  const message = (s, error) => { $('biStatus').textContent = s; $('biStatus').style.color = error ? '#ffb2a2' : '#a8d6e4'; };
  toggle.textContent='Quick Spawn';
  toggle.addEventListener('click', () => {
    if(window.BUILD_IT_QUICK_SPAWN?.toggle){window.BUILD_IT_QUICK_SPAWN.toggle();return;}
    panel.hidden = !panel.hidden; if (!panel.hidden) refresh();
  });
  $('biClose').addEventListener('click', () => { panel.hidden = true; placing = false; $('biPick').textContent = 'Pick on map'; });
  $('biPick').addEventListener('click', () => {
    placing = !placing;
    $('biPick').textContent = placing ? 'Click a map location…' : 'Pick on map';
    message(placing ? 'Click your preferred location on the map.' : 'Map selection cancelled.');
  });
  map.on('click', e => {
    if (!placing) return;
    const p = leafletToGame(e.latlng);
    if (!numbers(p.x, 0, 15360) || !numbers(p.z, 0, 15360)) return message('This location is outside Chernarus.', true);
    chosen = {x:Number(p.x.toFixed(2)), z:Number(p.z.toFixed(2))};
    placing = false; $('biPick').textContent = 'Pick on map';
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
  const ECONOMY_MISSIONS=['dayzOffline.chernarusplus','dayzOffline.enoch','dayzOffline.sakhal'];
  Promise.allSettled([
    fetch(BASE + 'db/types.xml').then(r => { if (!r.ok) throw new Error('types.xml HTTP ' + r.status); return r.text(); }).then(s => addCatalog(parseXML(s, 'types'),'types')),
    ...ECONOMY_MISSIONS.map(mission=>fetch('https://raw.githubusercontent.com/BohemiaInteractive/DayZ-Central-Economy/master/'+mission+'/db/events.xml').then(r=>{if(!r.ok)throw new Error(mission+' events.xml HTTP '+r.status);return r.text();}).then(s=>addCatalog(parseXML(s,'events'),'events')))
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
    if(term.length<2 && (kind!=='vehicle'||term.length!==0)){target.hidden=true;return;}
    target.hidden=false;
    const set = kind === 'vehicle' ? vehicleNames : itemNames;
    const matches = [...set].filter(n => n.toLowerCase().includes(term) || (kind==='vehicle' && String(VEHICLE_LABELS[n]||'').toLowerCase().includes(term))).sort((a,b) => a.localeCompare(b)).slice(0,80);
    if (!matches.length) { target.textContent = 'No matching classnames found.'; return; }
    matches.forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = kind==='vehicle' && VEHICLE_LABELS[name] ? VEHICLE_LABELS[name]+' · '+name : name;
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
  $('biVehicleSearch').addEventListener('focus', () => updateChoices('vehicle'));
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
    $('biLootY').value = d.y ?? '';
    $('biLootSpacing').value = d.spacing ?? 1.5;
    itemList = (d.items || []).map(i => ({name:i.name,qty:i.qty})); renderItems();
    $('biSave').textContent = 'Save changes';
    panel.hidden = false;
  }
  function resetForm() {
    editingIndex = -1; chosen = null; itemList = []; renderItems();
    $('biLootY').value=''; $('biLootSpacing').value='1.5';
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
      if ($('biLootY').value.trim()==='' || !numbers($('biLootY').value,-100,1000)) return message('Enter the actual terrain elevation Y (-100 to 1000 metres).', true);
      if (!numbers($('biLootSpacing').value,0.5,10)) return message('Spacing must be between 0.5 and 10 metres.',true);
      entry.y=Number($('biLootY').value); entry.spacing=Number($('biLootSpacing').value);
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
      details.textContent=(d.kind==='vehicle'?d.vehicle:('JSON loot · '+(d.items||[]).reduce((n,i)=>n+Number(i.qty||0),0)+' items · Y '+(d.y??'missing')))+
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
      if (!type && name!=='cfggameplay.json') { message('Unrecognized file skipped: ' + file.name, true); continue; }
      try {
        const content = await file.text();
        if(name==='cfggameplay.json'){
          window.BUILD_IT_LOOT.gameplay(content);
          files[name]=content;
        } else {
          const doc = parseXML(content,type);
          files[name]=content;
          if(name==='types.xml')addCatalog(doc,'types');
          if(name==='events.xml')addCatalog(doc,'events');
          if(name==='cfgspawnabletypes.xml')addCatalog(doc,'spawnables');
        }
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
    if (!drafts.some(d=>d.kind==='vehicle')) throw new Error('Create a vehicle event first.');
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
        const elements=drafts.filter(d=>d.kind==='vehicle').map(d=>kind==='events'?createEvent(doc,d):createPos(doc,d));
        const xml=appendXmlEventsWithoutReformatting(original,root,elements);
        return {filename,xml,complete:true};
      }
      drafts.filter(d=>d.kind==='vehicle').forEach(d=>{
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
      name:d.name,kind:d.kind,x:d.x,z:d.z,a:d.a,vehicle:d.vehicle,y:d.y,spacing:d.spacing,items:d.items
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
    const selected=drafts.filter(d=>d.kind==='vehicle');
    if(!selected.length)throw new Error('No vehicle events queued. Use JSON loot export below.');
    return selected;
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
      // Validate BOTH generated files before enabling a single upload.
      // Incorrect XML, a duplicate declaration or the wrong root must block.
      const eventFormat=window.BUILD_IT_FORMAT.validate(eventDeploy.paths['events.xml'],events.xml,{expectedRoot:'events'});
      const positionFormat=window.BUILD_IT_FORMAT.validate(eventDeploy.paths['cfgeventspawns.xml'],positions.xml,{expectedRoot:'eventposdef'});
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
        '\n\nFORMAT VALIDATED:\n'+
        'db/events.xml — '+eventFormat.detail+'\n'+
        'cfgeventspawns.xml — '+positionFormat.detail+
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
    if(!window.confirm('Upload '+vehicleDrafts().length+' vehicle event(s) to your LIVE server?\n'+
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
      // Validate the full two-file transaction BEFORE starting either write.
      // This prevents uploading events.xml successfully and only then
      // discovering that cfgeventspawns.xml has invalid XML.
      for(const name of changes){
        const expectedRoot=name==='events.xml'?'events':'eventposdef';
        window.BUILD_IT_FORMAT.validate(eventDeploy.paths[name],staged.xml[name],{expectedRoot});
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
      const deployed=vehicleDrafts().length;
      // These were queued changes, not permanent user records. Only clear them
      // after both files have been verified on the server. This avoids trying
      // to publish identical event names on the next upload.
      drafts=drafts.filter(d=>d.kind!=='vehicle');persist();resetForm();
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
  $('biExportLootJson').addEventListener('click',()=>{
    try {
      const result=window.BUILD_IT_LOOT.build(drafts);
      window.BUILD_IT_LOOT.download(result.filename,result.content);
      message('Downloaded '+result.filename+' with '+result.count+' non-persistent items from '+result.events+' location(s). Place it in the mission custom folder, and register '+window.BUILD_IT_LOOT.SPAWNER_REF+' in cfggameplay.json.');
    }catch(error){message('JSON loot export failed: '+error.message,true);}
  });
  $('biExportGameplayJson').addEventListener('click',async()=>{
    const btn=$('biExportGameplayJson');btn.disabled=true;
    try {
      window.BUILD_IT_LOOT.build(drafts);
      let original=files['cfggameplay.json'];
      if(!original){
        const mission=await discoverServerMission();
        const loaded=await serverXmlRead(mission+'/cfggameplay.json');
        original=loaded.content;
        files['cfggameplay.json']=original;
      }
      const updated=window.BUILD_IT_LOOT.gameplay(original);
      window.BUILD_IT_LOOT.download('cfggameplay.json',updated);
      message('Updated cfggameplay.json downloaded. Existing settings and spawner entries preserved. Put '+window.BUILD_IT_LOOT.FILENAME+' in the mission custom folder, upload cfggameplay.json to the mission root, enable cfgGameplay and restart.');
    }catch(error){
      message('Could not prepare cfggameplay.json: '+error.message+'. If Nitrado access is unavailable, import your existing cfggameplay.json from Advanced.',true);
    }finally{btn.disabled=false;}
  });
  // Supports new JSON files via a dedicated, authenticated /api/files/create endpoint.
  // The endpoint must be deployed in the existing Cloudflare Worker first.
  let lootStaged=null,lootBusy=false;
  const lootMessage=(value,error=false)=>{
    const element=$('biLootReview');element.textContent=value;
    element.style.color=error?'#ffafaf':'';
  };
  const lootSnapshot=()=>JSON.stringify(drafts.filter(d=>d.kind==='loot'));
  const lootButton=$('biDeployLoot');
  async function lootFileExists(mission,filename){
    const root=await nitradoRequest('/api/files/list?dir='+encodeURIComponent(mission));
    if(root?.dir!==mission||!Array.isArray(root.entries)||root.entries.length>=500)
      throw new Error('Mission folder could not be checked reliably; refusing to create a loot file.');
    const custom=root.entries.find(entry=>String(entry.name||'').toLowerCase()==='custom');
    if(!custom)return false;
    if(!['dir','directory','folder'].includes(String(custom.type||'').toLowerCase()))
      throw new Error('Mission custom path exists but is not a folder.');
    const folder=mission+'/custom';
    const listed=await nitradoRequest('/api/files/list?dir='+encodeURIComponent(folder));
    if(listed?.dir!==folder||!Array.isArray(listed.entries)||listed.entries.length>=500)
      throw new Error('Custom folder cannot be listed reliably; refusing to create a loot file.');
    return listed.entries.some(entry=>String(entry.name||'').toLowerCase()===filename.toLowerCase());
  }
  $('biPrepareLoot').addEventListener('click',async()=>{
    if(lootBusy||eventDeploy.sending||eventDeploy.loading)return;
    lootBusy=true;lootStaged=null;lootButton.disabled=true;
    const btn=$('biPrepareLoot');btn.disabled=true;
    try{
      const pending=window.BUILD_IT_LOOT.build(drafts);
      lootMessage('Reading the existing mission loot JSON and cfggameplay.json…');
      const mission=await discoverServerMission();
      const lootPath=mission+'/'+window.BUILD_IT_LOOT.SPAWNER_REF;
      const gameplayPath=mission+'/cfggameplay.json';
      // The DayZ console Object Spawner loads files from custom/ in the mission directory.
      // Detect the folder first; a fresh installation may not have custom/ yet.
      const exists=await lootFileExists(mission,pending.filename);
      const current=exists?await serverXmlRead(lootPath):null;
      const gameplayLive=await serverXmlRead(gameplayPath);
      const original=current?JSON.parse(current.content):{Objects:[]};
      if(!original||typeof original!=='object'||Array.isArray(original)||!Array.isArray(original.Objects))
        throw new Error(pending.filename+' is not a valid DayZ Object Spawner file.');
      // Never silently replace or delete existing configured loot.
      const merged=JSON.stringify({...original,Objects:[...original.Objects,...JSON.parse(pending.content).Objects]},null,2)+'\n';
      window.BUILD_IT_FORMAT.validate(lootPath,merged);
      const gameplay=window.BUILD_IT_LOOT.gameplay(gameplayLive.content);
      window.BUILD_IT_FORMAT.validate(gameplayPath,gameplay);
      const oldSpawners=JSON.parse(gameplayLive.content).WorldsData?.objectSpawnersArr||[];
      const newSpawners=JSON.parse(gameplay).WorldsData.objectSpawnersArr;
      const needsGameplay=JSON.stringify(oldSpawners)!==JSON.stringify(newSpawners);
      lootStaged={
        snapshot:lootSnapshot(),pending,
        paths:{loot:lootPath,gameplay:gameplayPath},
        input:{loot:current?.sha256||null,gameplay:gameplayLive.sha256},
        output:{loot:merged,gameplay},
        needsCreate:!exists,needsGameplay
      };
      lootMessage('READY — '+pending.count+' new non-persistent loot items at '+pending.events+
        ' locations. Existing JSON Objects retained ('+original.Objects.length+').\n'+
        pending.filename+': validated '+window.BUILD_IT_FORMAT.validate(lootPath,merged).bytes+' bytes.\n'+
        (needsGameplay?'cfggameplay.json: registered spawner file, existing settings preserved.\n':
          'cfggameplay.json: spawner is already registered; no update required.\n')+
        (exists?'Nitrado will back up the existing loot file before replacing it.':
          'New loot JSON: the Worker must support the secure /api/files/create endpoint.')+
        (needsGameplay?' Gameplay JSON will be backed up before it is updated.':''));
      lootButton.disabled=false;
    }catch(error){lootMessage('Review failed: '+error.message,true);}
    finally{lootBusy=false;btn.disabled=false;}
  });
  lootButton.addEventListener('click',async()=>{
    if(lootBusy||!lootStaged)return;
    if(lootStaged.snapshot!==lootSnapshot()){
      lootStaged=null;lootButton.disabled=true;
      lootMessage('Loot drafts changed since review. Please review again.',true);return;
    }
    if(!$('biLootServerStopped').checked){
      lootMessage('Stop the server and confirm that you reviewed the JSON.',true);return;
    }
    if(!window.confirm('Publish '+lootStaged.pending.count+' loot items to your LIVE Nitrado server?\n'+
      'New JSON files are created once; existing files are backed up before overwriting. Continue?'))return;
    lootBusy=true;lootButton.disabled=true;$('biPrepareLoot').disabled=true;
    const staged=lootStaged;
    const names=staged.needsGameplay?['loot','gameplay']:['loot'];
    const uploaded=[];
    try{
      // Both source files are checked before the first write, even when gameplay
      // does not need changing, to prevent an obsolete configuration preview.
      for(const name of ['loot','gameplay']){
        if(name==='loot'&&staged.needsCreate){
          const mission=staged.paths.loot.split('/custom/')[0];
          if(await lootFileExists(mission,staged.pending.filename))
            throw new Error('The loot file was created by another process. Review again to avoid overwriting it.');
          continue;
        }
        const latest=await serverXmlRead(staged.paths[name]);
        if(latest.sha256!==staged.input[name])
          throw new Error(staged.paths[name].split('/').pop()+' changed after review. No files were uploaded. Review again.');
      }
      for(const name of names)
        window.BUILD_IT_FORMAT.validate(staged.paths[name],staged.output[name]);
      for(const name of names){
        const creating=name==='loot'&&staged.needsCreate;
        lootMessage((creating?'Creating and verifying ':'Backing up and uploading ')+staged.paths[name].split('/').pop()+'…');
        let result;
        try{
          result=await nitradoRequest(creating?'/api/files/create':'/api/files/write',{
            method:'POST',writeKey:true,
            body:creating?
              {path:staged.paths[name],content:staged.output[name],expectedAbsent:true,confirm:true}:
              {path:staged.paths[name],content:staged.output[name],expectedSha256:staged.input[name],confirm:true}
          });
        }catch(error){
          if(creating)throw new Error('The Cloudflare Worker could not create the loot file. Deploy its secure /api/files/create handler first. '+error.message);
          throw error;
        }
        if(!result?.verified||(creating?!result.created:!result.backupPath))
          throw new Error('Server verification failed for '+name+'.');
        uploaded.push({name,backup:result.backupPath||null,created:creating});
      }
      const count=staged.pending.count;
      drafts=drafts.filter(d=>d.kind!=='loot');persist();resetForm();
      lootMessage('UPLOAD VERIFIED — '+count+' JSON loot items saved.\n'+
        uploaded.map(r=>staged.paths[r.name].split('/').pop()+
          (r.created?' created':(' backup: '+r.backup))).join('\n')+
        '\nStart the server to spawn these items.');
      lootStaged=null;
      $('biLootServerStopped').checked=false;
    }catch(error){
      lootMessage('UPLOAD FAILED: '+error.message+'\n'+
        (uploaded.length?'Uploaded before failure: '+uploaded.map(r=>r.name+(r.created?' (new file)':' (backup '+r.backup+')')).join(', ')+
          '. Restore updated files from their backups; review newly created files before retrying.':
          'No upload was verified. Confirm the MAP_WRITE_KEY and server file permissions.')+
        '\nNo automatic rollback was attempted.',true);
      lootStaged=null;
    }finally{lootBusy=false;$('biPrepareLoot').disabled=false;}
  });

  // Quick Spawn: one confirmed publish, no manual XML/JSON files or draft queue.
  // Reuses the audited reader, append-only event formatter, checksum writes,
  // Nitrado backups and dedicated JSON creator. No server restart is triggered.
  let quickBusy=false;
  function quickSelection(kind,value){
    const set=kind==='vehicle'?vehicleNames:itemNames;
    return set.has(value);
  }
  function quickCoordinates(input){
    if(!input||!numbers(input.x,0,15360)||!numbers(input.z,0,15360))
      throw new Error('Select a valid Chernarus position on the map.');
    return {x:Number(Number(input.x).toFixed(2)),z:Number(Number(input.z).toFixed(2))};
  }
  async function quickPublish(kind,input,onProgress=()=>{}){
    if(quickBusy||eventDeploy.sending||eventDeploy.loading||lootBusy)
      throw new Error('Another server operation is in progress. Try again after it completes.');
    if(kind!=='vehicle'&&kind!=='loot')throw new Error('Select a vehicle or loot drop.');
    const coords=quickCoordinates(input),classname=String(input.classname||'').trim();
    if(!quickSelection(kind,classname))
      throw new Error('Select a real '+(kind==='vehicle'?'vehicle':'item')+' classname from the catalog.');
    quickBusy=true;
    const completed=[];
    let changedPaths=[];
    const update=message=>{if(typeof onProgress==='function')onProgress(message);};
    try{
      update('Finding the active Chernarus mission…');
      const mission=await discoverServerMission();
      if(kind==='vehicle'){
        const name='BuildItQuick_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
        const angle=Number(input.angle??0);
        if(!numbers(angle,0,359.99))throw new Error('Rotation must be 0–359.99 degrees.');
        const draft={name,kind:'vehicle',vehicle:classname,...coords,a:angle};
        const paths={events:mission+'/db/events.xml',positions:mission+'/cfgeventspawns.xml'};
        changedPaths=[paths.events,paths.positions];
        update('Reading live vehicle spawn files…');
        const [events,positions]=await Promise.all([serverXmlRead(paths.events),serverXmlRead(paths.positions)]);
        const eventClean=window.BUILD_IT_XML.repairDuplicateDeclarations(events.content,'events');
        const positionClean=window.BUILD_IT_XML.repairDuplicateDeclarations(positions.content,'eventposdef');
        if(eventClean.removed||positionClean.removed)
          throw new Error('Server XML has duplicate declarations. Repair them first through the advanced editor; Quick Spawn will not silently change existing lines.');
        const eventDoc=parseXML(events.content,'events');
        const positionDoc=parseXML(positions.content,'eventposdef');
        const changes=[
          {path:paths.events,previous:events.sha256,content:appendXmlEventsWithoutReformatting(events.content,'events',[createEvent(eventDoc,draft)]),root:'events'},
          {path:paths.positions,previous:positions.sha256,content:appendXmlEventsWithoutReformatting(positions.content,'eventposdef',[createPos(positionDoc,draft)]),root:'eventposdef'}
        ];
        for(const file of changes)
          window.BUILD_IT_FORMAT.validate(file.path,file.content,{expectedRoot:file.root});
        update('Validating files and checking Nitrado versions…');
        for(const file of changes){
          const latest=await serverXmlRead(file.path);
          if(latest.sha256!==file.previous)
            throw new Error(file.path.split('/').pop()+' changed during preparation. No files modified.');
        }
        // Write positions first: if the second write fails, an unreferenced
        // position is less dangerous than an active event without its position.
        for(const file of [changes[1],changes[0]]){
          update('Backing up and publishing '+file.path.split('/').pop()+'…');
          const saved=await nitradoRequest('/api/files/write',{
            method:'POST',writeKey:true,
            body:{path:file.path,content:file.content,expectedSha256:file.previous,confirm:true}
          });
          if(!saved?.verified||!saved?.backupPath)
            throw new Error('Upload verification failed for '+file.path.split('/').pop());
          completed.push({path:file.path,backup:saved.backupPath});
        }
        return {kind,classname,name,files:completed.map(x=>x.path),pendingRestart:true};
      }
      const elevation=Number(input.y);
      if(input.y===null||input.y===undefined||input.y===''||!numbers(elevation,-100,1000))
        throw new Error('Enter the real ground elevation Y for this loot drop.');
      const qty=Number(input.quantity??1);
      if(!Number.isInteger(qty)||qty<1||qty>20)
        throw new Error('Quantity must be a whole number between 1 and 20.');
      const pending=window.BUILD_IT_LOOT.build([{
        name:'QuickLoot',kind:'loot',...coords,y:elevation,a:0,
        spacing:1.5,items:[{name:classname,qty}]
      }]);
      const lootPath=mission+'/'+window.BUILD_IT_LOOT.SPAWNER_REF;
      const gameplayPath=mission+'/cfggameplay.json';
      changedPaths=[lootPath,gameplayPath];
      update('Checking existing loot and cfgGameplay…');
      const exists=await lootFileExists(mission,pending.filename);
      const [current,gameplayLive]=await Promise.all([
        exists?serverXmlRead(lootPath):Promise.resolve(null),
        serverXmlRead(gameplayPath)
      ]);
      const existing=current?JSON.parse(current.content):{Objects:[]};
      if(!existing||Array.isArray(existing)||!Array.isArray(existing.Objects))
        throw new Error('Current loot JSON does not contain a valid Objects array.');
      const merged=JSON.stringify({...existing,Objects:[
        ...existing.Objects,...JSON.parse(pending.content).Objects
      ]},null,2)+'\\n';
      const gameplay=window.BUILD_IT_LOOT.gameplay(gameplayLive.content);
      window.BUILD_IT_FORMAT.validate(lootPath,merged);
      window.BUILD_IT_FORMAT.validate(gameplayPath,gameplay);
      const oldRefs=JSON.parse(gameplayLive.content).WorldsData?.objectSpawnersArr||[];
      const newRefs=JSON.parse(gameplay).WorldsData.objectSpawnersArr;
      const updateGameplay=JSON.stringify(oldRefs)!==JSON.stringify(newRefs);
      update('Checking Nitrado versions before upload…');
      if(exists){
        const recent=await serverXmlRead(lootPath);
        if(recent.sha256!==current.sha256)throw new Error('Loot file changed. No files modified.');
      }else if(await lootFileExists(mission,pending.filename)){
        throw new Error('Loot file appeared during preparation. No files modified.');
      }
      const gameplayRecent=await serverXmlRead(gameplayPath);
      if(gameplayRecent.sha256!==gameplayLive.sha256)
        throw new Error('Gameplay file changed. No files modified.');
      // First create the loot file, then register it in cfggameplay.json.
      update('Publishing loot JSON…');
      const saved=await nitradoRequest(exists?'/api/files/write':'/api/files/create',{
        method:'POST',writeKey:true,
        body:exists?
          {path:lootPath,content:merged,expectedSha256:current.sha256,confirm:true}:
          {path:lootPath,content:merged,expectedAbsent:true,confirm:true}
      });
      if(!saved?.verified||(exists?!saved.backupPath:!saved.created))
        throw new Error('Loot file creation/upload could not be verified.');
      completed.push({path:lootPath,backup:saved.backupPath||null,created:!exists});
      if(updateGameplay){
        update('Backing up and updating cfgGameplay reference…');
        const changed=await nitradoRequest('/api/files/write',{
          method:'POST',writeKey:true,
          body:{path:gameplayPath,content:gameplay,expectedSha256:gameplayLive.sha256,confirm:true}
        });
        if(!changed?.verified||!changed?.backupPath)
          throw new Error('cfgGameplay upload could not be verified.');
        completed.push({path:gameplayPath,backup:changed.backupPath});
      }
      return {kind,classname,quantity:qty,files:completed.map(x=>x.path),pendingRestart:true};
    }catch(error){
      const detail=completed.length?
        ' Partial upload: '+completed.map(f=>f.path.split('/').pop()+
          (f.backup?' (backup: '+f.backup+')':' (new file)')).join(', ')+
          '. Inspect and restore incomplete changes in Nitrado before retrying.':'';
      throw new Error(error.message+detail);
    }finally{quickBusy=false;}
  }
  window.BUILD_IT_SPAWN_API=Object.freeze({
    vehicles:()=>[...vehicleNames].sort((a,b)=>String(VEHICLE_LABELS[a]||a).localeCompare(String(VEHICLE_LABELS[b]||b))).map(name=>({name,label:VEHICLE_LABELS[name]||name})),
    items:()=>[...itemNames].sort((a,b)=>a.localeCompare(b)),
    publish:quickPublish,
    advanced:()=>{panel.hidden=false;refresh();}
  });

  [['biExportEvents','events'],['biExportPositions','positions']].forEach(pair => {
    $(pair[0]).addEventListener('click', () => {
      try {
        const result=buildOutput(pair[1]); downloadXML(result);
        message(result.filename + ' downloaded. ' + (result.complete ? 'Merged with the imported source file. Back up and validate the XML before uploading.' : 'WARNING: additions only. Do not upload this file as a direct replacement.'));
      } catch(err) { message(err.message,true); }
    });
  });
})();
