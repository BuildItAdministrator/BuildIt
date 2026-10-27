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
    '<div class="biSmall">Selecteer een locatie op de kaart en stel een vehicle of lootdrop samen. Concepten blijven lokaal in deze browser.</div>',
    '<div class="biRow"><button type="button" id="biPick">📍 Kies op kaart</button><span id="biPoint" class="biPoint">Nog geen locatie</span></div>',
    '<label for="biName">Unieke eventnaam</label><input id="biName" value="BuildIt_Event1" maxlength="90">',
    '<div class="biRow"><div><label for="biKind">Type</label><select id="biKind"><option value="vehicle">Voertuig / motor</option><option value="loot">Lootdrop in container</option></select></div>',
    '<div><label for="biAngle">Rotatie (°)</label><input id="biAngle" type="number" min="0" max="359.99" step="0.01" value="0"></div></div>',
    '<div id="biVehicleSection"><label for="biVehicleSearch">Voertuig zoeken (naam of classname)</label><input id="biVehicleSearch" type="search" autocomplete="off" placeholder="Motorbike, Sedan, Truck ..."><div id="biVehicleMatches" class="biMatches"></div>',
    '<p class="biSmall">Onderdelen en hun spawnkans blijven bepaald door je bestaande cfgspawnabletypes.xml.</p></div>',
    '<div id="biLootSection" hidden><label for="biContainer">Container</label><select id="biContainer"><option>SeaChest</option><option>WoodenCrate</option><option>SmallProtectorCase</option><option>Barrel_Green</option><option>Barrel_Blue</option></select>',
    '<label for="biItemSearch">Item zoeken (alle classnames uit types.xml)</label><input id="biItemSearch" type="search" autocomplete="off" placeholder="M4, Bandage, Nail ..."><div id="biItemMatches" class="biMatches"></div>',
    '<div id="biItems"></div>',
    '<div class="biWarn">LET OP: cfgspawnabletypes.xml bepaalt de inhoud per containertype, NIET per event of locatie. Als je deze loot exporteert, kan iedere container met dezelfde classname op de server die inhoud krijgen. Gebruik hiervoor alleen een daarvoor gereserveerd containertype.</div>',
    '<label style="font-weight:400"><input type="checkbox" id="biAcknowledge"> Ik begrijp dat de containerinhoud wereldwijd geldt voor deze classname.</label></div>',
    '<div class="biRow" style="margin-top:12px"><button type="button" id="biSave">Concept opslaan</button><button type="button" id="biNew">Nieuw</button></div>',
    '<div class="biDivider"></div><h4>Opgeslagen events</h4><div id="biDrafts"></div>',
    '<div class="biDivider"></div><h4>Catalogus &amp; Nitrado-bestanden</h4>',
    '<div id="biCatalog" class="biSmall">Officiële classnames laden ...</div>',
    '<label for="biFiles">Importeer je bestaande XML-bestanden (aanbevolen)</label>',
    '<input id="biFiles" type="file" accept=".xml" multiple>',
    '<div class="biSmall">Kies db/events.xml, cfgeventspawns.xml, cfgspawnabletypes.xml en eventueel db/types.xml. Bestaande inhoud wordt behouden bij export; bestanden verlaten je browser niet.</div>',
    '<div id="biImportStatus" class="biSmall">Nog geen serverbestanden geïmporteerd.</div>',
    '<div class="biRow" style="margin-top:10px"><button type="button" id="biExportEvents">events.xml</button><button type="button" id="biExportPositions">cfgeventspawns.xml</button></div>',
    '<button type="button" id="biExportCargo" style="width:100%;margin-top:7px">cfgspawnabletypes.xml (loot)</button>',
    '<div class="biWarn" style="margin-top:8px">Zonder geïmporteerd bronbestand exporteert de editor alleen een toevoegingenbestand, GEEN volledige vervanging voor je Nitrado-configuratie. Upload die toevoegingen nooit als vervanging. Eerst controleren en back-uppen; wijzigingen vereisen doorgaans een serverherstart.</div>',
    '<div id="biStatus" role="status" aria-live="polite"></div>'
  ].join('');
  document.body.appendChild(panel);
  const message = (s, error) => { $('biStatus').textContent = s; $('biStatus').style.color = error ? '#ffb2a2' : '#a8d6e4'; };
  toggle.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) refresh(); });
  $('biClose').addEventListener('click', () => { panel.hidden = true; placing = false; $('biPick').textContent = '📍 Kies op kaart'; });
  $('biPick').addEventListener('click', () => {
    placing = !placing;
    $('biPick').textContent = placing ? 'Kaartklik actief…' : '📍 Kies op kaart';
    message(placing ? 'Klik nu op de gewenste plek op de kaart.' : 'Kaartselectie beëindigd.');
  });
  map.on('click', e => {
    if (!placing) return;
    const p = leafletToGame(e.latlng);
    if (!numbers(p.x, 0, 15360) || !numbers(p.z, 0, 15360)) return message('Dit punt valt buiten Chernarus.', true);
    chosen = {x:Number(p.x.toFixed(2)), z:Number(p.z.toFixed(2))};
    placing = false; $('biPick').textContent = '📍 Kies op kaart';
    $('biPoint').textContent = chosen.x + ' / ' + chosen.z;
    panel.hidden = false;
    message('Locatie geselecteerd. Kies een event en sla het concept op.');
  });
  function parseXML(text, root) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror') || !doc.documentElement || doc.documentElement.nodeName !== root) throw new Error('Ongeldige XML: verwacht <' + root + '>.');
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
    $('biCatalog').textContent = itemNames.size + ' items, ' + vehicleNames.size + ' voertuigen. Officiële lijst + eventuele geïmporteerde serverclassnames.';
  }
  Promise.allSettled([
    fetch(BASE + 'db/types.xml').then(r => { if (!r.ok) throw new Error('types.xml HTTP ' + r.status); return r.text(); }).then(s => addCatalog(parseXML(s, 'types'),'types')),
    fetch(BASE + 'db/events.xml').then(r => { if (!r.ok) throw new Error('events.xml HTTP ' + r.status); return r.text(); }).then(s => addCatalog(parseXML(s, 'events'),'events'))
  ]).then(results => {
    catalogStatus();
    if (results.some(r => r.status === 'rejected')) message('Sommige officiële catalogi zijn niet geladen. Je kunt de XML-bestanden handmatig importeren.', true);
    updateChoices('vehicle'); updateChoices('item');
  });
  function updateChoices(kind) {
    const input = $(kind === 'vehicle' ? 'biVehicleSearch' : 'biItemSearch');
    const target = $(kind === 'vehicle' ? 'biVehicleMatches' : 'biItemMatches');
    const term = input.value.toLowerCase().trim();
    const set = kind === 'vehicle' ? vehicleNames : itemNames;
    const matches = [...set].filter(n => !term || n.toLowerCase().includes(term)).sort((a,b) => a.localeCompare(b)).slice(0,25);
    target.replaceChildren();
    if (!matches.length) { target.textContent = 'Geen classnames gevonden.'; return; }
    matches.forEach(name => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = name;
      btn.addEventListener('click', () => {
        if (kind === 'vehicle') { input.value = name; message('Voertuig gekozen: ' + name); }
        else {
          if (itemList.length >= 40) return message('Maximaal 40 itemregels per lootdrop.', true);
          const found = itemList.find(x => x.name === name);
          if (found) found.qty = Math.min(found.qty+1, 20);
          else itemList.push({name,qty:1});
          input.value = ''; renderItems(); message(name + ' toegevoegd.');
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
    catch (e) { message('Opslaan in browser mislukt; controleer opslagruimte en privacy-instellingen.', true); }
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
    $('biSave').textContent = 'Wijzigingen opslaan';
    panel.hidden = false;
  }
  function resetForm() {
    editingIndex = -1; chosen = null; itemList = []; renderItems(); $('biAcknowledge').checked = false;
    $('biPoint').textContent = 'Nog geen locatie';
    $('biName').value = 'BuildIt_Event' + (drafts.length + 1);
    $('biKind').value = 'vehicle'; $('biKind').dispatchEvent(new Event('change'));
    $('biAngle').value = '0'; $('biVehicleSearch').value = '';
    $('biSave').textContent = 'Concept opslaan';
  }
  $('biNew').addEventListener('click', () => { resetForm(); message('Nieuw event. Kies op de kaart een locatie.'); });
  $('biSave').addEventListener('click', () => {
    const name = $('biName').value.trim(), kind = $('biKind').value;
    const a = Number($('biAngle').value);
    if (!valid(name)) return message('Eventnaam: uitsluitend letters, cijfers en underscores (maximaal 90).', true);
    if (!chosen) return message('Selecteer eerst een locatie met de kaartknop.', true);
    if (!numbers(a,0,359.99)) return message('Rotatie moet tussen 0 en 359.99 liggen.', true);
    if (drafts.some((d,i) => i !== editingIndex && d.name.toLowerCase() === name.toLowerCase())) return message('Deze eventnaam bestaat al.', true);
    const entry = {name,kind,x:chosen.x,z:chosen.z,a};
    if (kind === 'vehicle') {
      if (!vehicleNames.has($('biVehicleSearch').value.trim())) return message('Selecteer een voertuig uit de officiële of geïmporteerde lijst.', true);
      entry.vehicle = $('biVehicleSearch').value.trim();
    } else {
      if (!itemList.length) return message('Voeg eerst minimaal één item toe.', true);
      if (!itemList.every(i => itemNames.has(i.name) && numbers(i.qty,1,20))) return message('Een item of aantal is ongeldig.', true);
      if (!$('biAcknowledge').checked) return message('Bevestig eerst de waarschuwing over globale containerinhoud.', true);
      entry.container = $('biContainer').value;
      entry.items = itemList.map(i => ({name:i.name,qty:Number(i.qty)}));
    }
    if (editingIndex < 0) drafts.push(entry); else drafts[editingIndex] = entry;
    persist(); resetForm(); message('Concept opgeslagen. Er is nog niets gewijzigd op Nitrado.');
  });
  function renderDrafts() {
    layer.clearLayers();
    const list = $('biDrafts'); list.replaceChildren();
    if (!drafts.length) list.textContent = 'Nog geen events opgeslagen.';
    drafts.forEach((d,index) => {
      const m = L.marker(gameToLeaflet(d.x,d.z), {title:d.name}).addTo(layer);
      m.bindTooltip(d.name + ' (' + d.kind + ')');
      m.on('click', () => { setForm(d,index); message('Event geladen: ' + d.name); });
      const div = document.createElement('div'); div.className = 'biDraft';
      const text = document.createElement('div'); text.textContent = d.name + ' · ' + (d.kind === 'vehicle' ? d.vehicle : d.container) + ' · X ' + d.x + ', Z ' + d.z;
      text.style.marginBottom = '6px'; div.appendChild(text);
      const row = document.createElement('div'); row.className = 'biRow';
      const edit = document.createElement('button'); edit.textContent = 'Bewerken'; edit.addEventListener('click', () => setForm(d,index));
      const remove = document.createElement('button'); remove.textContent = 'Verwijderen';
      remove.addEventListener('click', () => { if (!confirm('Event ' + d.name + ' verwijderen uit je concepten?')) return; drafts.splice(index,1); persist(); resetForm(); });
      row.append(edit,remove); div.appendChild(row); list.appendChild(div);
    });
  }
  function refresh() { renderDrafts(); catalogStatus(); }
  renderDrafts();
  $('biFiles').addEventListener('change', async evt => {
    let imported = 0;
    for (const file of evt.target.files) {
      const name = file.name.toLowerCase(), type = ({'types.xml':'types','events.xml':'events','cfgeventspawns.xml':'eventposdef','cfgspawnabletypes.xml':'spawnabletypes'})[name];
      if (!type) { message('Onbekend bestand overgeslagen: ' + file.name, true); continue; }
      try {
        const content = await file.text(), doc = parseXML(content,type);
        files[name] = content;
        if (name === 'types.xml') addCatalog(doc,'types');
        if (name === 'events.xml') addCatalog(doc,'events');
        if (name === 'cfgspawnabletypes.xml') addCatalog(doc,'spawnables');
        imported++;
      } catch (err) { message(file.name + ': ' + err.message, true); }
    }
    $('biImportStatus').textContent = Object.keys(files).join(', ') || 'Geen bestanden geïmporteerd.';
    catalogStatus(); updateChoices('vehicle'); updateChoices('item');
    if (imported) message(imported + ' bestand(en) gelezen. Alles blijft lokaal in je browser.');
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
    if (!drafts.length) throw new Error('Maak eerst een event aan.');
    if (kind === 'cargo' && !drafts.some(d => d.kind === 'loot')) throw new Error('Er zijn nog geen lootdrops om te exporteren.');
    const filename = kind === 'events' ? 'events.xml' : kind === 'positions' ? 'cfgeventspawns.xml' : 'cfgspawnabletypes.xml';
    const root = kind === 'events' ? 'events' : kind === 'positions' ? 'eventposdef' : 'spawnabletypes';
    const original = files[filename];
    const doc = original ? parseXML(original,root) : document.implementation.createDocument(null,root,null);
    if (kind === 'cargo') {
      const loadouts = new Map();
      drafts.filter(d => d.kind === 'loot').forEach(d => {
        const spec = JSON.stringify(d.items.map(x => [x.name,x.qty]).sort((a,b)=>a[0].localeCompare(b[0])));
        if (loadouts.has(d.container) && loadouts.get(d.container).spec !== spec) throw new Error('Verschillende lootdrops gebruiken ' + d.container + ' met andere inhoud. De DayZ-engine ondersteunt dit niet afzonderlijk per locatie. Kies verschillende containertypes of dezelfde inhoud.');
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
        if (exists) throw new Error('Event "' + d.name + '" bestaat al in ' + filename + '. Pas de eventnaam aan voordat je exporteert.');
        doc.documentElement.appendChild(kind === 'events' ? createEvent(doc,d) : createPos(doc,d));
      });
    }
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(doc);
    return {filename: original ? filename : 'BuildIt_ADD_ONLY_' + filename,xml,complete:!!original};
  }
  function downloadXML(data) {
    const url=URL.createObjectURL(new Blob([data.xml],{type:'application/xml;charset=utf-8'}));
    const a=document.createElement('a'); a.href=url; a.download=data.filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  [['biExportEvents','events'],['biExportPositions','positions'],['biExportCargo','cargo']].forEach(pair => {
    $(pair[0]).addEventListener('click', () => {
      try {
        const result=buildOutput(pair[1]); downloadXML(result);
        message(result.filename + ' gedownload. ' + (result.complete ? 'Gecombineerd met het geïmporteerde bronbestand. Maak een back-up en controleer de XML voordat je uploadt.' : 'LET OP: alleen toevoegingen! Niet rechtstreeks als vervanging uploaden.'));
      } catch(err) { message(err.message,true); }
    });
  });
})();
