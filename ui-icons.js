/* Build It!++ local SVG icon set.
 * Presentation only: no controls, API calls, auth values or log filters changed.
 * Icons are bundled (no CDNs), decorative and excluded from button labels.
 */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const shapes={
    logo:'<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/><path d="m8 9 4 2.4L16 9"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    sliders:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
    logs:'<path d="M7 3h10l4 4v14H7z"/><path d="M17 3v5h4M10 12h8M10 16h8M10 8h3"/>',
    wrench:'<path d="M14.7 6.4a5 5 0 0 0-6.4 6.3l-5.1 5.1a2 2 0 0 0 2.8 2.8l5.1-5.1a5 5 0 0 0 6.3-6.4l-3.7 3.7-3.5-.6-.6-3.5z"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6.6L20 12M4 12l2 5.4A7 7 0 0 0 18.4 15"/>',
    x:'<path d="M5 5l14 14M19 5 5 19"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    cloud:'<path d="M7 18H5a4 4 0 0 1-1-7.9A7 7 0 0 1 17.8 9 4.5 4.5 0 0 1 20 18h-3"/><path d="M12 20V10m-4 4 4-4 4 4"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    shield:'<path d="m12 2 9 4v6c0 6-3.5 9-9 10-5.5-1-9-4-9-10V6z"/><path d="m8 12 2.5 2.5L16 9"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3z"/>',
    file:'<path d="M5 3h9l5 5v13H5z"/><path d="M14 3v6h5M9 13h6M9 17h6"/>',
    code:'<path d="M8 8 4 12l4 4m8-8 4 4-4 4m-3-11-2 14"/>',
    key:'<circle cx="8" cy="14" r="4"/><path d="m11 11 9-9 2 2-3 3 2 2-3 3-2-2-2 2"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    server:'<rect x="4" y="3" width="16" height="8" rx="2"/><rect x="4" y="13" width="16" height="8" rx="2"/><path d="M8 7h.01M8 17h.01M12 7h5M12 17h5"/>',
    activity:'<path d="M2 13h5l3-8 4 14 3-6h5"/>',
    players:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8a3 3 0 0 1 0 6M18 17a4 4 0 0 1 3 3"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/>',
    car:'<path d="m5 11 2-5h10l2 5M4 11h16v8H4zM4 14h16"/><path d="M7 19v2M17 19v2"/><circle cx="7" cy="15.5" r=".6"/><circle cx="17" cy="15.5" r=".6"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon:'<path d="M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13z"/>',
    save:'<path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-9h10v9"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    edit:'<path d="m4 20 4-.7L20 7.3 16.7 4 4.7 16zM14.8 6l3.2 3.2"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    filter:'<path d="M4 5h16l-6.5 7v7l-3 2v-9z"/>',
    checkfile:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8.5 15l2.5 2.5 4.5-5"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    sparkle:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
    lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };
  function icon(name){
    if(!Object.hasOwn(shapes,name))return null;
    const svg=document.createElementNS(NS,'svg');
    svg.setAttribute('class','bi-icon');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.innerHTML=shapes[name];
    return svg;
  }
  function decorate(el,name,{only=false}={}){
    if(!el||!shapes[name])return;
    const current=el.querySelector(':scope > svg.bi-icon');
    if(current){
      if(current.dataset.icon===name)return;
      current.replaceWith(icon(name));
      const next=el.querySelector(':scope > svg.bi-icon');
      if(next)next.dataset.icon=name;
      return;
    }
    const graphic=icon(name);graphic.dataset.icon=name;
    el.prepend(graphic);
    el.classList.add('bi-icon-leading');
    if(only)el.classList.add('bi-icon-only');
  }
  const byId={
    filterToggle:'sliders',logToggle:'logs',biToggle:'wrench',
    logClose:'x',biClose:'x',nitradoSyncNow:'refresh',logClear:'trash',
    nitradoTest:'shield',nitradoKeyReveal:'eye',nitradoKeyCopy:'copy',
    fmFindMission:'folder',fmBrowse:'folder',
    fmFtpRoot:'folder',fmBack:'folder',fmValidate:'checkfile',
    fmRepairXml:'wrench',fmDownload:'download',fmSave:'cloud',
    biPick:'pin',biSave:'save',biNew:'refresh',
    biPreviewServer:'checkfile',biUploadServer:'cloud',
    biLoadServer:'refresh',biExportEvents:'download',
    biExportPositions:'download',biExportCargo:'download',
    customBasesRefresh:'refresh',logAllActionsOn:'check',
    logAllActionsOff:'x',filterAllOn:'check',filterAllOff:'x',
    logSelectAllPlayers:'players',accessSubmit:'lock'
  };
  for(const [id,name] of Object.entries(byId)){
    const el=document.getElementById(id);
    decorate(el,name,{only:id==='biClose'||id==='logClose'});
  }
  const headings=[
    ['#filterPanel .filter-title','sliders'],
    ['#logPanel .log-overview-top .log-subtitle','server'],
    ['#logPanel .log-activity-header .log-subtitle','activity'],
    ['#fileManager .log-auto-title','folder']
  ];
  for(const [sel,name] of headings)decorate(document.querySelector(sel),name);
  const search=document.getElementById('placeSearchBox');
  if(search && !search.querySelector('.bi-search-icon')){
    const span=document.createElement('span');span.className='bi-search-icon';
    span.appendChild(icon('search'));search.appendChild(span);
  }
  const brand=document.createElement('div');
  brand.id='builditBrand';
  brand.setAttribute('aria-hidden','true');
  brand.innerHTML='<span class="brand-mark"></span>'+
    '<span class="brand-type"><span class="brand-label">Build It!++</span>'+
    '<span class="brand-caption">CHERNARUS · SERVER TOOLS</span></span>';
  brand.querySelector('.brand-mark').appendChild(icon('logo'));
  document.body.appendChild(brand);

  // Buttons whose labels change after interaction lose their child SVG.
  // Watch only these small controls, not the whole page or live log list.
  for(const [id,getIcon] of [
    ['builditThemeToggle',()=>document.documentElement.dataset.builditTheme==='light'?'moon':'sun'],
    ['builditMapStyleToggle',()=>document.getElementById('builditMapStyleToggle')?.dataset.mapStyle==='topographic'?'layers':'map'],
    ['biPick',()=> 'pin']
  ]){
    const el=document.getElementById(id);
    if(!el)continue;
    const refresh=()=>decorate(el,getIcon(),{only:id==='builditThemeToggle'});
    refresh();
    new MutationObserver(refresh).observe(el,{childList:true,attributes:id==='builditMapStyleToggle',attributeFilter:id==='builditMapStyleToggle'?['data-map-style']:undefined});
  }
  const entries=document.getElementById('fmEntries');
  if(entries){
    const apply=()=>{
      for(const button of entries.querySelectorAll('button.fm-entry')){
        decorate(button,button.dataset.entryType==='folder'?'folder':'file');
      }
    };
    apply();
    new MutationObserver(apply).observe(entries,{childList:true,subtree:true});
  }
  const drafts=document.getElementById('biDrafts');
  if(drafts){
    const apply=()=>{
      for(const el of drafts.querySelectorAll('button')){
        decorate(el,el.textContent.trim()==='Remove'?'trash':'edit');
      }
    };
    apply();
    new MutationObserver(apply).observe(drafts,{childList:true,subtree:true});
  }
})();
