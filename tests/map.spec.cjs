const { test, expect } = require('@playwright/test');

test.beforeEach(async ({page}) => {
  // This is the non-secret session flag used by the existing client-side gate.
  // No real passwords, API tokens, or Cloudflare keys are used.
  await page.addInitScript(() => sessionStorage.setItem('buildit_access_ok_v1','1'));
  // Even if third-party map sources are unavailable, local canonical labels must work.
  await page.route(/(static\.xam\.nu\/dayz\/json|dzmap\.woozymasta\.ru\/maps)/, route => route.abort());
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await expect(page.locator('#placeSearchInput')).toBeEnabled({timeout:25000});
});

test('all 201 official Chernarus locations load locally and remain searchable', async ({page}) => {
  await page.waitForFunction(() => typeof placeSearchIndex !== 'undefined' && placeSearchIndex.length === 201);
  const labels=await page.evaluate(() => placeSearchIndex.map(p => ({name:p.lat,x:p.x,z:p.z})));
  expect(labels).toHaveLength(201);
  await expect(page.locator('#placeSearchInput')).toHaveAttribute('placeholder',/Search places/i);
  await page.locator('#placeSearchInput').fill('Berezino');
  await expect(page.locator('#placeSearchResults .place-search-result').first()).toContainText(/Berezino/i);
  await page.locator('#placeSearchInput').fill('Novodmitrovsk');
  await expect(page.locator('#placeSearchResults .place-search-result').first()).toContainText(/Novodmitrovsk/i);
});

test('place names match exact game-world positions (not spawn estimates)', async ({page}) => {
  const anchors={
    'Berezino':[12372.38,9760.98],
    'Chernogorsk':[6778.62,2321.77],
    'Novodmitrovsk':[11339.77,14391.05],
    'Elektrozavodsk':[10286.68,1992.77],
    'Zelenogorsk':[2796,5166],
    'Severograd':[8168.48,12573.60],
    'Stary Sobor':[6114,7849],
    'Svetloyarsk':[13989.74,13263.78],
    'Tisy':[3441.65,14799.55]
  };
  const rows=await page.evaluate(() => placeSearchIndex.map(p=>({name:p.lat,x:p.x,z:p.z})));
  for(const [name,[x,z]] of Object.entries(anchors)){
    const place=rows.find(r=>r.name===name);
    expect(place, 'Missing official location '+name).toBeTruthy();
    expect(Math.abs(place.x-x),'Incorrect X for '+name).toBeLessThan(0.03);
    expect(Math.abs(place.z-z),'Incorrect Z for '+name).toBeLessThan(0.03);
  }
});

test('minor locations show when zoomed in; names stay in their own positions', async ({page}) => {
  await page.evaluate(() => map.setZoom(0, {animate:false}));
  await expect.poll(()=>page.locator('.place-wrap').count()).toBe(2);
  await page.evaluate(() => map.setZoom(5, {animate:false}));
  await expect.poll(()=>page.locator('.place-wrap').count()).toBe(201);
});


test('only place names are enabled initially; other map layers are optional', async ({page}) => {
  await expect(page.locator('#filterPlaceNames')).toBeChecked();
  expect(await page.locator('#filterCustomBases').isChecked()).toBe(false);
  expect(await page.locator('#filterPanel input[id^="filterSpawn_"]').evaluateAll(
    elements => elements.every(input => !input.checked)
  )).toBe(true);
  await page.locator('#filterToggle').click();
  await page.locator('#filterViewSelect').selectOption('spawns');
  await page.locator('#filterSpawn_car').check();
  await expect(page.locator('#filterSpawn_car')).toBeChecked();
});

test('right-side menus are aligned and only one panel is open', async ({page}) => {
  const bounds=await Promise.all(['filterToggle','logToggle','biToggle'].map(id=>page.locator('#'+id).boundingBox()));
  bounds.forEach(box=>expect(box).toBeTruthy());
  expect(bounds[0].y+bounds[0].height).toBeLessThanOrEqual(bounds[1].y);
  expect(bounds[1].y+bounds[1].height).toBeLessThanOrEqual(bounds[2].y);
  expect(Math.abs(bounds[0].x-bounds[2].x)).toBeLessThan(2);
  await page.locator('#filterToggle').click();
  await expect(page.locator('#filterPanel')).toBeVisible();
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await expect(page.locator('#logPanel')).toBeVisible();
  await expect(page.locator('#filterPanel')).toBeHidden();
  await page.locator('#biToggle').click();
  await expect(page.locator('#biPanel')).toBeVisible();
  await expect(page.locator('#logPanel')).toBeHidden();
});

test('mobile app manifest, icons, and offline worker are valid', async ({page,request}) => {
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','./manifest.webmanifest');
  const res=await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest=await res.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  for(const dimension of [192,512]){
    const icon=manifest.icons.find(i=>i.sizes===dimension+'x'+dimension);
    expect(icon).toBeTruthy();
    const png=await request.get('/'+icon.src.replace(/^\.?\//,''));
    expect(png.ok()).toBe(true);
    const bytes=await png.body();
    expect(bytes.subarray(1,4).toString('ascii')).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(dimension);
    expect(bytes.readUInt32BE(20)).toBe(dimension);
  }
  await page.waitForFunction(async()=>!!(await navigator.serviceWorker?.getRegistration()),null,{timeout:15000});
});

test('Event Manager panel fits phone viewport', async ({page}) => {
  await page.locator('#biToggle').click();
  await expect(page.locator('#biPick')).toBeVisible();
  const box=await page.locator('#biPanel').boundingBox();
  const viewport=page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);
});

test('Nitrado File Manager downloads files and requires a separate write key', async ({page})=>{
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const url=new URL(route.request().url());
    const path='/games/ni123/noftp/dayzps_missions/dayzOffline.chernarusplus/db/types.xml';
    const init={status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'}};
    let response={ok:true};
    if(url.pathname==='/api/files/list')response={ok:true,root:'/games/ni123/noftp',dir:'/games/ni123/noftp',entries:[{name:'dayzps_missions',type:'directory',path:'/games/ni123/noftp/dayzps_missions'},{name:'db',type:'directory',path:'/games/ni123/noftp/db'}]};
    if(url.pathname==='/api/files/read')response={ok:true,path,content:'<types/>',sha256:'a'.repeat(64)};
    if(url.pathname==='/api/files/write')response={ok:true,backupPath:path+'.backup',verified:true};
    await route.fulfill({...init,body:JSON.stringify(response)});
  });
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await expect(page.locator('#fileManager')).toBeVisible();
  await page.locator('#nitradoWorkerUrl').fill('https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').fill('fake_read_key_for_browser_test');
  await page.locator('#fmBrowse').click();
  await expect(page.locator('#fmStatus')).toContainText('Folder loaded');
  await expect(page.locator('.fm-entry').first()).toContainText('dayzps_missions');
  await page.locator('#fmBack').isDisabled();
  await expect(page.locator('#nitradoWriteKey')).toHaveAttribute('type','password');
  await expect(page.locator('#fmFileBox')).toBeHidden();
});

test('small theme button switches light/dark appearance and remembers choice', async ({page}) => {
  const button = page.locator('#builditThemeToggle');
  await expect(button).toBeVisible();
  await expect(button).toHaveAccessibleName('Switch to light mode');
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme', 'dark');
  const before = await page.locator('#filterToggle').evaluate(el=>getComputedStyle(el).backgroundColor);
  await button.click();
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme', 'light');
  await expect(button).toHaveAccessibleName('Switch to dark mode');
  await expect(button).toHaveAttribute('aria-pressed','true');
  const after = await page.locator('#filterToggle').evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(after).not.toBe(before);
  await page.locator('#filterToggle').click();
  await expect(page.locator('#filterPanel')).toBeVisible();
  await expect(page.locator('#filterPanel')).toHaveCSS('color', 'rgb(27, 51, 69)');
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme','light');
  await expect(page.locator('#builditThemeToggle')).toHaveAccessibleName('Switch to dark mode');
  await page.locator('#builditThemeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme','dark');
  expect(await page.evaluate(()=>localStorage.getItem('buildit_theme_v1'))).toBe('dark');
});

test('theme button fits upper right without covering place search on mobile', async ({page}) => {
  const toggle=page.locator('#builditThemeToggle');
  await expect(toggle).toBeVisible();
  const button=await toggle.boundingBox();
  const input=await page.locator('#placeSearchInput').boundingBox();
  const container=await page.locator('#placeSearchBox').boundingBox();
  const view=page.viewportSize();
  expect(button.width).toBeLessThanOrEqual(44);
  expect(button.height).toBeLessThanOrEqual(44);
  expect(button.x).toBeGreaterThanOrEqual(input.x+input.width+3);
  expect(button.x+button.width).toBeLessThanOrEqual(view.width);
  expect(button.y).toBeGreaterThanOrEqual(0);
  expect(button.y).toBeLessThan(container.y+4);
  await toggle.click();
  await page.locator('#placeSearchInput').fill('Berezino');
  await expect(page.locator('#placeSearchResults')).toBeVisible();
  const result=await page.locator('#placeSearchResults').boundingBox();
  expect(result.x+result.width).toBeLessThanOrEqual(button.x);
});


test('Chernarus base map switches Satellite and Topographic without moving coordinates or markers', async ({page})=>{
  // Exercise real Leaflet tile switching without depending on a third-party CDN
  // being reachable from the CI runner.
  await page.route('**/topographic/**',route=>route.fulfill({
    status:200,
    contentType:'image/gif',
    body:Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACAUwAOw==','base64')
  }));
  const button=page.locator('#builditMapStyleToggle');
  await expect(button).toBeVisible();
  await expect(button).toHaveText(/Satellite/);
  await expect(button).toHaveAccessibleName(/Switch to Topographic/);
  const before=await page.evaluate(()=>({
    center:{lat:map.getCenter().lat,lng:map.getCenter().lng},zoom:map.getZoom(),
    markers:placeSearchIndex.length,labels:map.hasLayer(labels),
    bases:map.hasLayer(baseMarkerLayer),positions:placeSearchIndex.map(p=>[p.lat,p.x,p.z]),
    tiles:MAP_STYLES.satellite._url
  }));
  expect(before.tiles).toContain('/satellite/');
  await button.click();
  await expect(button).toHaveText(/Topographic/);
  await expect(button).toHaveAccessibleName(/Switch to Satellite/);
  await expect(button).toHaveAttribute('aria-pressed','true');
  const after=await page.evaluate(()=>({
    active:currentMapStyle,
    satelliteVisible:map.hasLayer(MAP_STYLES.satellite),
    topoVisible:map.hasLayer(MAP_STYLES.topographic),
    center:{lat:map.getCenter().lat,lng:map.getCenter().lng},zoom:map.getZoom(),
    markers:placeSearchIndex.length,labels:map.hasLayer(labels),
    bases:map.hasLayer(baseMarkerLayer),positions:placeSearchIndex.map(p=>[p.lat,p.x,p.z]),
    tiles:MAP_STYLES.topographic._url,
    storage:localStorage.getItem('buildit_map_style_v1')
  }));
  expect(after.active).toBe('topographic');
  expect(after.storage).toBe('topographic');
  expect(after.tiles).toContain('/topographic/');
  expect(after.satelliteVisible).toBe(false);
  expect(after.topoVisible).toBe(true);
  expect(after.center).toEqual(before.center);
  expect(after.zoom).toBe(before.zoom);
  expect(after.markers).toBe(201);
  expect(after.labels).toBe(before.labels);
  expect(after.bases).toBe(before.bases);
  expect(after.positions).toEqual(before.positions);
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('#builditMapStyleToggle')).toHaveText(/Topographic/);
  expect(await page.evaluate(()=>map.hasLayer(MAP_STYLES.topographic))).toBe(true);
  await page.locator('#builditMapStyleToggle').click();
  await expect(page.locator('#builditMapStyleToggle')).toHaveText(/Satellite/);
  expect(await page.evaluate(()=>localStorage.getItem('buildit_map_style_v1'))).toBe('satellite');
});

test('map-style control stays left below zoom and clear of right-hand search and menus',async ({page})=>{
  const button=page.locator('#builditMapStyleToggle');
  const bb=await button.boundingBox();
  const zoom=await page.locator('.leaflet-control-zoom').boundingBox();
  const input=await page.locator('#placeSearchInput').boundingBox();
  const search=await page.locator('#placeSearchBox').boundingBox();
  expect(bb).toBeTruthy();
  expect(bb.width).toBeLessThanOrEqual(121);
  expect(bb.y).toBeGreaterThanOrEqual(zoom.y+zoom.height);
  expect(bb.x+bb.width).toBeLessThan(search.x);
  expect(bb.y).toBeGreaterThanOrEqual(0);
  await page.locator('#builditThemeToggle').click();
  await expect(button).toHaveCSS('color','rgb(29, 52, 71)');
  await page.locator('#placeSearchInput').fill('Berezino');
  await expect(page.locator('#placeSearchResults')).toBeVisible();
  await expect(button).toBeVisible();
});


test('File Manager finds DayZ PS Chernarus mission in FTP root, not noftp/dayzps config',async ({page})=>{
  const base='/games/ni5774718_3';
  const noftp=base+'/noftp';
  const ftproot=base+'/ftproot';
  const mission=ftproot+'/dayzps_missions/dayzOffline.chernarusplus';
  const requests=[];
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const request=route.request();
    const url=new URL(request.url());
    const dir=url.searchParams.get('dir')||noftp;
    requests.push({path:url.pathname,dir,method:request.method()});
    if(url.pathname!=='/api/files/list'){
      return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
    }
    const folders={
      [noftp]:[{name:'dayzps',type:'directory',path:noftp+'/dayzps'}],
      [noftp+'/dayzps']:[{name:'config',type:'directory',path:noftp+'/dayzps/config'},{name:'ban.txt',type:'file',path:noftp+'/dayzps/ban.txt'}],
      [ftproot]:[{name:'dayzps_missions',type:'directory',path:ftproot+'/dayzps_missions'}],
      [ftproot+'/dayzps_missions']:[{name:'dayzOffline.chernarusplus',type:'directory',path:mission}],
      [mission]:[{name:'db',type:'directory',path:mission+'/db'},{name:'cfgeventspawns.xml',type:'file',path:mission+'/cfgeventspawns.xml'}],
      [mission+'/db']:[{name:'types.xml',type:'file',path:mission+'/db/types.xml'},{name:'events.xml',type:'file',path:mission+'/db/events.xml'}]
    };
    if(!Object.prototype.hasOwnProperty.call(folders,dir)){
      return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Not found: '+dir})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,root:noftp,dir,entries:folders[dir]})});
  });
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#nitradoWorkerUrl').fill('https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').fill('test_map_sync_key_0123456789');
  await page.locator('#fmBrowse').click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(noftp);
  await page.locator('.fm-entry', {hasText:'dayzps'}).click();
  await expect(page.locator('#fmStatus')).toContainText('server settings, not Chernarus mission');
  await page.locator('#fmFindMission').click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(mission);
  await expect(page.locator('#fmStatus')).toContainText('Chernarus mission found');
  await expect(page.locator('#fmEntries')).toContainText('db');
  await page.locator('.fm-entry',{hasText:'db'}).click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(mission+'/db');
  await expect(page.locator('#fmEntries')).toContainText('events.xml');
  await page.locator('#fmBack').click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(mission);
  expect(requests.some(x=>x.dir===mission)).toBe(true);
  expect(requests.every(x=>x.method==='GET')).toBe(true);
});

test('File Manager lets user browse FTP root directly when mission auto-discovery is unavailable',async ({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const ftp='/games/ni5774718_3/ftproot';
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const dir=u.searchParams.get('dir')||noftp;
    if(dir===noftp)return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({root:noftp,dir,entries:[{name:'dayzps',path:noftp+'/dayzps',type:'directory'}]})});
    if(dir===ftp)return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({root:noftp,dir,entries:[{name:'dayzps_missions',path:ftp+'/dayzps_missions',type:'directory'}]})});
    return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
  });
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#nitradoWorkerUrl').fill('https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').fill('test_map_sync_key_0123456789');
  await page.locator('#fmFtpRoot').click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(ftp);
  await expect(page.locator('#fmEntries')).toContainText('dayzps_missions');
  await expect(page.locator('#fmBack')).toBeDisabled();
  await page.locator('#fmBrowse').click();
  await expect(page.locator('#fmCurrentDir')).toHaveText(noftp);
});

test('Mission finder fails safely without attempting writes if mission directories are unavailable',async ({page})=>{
  const root='/games/ni5774718_3/noftp';
  let posts=0;
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    if(route.request().method()!=='GET')posts++;
    const url=new URL(route.request().url());
    if(!url.searchParams.has('dir')){
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({root,dir:root,entries:[{name:'dayzps',type:'directory',path:root+'/dayzps'}]})});
    }
    return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
  });
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#nitradoWorkerUrl').fill('https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').fill('test_map_sync_key_0123456789');
  await page.locator('#fmFindMission').click();
  await expect(page.locator('#fmStatus')).toContainText('not found automatically');
  await expect(page.locator('#fmStatus')).toContainText('No files were changed');
  expect(posts).toBe(0);
});


test('live Custom Bases loads every valid spawner JSON from mission/custom but never loadouts',async ({page})=>{
  const base='/games/ni5774718_3';
  const mission=base+'/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const custom=mission+'/custom';
  const calls=[];
  const listings={
    [custom]:[
      {name:'baseSander.json',type:'file',path:custom+'/baseSander.json',size:1200},
      {name:'BASE_OTHER.json',type:'file',path:custom+'/BASE_OTHER.json',size:2200},
      {name:'playerloadout.json',type:'file',path:custom+'/playerloadout.json',size:1200},
      {name:'extras',type:'directory',path:custom+'/extras'},
      {name:'notes.txt',type:'file',path:custom+'/notes.txt',size:20}
    ],
    [custom+'/extras']:[
      {name:'myOtherPoi.json',type:'file',path:custom+'/extras/myOtherPoi.json',size:1100},
      {name:'SpawnGear.json',type:'file',path:custom+'/extras/SpawnGear.json',size:700}
    ]
  };
  const samples={
    [custom+'/baseSander.json']:{Objects:[
      {name:'Land_Cabin',pos:[3960.0,245.0,11050.0],ypr:[0,0,0]},
      {name:'Land_Wall',pos:[3961.0,250.0,11052.0],ypr:[0,0,0]},
      {name:'Land_Fence',pos:[3960.5,255.0,11048.5],ypr:[0,0,0]}
    ]},
    [custom+'/BASE_OTHER.json']:{Objects:[
      {name:'Land_House',pos:[6000,100,7000]},
      {name:'Land_House',pos:[6001,200,7001]},
      {name:'Land_Bridge',pos:[11000,5,12000]}
    ]},
    [custom+'/extras/myOtherPoi.json']:{Objects:[
      {name:'Land_House',pos:[5000,8,5000]}
    ]}
  };
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    calls.push({path:u.pathname,query:u.searchParams.get('file')||u.searchParams.get('dir'),method:route.request().method()});
    let response,status=200;
    if(u.pathname==='/api/files/list'){
      const dir=u.searchParams.get('dir');
      if(!dir) response={root:base+'/noftp',dir:base+'/noftp',entries:[]};
      else if(Object.hasOwn(listings,dir))response={root:base+'/noftp',dir,entries:listings[dir]};
      else{status=404;response={error:'not found'}}
    }else if(u.pathname==='/api/files/read'){
      const file=u.searchParams.get('file');
      if(!Object.hasOwn(samples,file)){status=404;response={error:'not found'}}
      else response={ok:true,path:file,content:JSON.stringify(samples[file])};
    }else{status=404;response={error:'not found'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate((el)=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate((el)=>el.value='fake_reader_token_for_tests');
  await page.locator('#filterToggle').click();
  await page.locator('#customBasesRefresh').click();
  await expect(page.locator('#customBasesSyncStatus')).toContainText('3/3 object files mapped');
  const summary=await page.evaluate(()=>window.BUILD_IT_customBasesSync.summary());
  expect(summary.mappedFiles).toBe(3);
  expect(summary.count).toBe(4); // other JSON has two far-away object groups
  expect(summary.failedFiles).toHaveLength(0);
  expect(calls.filter(x=>x.path==='/api/files/read')).toHaveLength(3);
  expect(calls.every(x=>x.method==='GET')).toBe(true);
  expect(calls.some(x=>String(x.query).toLowerCase().includes('loadout')&&x.path==='/api/files/read')).toBe(false);
  expect(calls.some(x=>String(x.query).toLowerCase().includes('spawngear')&&x.path==='/api/files/read')).toBe(false);
  // Replaced legacy previews, not added duplicate markers
  expect(await page.evaluate(()=>baseMarkerLayer.getLayers().length)).toBe(4);
  expect(await page.evaluate(()=>basePolygonLayer.getLayers().length)).toBe(1);
  await page.locator('#filterCustomBases').check();
  await expect.poll(()=>page.evaluate(()=>map.hasLayer(baseMarkerLayer))).toBe(true);
  const markers=await page.evaluate(()=>baseMarkerLayer.getLayers().map(l=>{
    const p=leafletToGame(l.getLatLng());return [p.x,p.z];
  }));
  expect(markers.some(([x,z])=>Math.abs(x-3960.5)<1&&Math.abs(z-11050)<2)).toBe(true);
  expect(markers.some(([x,z])=>Math.abs(x-6000.5)<2&&Math.abs(z-7000.5)<2)).toBe(true);
  expect(markers.some(([x,z])=>Math.abs(x-11000)<1&&Math.abs(z-12000)<1)).toBe(true);
  await page.locator('#filterCustomBases').uncheck();
  expect(await page.evaluate(()=>map.hasLayer(baseMarkerLayer))).toBe(false);
});

test('custom folder unavailable: preserves preview bases and reports an explicit error',async ({page})=>{
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const root='/games/ni5774718_3/noftp';
    if(u.pathname==='/api/files/list'&&!u.searchParams.has('dir'))
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({root,dir:root,entries:[]})});
    return route.fulfill({status:404,contentType:'application/json',body:'{"error":"not found"}'});
  });
  const old=await page.evaluate(()=>baseMarkerLayer.getLayers().length);
  expect(old).toBe(9);
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='fake_key');
  await page.locator('#filterToggle').click();
  await page.locator('#customBasesRefresh').click();
  await expect(page.locator('#customBasesSyncStatus')).toContainText('Custom Bases sync failed');
  expect(await page.evaluate(()=>baseMarkerLayer.getLayers().length)).toBe(old);
});

test('loadouts and non-spawner JSON are excluded and reported, including oversized files',async ({page})=>{
  const root='/games/ni5774718_3/noftp';
  const dir=root+'/dayzps_missions/dayzOffline.chernarusplus/custom';
  let readCalls=0;
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    let status=200,body;
    if(u.pathname==='/api/files/list'){
      const location=u.searchParams.get('dir');
      if(!location)body={root,dir:root,entries:[]};
      else if(location===dir)body={root,dir,entries:[
        {name:'mybase.json',path:dir+'/mybase.json',type:'file',size:220},
        {name:'RestrictedArea.json',path:dir+'/RestrictedArea.json',type:'file',size:220},
        {name:'playerloadout.json',path:dir+'/playerloadout.json',type:'file',size:200},
        {name:'hugeBase.json',path:dir+'/hugeBase.json',type:'file',size:600000}
      ]};
      else{status=404;body={error:'No such directory'}}
    }else if(u.pathname==='/api/files/read'){
      readCalls++;
      const file=u.searchParams.get('file');
      body={ok:true,path:file,content:JSON.stringify(
        file.endsWith('mybase.json')?{Objects:[{name:'Land_Cabin',pos:[100,15,200]}]}:{Areas:[{position:[1,2,3]}]}
      )};
    }else{status=404;body={error:'bad route'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='fake_key');
  await page.locator('#filterToggle').click();
  await page.locator('#customBasesRefresh').click();
  await expect(page.locator('#customBasesSyncStatus')).toContainText('1/3 object files mapped');
  await expect(page.locator('#customBasesSyncStatus')).toContainText('Loadouts excluded: 1');
  await expect(page.locator('#customBasesSyncStatus')).toContainText('hugeBase.json');
  const sum=await page.evaluate(()=>window.BUILD_IT_customBasesSync.summary());
  expect(sum.mappedFiles).toBe(1);
  expect(sum.failedFiles).toHaveLength(1);
  expect(readCalls).toBe(2);
  expect(await page.evaluate(()=>baseMarkerLayer.getLayers().length)).toBe(1);
});


test('Custom Bases streams JSON bigger than 512KB without changing file editor or server', async ({page})=>{
  const root='/games/ni5774718_3/ftproot';
  const custom=root+'/dayzps_missions/dayzOffline.chernarusplus/custom';
  const big=custom+'/veryLargeBase.json';
  const objects=Array.from({length:2500},(_,i)=>({
    name:'Land_Wall_'+('HeavyObject'.repeat(28)),pos:[4060+(i%100)*.15,201,10700+(i%70)*.12],ypr:[0,0,0]
  }));
  const raw=JSON.stringify({Objects:objects});
  expect(raw.length).toBeGreaterThan(512*1024);
  expect(raw.length).toBeLessThan(20*1024*1024);
  const calls=[];
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**', async route=>{
    const u=new URL(route.request().url()),method=route.request().method();
    calls.push({path:u.pathname,method});
    let status=200,contentType='application/json',body='';
    if(u.pathname==='/api/files/list'){
      const dir=u.searchParams.get('dir');
      if(!dir){body=JSON.stringify({root:'/games/ni5774718_3/noftp',dir:'/games/ni5774718_3/noftp',entries:[]});}
      else if(dir===custom){body=JSON.stringify({root:'/games/ni5774718_3/noftp',dir:custom,entries:[
        {name:'veryLargeBase.json',type:'file',path:big,size:raw.length},
        {name:'playerloadout.json',type:'file',path:custom+'/playerloadout.json',size:1800000}
      ]});}
      else{status=404;body=JSON.stringify({error:'Not found'});}
    }else if(u.pathname==='/api/files/custom-content'&&u.searchParams.get('file')===big){
      body=raw;
    }else{status=404;body=JSON.stringify({error:'Not found'});}
    await route.fulfill({status,contentType,body});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='fake_key');
  await page.locator('#filterToggle').click();
  await page.locator('#customBasesRefresh').click();
  await expect(page.locator('#customBasesSyncStatus')).toContainText('1/1 object files mapped');
  await expect(page.locator('#customBasesSyncStatus')).toContainText('Loadouts excluded: 1');
  const state=await page.evaluate(()=>window.BUILD_IT_customBasesSync.summary());
  expect(state.count).toBe(1);
  expect(state.mappedFiles).toBe(1);
  expect(state.failedFiles).toEqual([]);
  expect(calls.filter(x=>x.path==='/api/files/custom-content')).toHaveLength(1);
  expect(calls.filter(x=>x.path==='/api/files/read')).toHaveLength(0);
  expect(calls.every(x=>x.method==='GET')).toBe(true);
  expect(await page.evaluate(()=>baseMarkerLayer.getLayers().length)).toBe(1);
});


test('file-write test is removed while file manager and upload key remain usable',async({page})=>{
  await page.locator('#logToggle').click();
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await expect(page.locator('#nitradoFileWriteTest')).toHaveCount(0);
  await expect(page.locator('#nitradoFileWriteStatus')).toHaveCount(0);
  await expect(page.locator('#fileManager')).toBeVisible();
  await expect(page.locator('#fmBrowse')).toBeVisible();
  await expect(page.locator('#fmSave')).toBeDisabled();
  const key=page.locator('#nitradoWriteKey');
  const count=page.locator('#nitradoWriteKeyLength');
  await expect(key).toBeVisible();
  await expect(count).toContainText('Minimum 8 characters');
  await key.fill('short');
  await expect(count).toContainText('5/8 characters');
  await key.fill('abcdefgh');
  await expect(count).toContainText('Length OK');
  expect(await key.getAttribute('type')).toBe('password');
  expect(await page.evaluate(()=>localStorage.getItem('nitradoWriteKey'))).toBeNull();
  expect(await page.evaluate(()=>sessionStorage.getItem('nitradoWriteKey'))).toBeNull();
  await expect(page.locator('#logServerFiles summary')).toContainText('Server files & uploads');
  await expect(page.locator('#fmValidate')).toHaveCount(1);
});


test('Event Manager loads live vehicle XML and previews coordinated changes without writing',async({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const events=mission+'/db/events.xml';
  const positions=mission+'/cfgeventspawns.xml';
  const eventXML='<?xml version="1.0"?><events><event name="VehicleVanilla"><children><child type="OffroadHatchback" min="1" max="1"/></children></event></events>';
  const positionXML='<?xml version="1.0"?><eventposdef><event name="VehicleVanilla"><pos x="1100" z="5000" a="90"/></event></eventposdef>';
  let calls=[],updates=[];
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url()),method=route.request().method();
    calls.push({route:u.pathname,method});
    let status=200,result={ok:true};
    if(u.pathname==='/api/files/list'){
      const dir=u.searchParams.get('dir');
      if(!dir)result={root:noftp,dir:noftp,entries:[]};
      else if(dir===mission)result={root:noftp,dir:mission,entries:[{name:'db',type:'directory',path:mission+'/db'}]};
      else{status=404;result={error:'Directory unavailable'}}
    }else if(u.pathname==='/api/files/read'){
      const p=u.searchParams.get('file');
      if(p===events||p===positions)result={path:p,content:p===events?eventXML:positionXML,sha256:'a'.repeat(64)};
      else{status=404;result={error:'Missing'}}
    }else if(u.pathname==='/api/files/write'){
      updates.push(route.request().postDataJSON());result={verified:true,backupPath:events+'.bak'};
    }else{status=404;result={error:'Not configured'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='fake_key');
  await page.locator('#biToggle').click();
  await page.locator('#biAdvanced').evaluate(el=>el.open=true);
  await page.locator('#biLoadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Server XML reloaded');
  await page.locator('#biName').fill('VehicleBuildItTest');
  await page.locator('#biVehicleSearch').fill('OffroadHatchback');
  await page.locator('#biPick').click();
  await page.evaluate(()=>map.fire('click',{latlng:L.latLng(8000/SCALE-256,4000/SCALE)}));
  await page.locator('#biSave').click();
  await expect(page.locator('#biDrafts')).toContainText('VehicleBuildItTest');
  await page.locator('#biPreviewServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('READY');
  await expect(page.locator('#biServerPreview')).toContainText('VehicleBuildItTest');
  await expect(page.locator('#biServerPreview')).toContainText('db/events.xml');
  await expect(page.locator('#biServerPreview')).toContainText('cfgeventspawns.xml');
  expect(updates).toHaveLength(0);
  expect(calls.every(c=>c.method==='GET')).toBe(true);
  await expect(page.locator('#biUploadServer')).toBeEnabled();
  await page.locator('#biUploadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Stop your DayZ server');
  expect(updates).toHaveLength(0);
});

test('Event Manager Nitrado deploy stops with clear error if upload permission is denied',async({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const epath=mission+'/db/events.xml',ppath=mission+'/cfgeventspawns.xml';
  let attempts=0;
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const dir=u.searchParams.get('dir');
    const p=u.searchParams.get('file');
    let status=200,result={ok:true};
    if(u.pathname==='/api/files/list'&&!dir)result={root:noftp,dir:noftp,entries:[]};
    else if(u.pathname==='/api/files/list'&&dir===mission)
      result={root:noftp,dir:mission,entries:[{name:'db',type:'directory',path:mission+'/db'}]};
    else if(u.pathname==='/api/files/read'&&(p===epath||p===ppath))
      result={path:p,content:p===epath?
        '<events><event name="VehicleVanilla"><children><child type="OffroadHatchback"/></children></event></events>':
        '<eventposdef><event name="VehicleVanilla"><pos x="2" z="3" a="0"/></event></eventposdef>',
        sha256:'b'.repeat(64)};
    else if(u.pathname==='/api/files/write'){
      attempts++;status=502;result={error:'Nitrado POST returned HTTP 500: Permission denied'};
    }else{status=404;result={error:'Not found'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='fake_key');
  await page.locator('#biToggle').click();
  await page.locator('#biAdvanced').evaluate(el=>el.open=true);
  await page.locator('#biLoadServer').click();
  await expect(page.locator('#biPreviewServer')).toBeEnabled();
  await page.locator('#biName').fill('VehiclePermissionTest');
  await page.locator('#biVehicleSearch').fill('OffroadHatchback');
  await page.locator('#biPick').click();
  await page.evaluate(()=>map.fire('click',{latlng:L.latLng(9000/SCALE-256,5000/SCALE)}));
  await page.locator('#biSave').click();
  await page.locator('#biPreviewServer').click();
  await page.locator('#biServerStopped').check();
  // Logs panel is intentionally hidden while Event Manager is open.
  // The existing write-key input is still read by the shared Worker client.
  await page.locator('#nitradoWriteKey').evaluate(el=>{
    el.value='fake-write-key-12-characters';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#biUploadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Permission denied');
  await expect(page.locator('#biServerPreview')).toContainText('No file upload was verified');
  expect(attempts).toBe(1);
  await expect(page.locator('#biUploadServer')).toBeDisabled();
});


test('Event Manager uploads preserve exact original XML declaration, comments, indentation and line endings',async({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const eventPath=mission+'/db/events.xml';
  const positionPath=mission+'/cfgeventspawns.xml';
  // Two real-world formatting conventions: CRLF/tabs for events and LF/spaces
  // for the fixed spawn position file. Neither may be serialized wholesale.
  const originals={
    [eventPath]:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+
      '<!-- Custom world events: keep this exact comment &amp; spacing -->\r\n'+
      '<events>\r\n\t<!-- Existing vehicle configuration -->\r\n'+
      '\t<event name="VehicleVanilla">\r\n\t\t<nominal>1</nominal>\r\n'+
      '\t\t<children><child type="OffroadHatchback"/></children>\r\n\t</event>\r\n</events>\r\n',
    [positionPath]:'<?xml version="1.0" encoding="UTF-8"?>\n'+
      '<!-- Position entries manually maintained -->\n'+
      '<eventposdef>\n  <event name="VehicleVanilla">\n'+
      '    <pos x="1100" z="5000" a="90"/>\n  </event>\n</eventposdef>\n'
  };
  const uploaded={};
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const req=route.request(),u=new URL(req.url()),dir=u.searchParams.get('dir');
    let status=200,response={ok:true};
    if(u.pathname==='/api/files/list'){
      if(!dir)response={root:noftp,dir:noftp,entries:[]};
      else if(dir===mission)response={root:noftp,dir,entries:[{name:'db',type:'directory',path:mission+'/db'}]};
      else{status=404;response={error:'Missing directory'}}
    }else if(u.pathname==='/api/files/read'){
      const path=u.searchParams.get('file');
      if(Object.hasOwn(originals,path))response={path,content:originals[path],sha256:(path===eventPath?'a':'b').repeat(64)};
      else{status=404;response={error:'Missing XML'}}
    }else if(u.pathname==='/api/files/write'){
      const input=req.postDataJSON();
      uploaded[input.path]=input.content;
      response={verified:true,backupPath:input.path+'.buildit-backup-test'};
    }else{status=404;response={error:'Unavailable'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='testing-read-access');
  await page.locator('#nitradoWriteKey').evaluate(el=>el.value='testing-write-access');
  await page.locator('#biToggle').click();
  await page.locator('#biAdvanced').evaluate(el=>el.open=true);
  await page.locator('#biLoadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Server XML reloaded');
  await page.locator('#biName').fill('VehicleFormattingTest');
  await page.locator('#biVehicleSearch').fill('OffroadHatchback');
  await page.locator('#biPick').click();
  await page.evaluate(()=>map.fire('click',{latlng:L.latLng(7000/SCALE-256,5000/SCALE)}));
  await page.locator('#biSave').click();
  await page.locator('#biPreviewServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('READY');
  await page.locator('#biServerStopped').check();
  page.on('dialog',d=>d.accept());
  await page.locator('#biUploadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('UPLOAD VERIFIED');
  await expect(page.locator('#biDraftCount')).toHaveText('0 saved');
  await expect(page.locator('#biUploadServer')).toBeDisabled();
  expect(Object.keys(uploaded).sort()).toEqual(Object.keys(originals).sort());
  for(const [path,source] of Object.entries(originals)){
    const result=uploaded[path];
    expect(result).toBeTruthy();
    const closing=path===eventPath?'</events>':'</eventposdef>';
    const at=source.indexOf(closing);
    expect(result.startsWith(source.slice(0,at))).toBe(true);
    expect(result.endsWith(source.slice(at))).toBe(true);
    expect((result.match(/<\?xml/g)||[]).length).toBe(1);
    expect((result.match(/<event name="VehicleFormattingTest">/g)||[]).length).toBe(1);
    expect((result.match(/<event name="VehicleVanilla">/g)||[]).length).toBe(1);
    if(path===eventPath){
      expect(result).toContain('\r\n\t<event name="VehicleFormattingTest">');
      expect(result).toContain('\r\n\t\t<nominal>1</nominal>');
      expect(result.replace(/\r\n/g,'')).not.toContain('\n');
      expect(result).toContain('<!-- Existing vehicle configuration -->');
    }else{
      expect(result).toContain('\n  <event name="VehicleFormattingTest">');
      expect(result).toContain('\n    <pos x="5000"');
      expect(result).not.toContain('\r\n');
      expect(result).toContain('<!-- Position entries manually maintained -->');
    }
    const parsed=await page.evaluate(({xml,root})=>{
      const doc=new DOMParser().parseFromString(xml,'application/xml');
      return {root:doc.documentElement.nodeName,error:!!doc.querySelector('parsererror'),events:doc.getElementsByTagName('event').length};
    },{xml:result,root:path===eventPath?'events':'eventposdef'});
    expect(parsed.error).toBe(false);
    expect(parsed.root).toBe(path===eventPath?'events':'eventposdef');
    expect(parsed.events).toBe(2);
  }
});

test('Event Manager blocks non UTF-8 XML instead of silently rewriting encoding',async({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const req=route.request(),u=new URL(req.url()),dir=u.searchParams.get('dir');
    const path=u.searchParams.get('file');
    let status=200,response={ok:true};
    if(u.pathname==='/api/files/list'){
      if(!dir)response={root:noftp,dir:noftp,entries:[]};
      else if(dir===mission)response={root:noftp,dir,entries:[{name:'db',path:mission+'/db',type:'directory'}]};
      else{status=404;response={error:'No such folder'}}
    }else if(u.pathname==='/api/files/read'){
      response={path,sha256:'c'.repeat(64),content:path.endsWith('/events.xml')?
        '<?xml version="1.0" encoding="ISO-8859-1"?><events></events>':
        '<?xml version="1.0" encoding="UTF-8"?><eventposdef></eventposdef>'};
    }else{status=404;response={error:'Blocked'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-key');
  await page.locator('#biToggle').click();
  await page.locator('#biAdvanced').evaluate(el=>el.open=true);
  await page.locator('#biLoadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Nitrado reload failed');
  await expect(page.locator('#biServerPreview')).toContainText('ISO-8859-1 encoding');
  await expect(page.locator('#biUploadServer')).toBeDisabled();
  // Refuse the invalid original before building a replacement XML document.
});

test('Event Manager shows the simplified vehicle flow and auto-syncs live XML on Review',async({page})=>{
  const noftp='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const ep=mission+'/db/events.xml',pp=mission+'/cfgeventspawns.xml';
  const calls=[];
  await page.addInitScript(()=>{
    localStorage.setItem('buildit_events_drafts_v1',JSON.stringify([{
      name:'VehicleQuickFlow',kind:'vehicle',x:3567,z:9367,a:45,vehicle:'OffroadHatchback'
    }]));
  });
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const url=new URL(route.request().url());
    calls.push({path:url.pathname,method:route.request().method()});
    let status=200,body;
    if(url.pathname==='/api/files/list'){
      const dir=url.searchParams.get('dir');
      if(!dir)body={root:noftp,dir:noftp,entries:[]};
      else if(dir===mission)body={root:noftp,dir,entries:[{name:'db',type:'directory',path:mission+'/db'}]};
      else{status=404;body={error:'Not found'}}
    }else if(url.pathname==='/api/files/read'){
      const p=url.searchParams.get('file');
      if(p===ep)body={path:p,content:'<events><event name="VehicleVanilla"><children><child type="OffroadHatchback"/></children></event></events>',sha256:'a'.repeat(64)};
      else if(p===pp)body={path:p,content:'<eventposdef><event name="VehicleVanilla"><pos x="9" z="9" a="1"/></event></eventposdef>',sha256:'b'.repeat(64)};
      else{status=404;body={error:'Missing'}}
    }else{status=404;body={error:'Unavailable'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-access');
  await page.locator('#biToggle').click();
  await expect(page.locator('#biPanel')).toBeVisible();
  await expect(page.locator('#biDraftCount')).toHaveText('1 saved');
  await expect(page.locator('#biSave')).toHaveText('Save spawn');
  await expect(page.locator('#biPreviewServer')).toBeEnabled();
  await expect(page.locator('#biUploadServer')).toBeDisabled();
  await expect(page.locator('#biAdvanced')).not.toHaveAttribute('open','');
  await expect(page.locator('#biLoadServer')).toBeHidden();
  await expect(page.locator('#biExportEvents')).toBeHidden();
  await page.locator('#biPreviewServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('READY');
  await expect(page.locator('#biServerPreview')).toContainText('FORMAT VALIDATED');
  await expect(page.locator('#biServerPreview')).toContainText('Valid XML');
  await expect(page.locator('#biServerPreview')).toContainText('VehicleQuickFlow');
  await expect(page.locator('#biUploadServer')).toBeEnabled();
  expect(calls.filter(c=>c.path==='/api/files/read')).toHaveLength(2);
  expect(calls.every(c=>c.method==='GET')).toBe(true);
  await page.locator('#biAdvanced').evaluate(el=>el.open=true);
  await expect(page.locator('#biExportEvents')).toBeVisible();
});


test('Duplicate XML declarations can be repaired safely without touching original event content',async({page})=>{
  const check=await page.evaluate(()=>{
    const src='<?xml version="1.0" encoding="UTF-8"?>\r\n'+
      '<?xml version="1.0"?>\r\n<events>\r\n  <!-- Keep all existing data -->\r\n  <event name="VehicleOld"/>\r\n</events>\r\n';
    const result=window.BUILD_IT_XML.repairDuplicateDeclarations(src,'events');
    const parsed=window.BUILD_IT_XML.validate(result.content,'events');
    const clean='<?xml version="1.0" encoding="UTF-8"?>\r\n<events>\r\n  <!-- Keep all existing data -->\r\n  <event name="VehicleOld"/>\r\n</events>\r\n';
    let rejected=false;
    try{window.BUILD_IT_XML.repairDuplicateDeclarations('<?xml version="1.0"?><events><broken></events>','events')}
    catch(e){rejected=e.message.includes('XML is invalid')}
    return {changed:result.changed,removed:result.removed,same:result.content===clean,root:parsed.documentElement.nodeName,rejected};
  });
  expect(check).toEqual({changed:true,removed:1,same:true,root:'events',rejected:true});
});

test('Nitrado File Manager offers explicit duplicate header repair, no automatic upload',async({page})=>{
  const root='/games/ni123/noftp',path=root+'/events.xml';
  const broken='<?xml version="1.0" encoding="UTF-8"?>\n<?xml version="1.0"?>\n<events><event name="VehicleOld"/></events>';
  const writes=[];
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const url=new URL(route.request().url());
    let response={ok:true},status=200;
    if(url.pathname==='/api/files/list')
      response={root,dir:root,entries:[{name:'events.xml',path,type:'file',size:broken.length}]};
    else if(url.pathname==='/api/files/read')
      response={path,content:broken,sha256:'a'.repeat(64)};
    else if(url.pathname==='/api/files/write'){
      writes.push(route.request().postDataJSON());
      response={verified:true,backupPath:path+'.backup'};
    }else{status=404;response={error:'Not found'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-access');
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#fmBrowse').click();
  await page.locator('.fm-entry').filter({hasText:'events.xml'}).click();
  await expect(page.locator('#fmRepairXml')).toBeVisible();
  await expect(page.locator('#fmStatus')).toContainText('Duplicate XML declaration detected');
  expect(writes).toHaveLength(0);
  await page.locator('#fmRepairXml').click();
  await expect(page.locator('#fmRepairXml')).toBeHidden();
  await expect(page.locator('#fmStatus')).toContainText('Removed 1 duplicate XML');
  const repaired=await page.locator('#fmEditor').inputValue();
  expect((repaired.match(/<\?xml/g)||[])).toHaveLength(1);
  expect(repaired).toContain('VehicleOld');
  expect(writes).toHaveLength(0);
});

test('Event Manager explicitly approves removing a pre-existing duplicate XML header before upload',async({page})=>{
  const root='/games/ni5774718_3/noftp';
  const mission='/games/ni5774718_3/ftproot/dayzps_missions/dayzOffline.chernarusplus';
  const events=mission+'/db/events.xml',positions=mission+'/cfgeventspawns.xml';
  const eventOriginal='<?xml version="1.0" encoding="UTF-8"?>\r\n<?xml version="1.0"?>\r\n'+
    '<events>\r\n\t<!-- keep me -->\r\n\t<event name="VehicleOld"><children><child type="OffroadHatchback"/></children></event>\r\n</events>\r\n';
  const positionOriginal='<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<eventposdef><event name="VehicleOld"><pos x="4" z="5" a="1"/></event></eventposdef>';
  let uploads=[];
  await page.addInitScript(()=>{
    localStorage.setItem('buildit_events_drafts_v1',JSON.stringify([
      {name:'VehicleRepairSafe',kind:'vehicle',x:4656,z:9111,a:0,vehicle:'OffroadHatchback'}
    ]));
  });
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const req=route.request(),u=new URL(req.url()),dir=u.searchParams.get('dir');
    let status=200,data={ok:true};
    if(u.pathname==='/api/files/list'){
      if(!dir)data={root,dir:root,entries:[]};
      else if(dir===mission)data={root,dir,entries:[{name:'db',type:'directory',path:mission+'/db'}]};
      else{status=404;data={error:'Not found'}}
    }else if(u.pathname==='/api/files/read'){
      const path=u.searchParams.get('file');
      data={path,content:path===events?eventOriginal:positionOriginal,sha256:(path===events?'a':'b').repeat(64)};
    }else if(u.pathname==='/api/files/write'){
      uploads.push(req.postDataJSON());
      data={verified:true,backupPath:req.postDataJSON().path+'.backup'};
    }else{status=404;data={error:'Not found'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-access');
  await page.locator('#nitradoWriteKey').evaluate(el=>el.value='random-write-key');
  await page.locator('#biToggle').click();
  await page.locator('#biPreviewServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('XML REPAIR NEEDED');
  await expect(page.locator('#biServerPreview')).toContainText('events.xml: 1 extra declaration');
  await expect(page.locator('#biRepairConfirm')).toBeVisible();
  await page.locator('#biServerStopped').check();
  await page.locator('#biUploadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('Approve removing the duplicate XML headers');
  expect(uploads).toHaveLength(0);
  await page.locator('#biRepairAcknowledge').check();
  page.on('dialog',d=>d.accept());
  await page.locator('#biUploadServer').click();
  await expect(page.locator('#biServerPreview')).toContainText('UPLOAD VERIFIED');
  expect(uploads).toHaveLength(2);
  const writtenEvents=uploads.find(x=>x.path===events);
  expect(writtenEvents.content).toContain('<!-- keep me -->');
  expect(writtenEvents.content).toContain('VehicleOld');
  expect(writtenEvents.content).toContain('VehicleRepairSafe');
  expect((writtenEvents.content.match(/<\?xml/g)||[])).toHaveLength(1);
  expect(writtenEvents.content).toContain('\r\n\t<event name="VehicleRepairSafe">');
  expect(uploads.find(x=>x.path===positions).content.match(/<\?xml/g)).toHaveLength(1);
  await expect(page.locator('#biDraftCount')).toHaveText('0 saved');
});


test('Shared format validator accepts valid XML and JSON, rejects broken structure',async({page})=>{
  const checks=await page.evaluate(()=>{
    const run=(path,text)=>{
      try{return {ok:true,...window.BUILD_IT_FORMAT.validate(path,text)}}catch(e){return {ok:false,error:e.message}}
    };
    return {
      validXml:run('db/events.xml','<?xml version="1.0" encoding="UTF-8"?>\n<events><!-- hi --><event name="CarTest"/></events>'),
      duplicateXml:run('db/events.xml','<?xml version="1.0"?>\n<?xml version="1.0"?>\n<events/>'),
      wrongRoot:run('cfgeventspawns.xml','<events/>'),
      malformedXml:run('db/events.xml','<events><event></events>'),
      goodJson:run('cfgGameplay.json','{"version":130,"GeneralData":{}}'),
      brokenJson:run('cfgGameplay.json','{"version":130,}'),
      objectSpawn:run('custom/village.json','{"Objects":[{"name":"Land_House_1W01","pos":[4400,0,10200]}]}'),
      invalidSpawner:run('custom/village.json','{"Objects":[{"name":"Land_House_1W01","pos":["4400",0,10200]}]}'),
      invalidRoot:run('config.json','true'),
      maxBytes:run('event.json','{"data":"'+ 'x'.repeat(512*1024) +'"}')
    };
  });
  expect(checks.validXml.ok).toBe(true);
  expect(checks.validXml.detail).toContain('root <events>');
  expect(checks.duplicateXml.ok).toBe(false);
  expect(checks.duplicateXml.error).toContain('Invalid XML');
  expect(checks.wrongRoot.ok).toBe(false);
  expect(checks.wrongRoot.error).toContain('Expected <eventposdef>');
  expect(checks.malformedXml.ok).toBe(false);
  expect(checks.goodJson.ok).toBe(true);
  expect(checks.goodJson.format).toBe('JSON');
  expect(checks.brokenJson.ok).toBe(false);
  expect(checks.brokenJson.error).toContain('Invalid JSON');
  expect(checks.objectSpawn.ok).toBe(true);
  expect(checks.objectSpawn.detail).toContain('1 objects');
  expect(checks.invalidSpawner.ok).toBe(false);
  expect(checks.invalidSpawner.error).toContain('pos must contain three numeric');
  expect(checks.invalidRoot.ok).toBe(false);
  expect(checks.maxBytes.ok).toBe(false);
  expect(checks.maxBytes.error).toContain('512 KB');
});

test('Nitrado File Manager clearly validates JSON and disables upload when edited JSON breaks',async({page})=>{
  const root='/games/ni5774718_3/ftproot';
  const file=root+'/dayzps_missions/dayzOffline.chernarusplus/cfgGameplay.json';
  let serverContent='{"version":130,"GeneralData":{"disableBaseDamage":false}}';
  const uploads=[];
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const path=u.searchParams.get('file');
    let status=200,body={ok:true};
    if(u.pathname==='/api/files/list')body={root,dir:root,entries:[{name:'cfgGameplay.json',path:file,type:'file'}]};
    else if(u.pathname==='/api/files/read'&&path===file)
      body={path:file,content:serverContent,sha256:'a'.repeat(64)};
    else if(u.pathname==='/api/files/write'){
      const content=route.request().postDataJSON();
      uploads.push(content);
      serverContent=content.content;
      body={verified:true,backupPath:file+'.backup'};
    }else{status=404;body={error:'Missing route'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-access');
  await page.locator('#nitradoWriteKey').evaluate(el=>el.value='random-test-write-key');
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#fmBrowse').click();
  await page.locator('.fm-entry').filter({hasText:'cfgGameplay.json'}).click();
  await expect(page.locator('#fmValidationStatus')).toContainText('VALID');
  await expect(page.locator('#fmSave')).toBeEnabled();
  await page.locator('#fmEditor').fill('{"version":130,}');
  await expect(page.locator('#fmValidationStatus')).toContainText('INVALID');
  await expect(page.locator('#fmValidationStatus')).toContainText('Invalid JSON');
  await expect(page.locator('#fmSave')).toBeDisabled();
  expect(uploads).toHaveLength(0);
  await page.locator('#fmEditor').fill('{"version":130,"GeneralData":{}}');
  await page.locator('#fmValidate').click();
  await expect(page.locator('#fmValidationStatus')).toContainText('VALID');
  await expect(page.locator('#fmSave')).toBeEnabled();
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#fmSave').click();
  await expect(page.locator('#fmStatus')).toContainText('Upload verified');
  expect(uploads).toHaveLength(1);
  expect(uploads[0].content).toBe('{"version":130,"GeneralData":{}}');
});

test('Nitrado File Manager blocks invalid XML and wrong DayZ XML root',async({page})=>{
  const root='/games/ni123/noftp',path=root+'/db/events.xml';
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    let status=200,body={ok:true};
    if(u.pathname==='/api/files/list')body={root,dir:root,entries:[{name:'events.xml',path,type:'file'}]};
    else if(u.pathname==='/api/files/read')body={path,sha256:'a'.repeat(64),content:'<events/>'};
    else if(u.pathname==='/api/files/write'){throw Error('Unsafe upload attempted during test')}
    else{status=404;body={error:'Not found'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test-read-access');
  await page.locator('#logToggle').click();
  await page.locator('#logConnectionDetails').evaluate(el=>el.open=true);
  await page.locator('#logServerFiles').evaluate(el=>el.open=true);
  await page.locator('#fmBrowse').click();
  await page.locator('.fm-entry').filter({hasText:'events.xml'}).click();
  await expect(page.locator('#fmValidationStatus')).toContainText('VALID');
  await page.locator('#fmEditor').fill('<eventposdef/>');
  await expect(page.locator('#fmValidationStatus')).toContainText('Expected <events>');
  await expect(page.locator('#fmSave')).toBeDisabled();
  await page.locator('#fmEditor').fill('<?xml version="1.0"?>\n<?xml version="1.0"?>\n<events/>');
  await expect(page.locator('#fmValidationStatus')).toContainText('INVALID');
  await expect(page.locator('#fmSave')).toBeDisabled();
});


test('Server Log Viewer keeps status and activity prominent with settings collapsed by default',async({page})=>{
  await page.locator('#logToggle').evaluate(el=>el.click());
  await expect(page.locator('#logPanel')).toBeVisible();
  await expect(page.locator('#logActivity')).toBeVisible();
  await expect(page.locator('#nitradoSyncStatus')).toBeVisible();
  await expect(page.locator('#nitradoSyncNow')).toBeVisible();
  await expect(page.locator('#logConnectionDetails')).not.toHaveAttribute('open','');
  await expect(page.locator('#logManualDetails')).not.toHaveAttribute('open','');
  await expect(page.locator('#logServerFiles')).not.toHaveAttribute('open','');
  await expect(page.locator('#nitradoWorkerUrl')).toBeHidden();
  await expect(page.locator('#logFileInput')).toBeHidden();
  await expect(page.locator('#fileManager')).toBeHidden();
  await expect(page.locator('#logActions')).toBeHidden();
  await page.locator('#logConnectionDetails summary').click();
  await expect(page.locator('#nitradoWorkerUrl')).toBeVisible();
  await page.locator('#logServerFiles summary').click();
  await expect(page.locator('#fileManager')).toBeVisible();
});

test('One Filters dropdown controls map, spawns, admin logs and players without mixing settings',async({page})=>{
  await page.locator('#filterToggle').click();
  const menu=page.locator('#filterViewSelect');
  await expect(menu).toBeVisible();
  await expect(page.locator('[data-filter-view="map"]')).toBeVisible();
  await expect(page.locator('[data-filter-view="admin"]')).toBeHidden();
  await menu.selectOption('spawns');
  await expect(page.locator('[data-filter-view="spawns"]')).toBeVisible();
  await page.locator('#filterAllOn').click();
  expect(await page.locator('#filterPanel input[id^="filterSpawn_"]').evaluateAll(els=>els.every(e=>e.checked))).toBe(true);
  await expect(page.locator('#filterPlaceNames')).toBeChecked();
  await menu.selectOption('admin');
  await expect(page.locator('#logActions')).toBeVisible();
  await expect(page.locator('#logActionFilterSummary')).toHaveText('17 of 17 event types visible');
  await page.locator('#logAllActionsOff').click();
  await expect(page.locator('#logActionFilterSummary')).toHaveText('0 of 17 event types visible');
  expect(await page.evaluate(()=>[...logActionState.values()].every(x=>!x))).toBe(true);
  expect(await page.locator('#filterPanel input[id^="filterSpawn_"]').evaluateAll(els=>els.every(e=>e.checked))).toBe(true);
  await page.locator('input[data-log-action="kill"]').check();
  await expect(page.locator('#logActionFilterSummary')).toHaveText('1 of 17 event types visible');
  expect(await page.evaluate(()=>logActionState.get('kill'))).toBe(true);
  await menu.selectOption('players');
  await expect(page.locator('#logLatestPositionsOnly')).toBeVisible();
  await expect(page.locator('#logPlayerSearch')).toBeVisible();
  await expect(page.locator('#logPlayers')).toBeVisible();
  await page.locator('#logLatestPositionsOnly').uncheck();
  await expect(page.locator('#logLatestPositionsOnly')).not.toBeChecked();
  await menu.selectOption('map');
  await expect(page.locator('#filterPlaceNames')).toBeVisible();
  await expect(page.locator('[data-filter-view="spawns"]')).toBeHidden();
});

test('Unified Filters menu fits phone viewport without horizontal overflow',async({page})=>{
  await page.locator('#filterToggle').click();
  const viewport=page.viewportSize();
  for(const value of ['map','spawns','admin','players']){
    await page.locator('#filterViewSelect').selectOption(value);
    const b=await page.locator('#filterPanel').boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x+b.width).toBeLessThanOrEqual(viewport.width+1);
    const hasOverflow=await page.locator('#filterPanel').evaluate(el=>el.scrollWidth>el.clientWidth+1);
    expect(hasOverflow,'Unexpected horizontal overflow for '+value).toBe(false);
  }
});


test('Professional UI uses consistent line icons without changing controls or labels',async({page})=>{
  await expect(page.locator('#placeSearchBox .bi-search-icon svg.bi-icon')).toHaveCount(1);
  for(const [id,icon] of [
    ['filterToggle','sliders'],['logToggle','logs'],['biToggle','wrench'],
    ['nitradoSyncNow','refresh'],
    ['biSave','save'],['biPreviewServer','checkfile'],
    ['biUploadServer','cloud'],['builditThemeToggle','sun']
  ]){
    const button=page.locator('#'+id);
    await expect(button.locator(':scope > svg.bi-icon')).toHaveCount(1);
    await expect(button.locator(':scope > svg.bi-icon')).toHaveAttribute('data-icon',icon);
    await expect(button.locator(':scope > svg.bi-icon')).toHaveAttribute('aria-hidden','true');
  }
  await expect(page.locator('#biToggle')).toHaveText('Event Manager');
  await expect(page.locator('#logToggle')).toHaveText('Logs');
  await expect(page.locator('#filterToggle')).toHaveText('Filters');
  const viewport=page.viewportSize();
  if(viewport.width>=921){
    await expect(page.locator('#builditBrand')).toBeVisible();
    await expect(page.locator('#builditBrand')).toContainText('Build It!++');
  }else{
    await expect(page.locator('#builditBrand')).toBeHidden();
  }
  await page.locator('#builditThemeToggle').click();
  await expect(page.locator('#builditThemeToggle > svg.bi-icon')).toHaveAttribute('data-icon','moon');
  await expect(page.locator('#builditThemeToggle')).toHaveAttribute('aria-label','Switch to dark mode');
  await expect(page.locator('#builditMapStyleToggle > svg.bi-icon')).toHaveCount(1);
});

test('Professional panel styling remains legible and functional in both themes',async({page})=>{
  for(const theme of ['dark','light']){
    const current=await page.locator('html').getAttribute('data-buildit-theme');
    if(current!==theme)await page.locator('#builditThemeToggle').click();
    await page.locator('#filterToggle').click();
    await expect(page.locator('#filterPanel')).toBeVisible();
    await expect(page.locator('#filterViewSelect')).toBeVisible();
    await page.locator('#filterViewSelect').selectOption('admin');
    await expect(page.locator('#logActions')).toBeVisible();
    const style=await page.locator('#filterPanel').evaluate(el=>{
      const cs=getComputedStyle(el);
      const input=getComputedStyle(document.querySelector('#filterViewSelect'));
      return {radius:parseFloat(cs.borderTopLeftRadius),background:cs.backgroundColor,border:cs.borderTopColor,
        inputRadius:parseFloat(input.borderTopLeftRadius),font:cs.fontFamily};
    });
    expect(style.radius).toBeGreaterThanOrEqual(11);
    expect(style.inputRadius).toBeGreaterThanOrEqual(8);
    expect(style.font).toMatch(/Inter|Segoe UI/i);
    await page.locator('#filterToggle').click();
  }
  await page.locator('#logToggle').click();
  await expect(page.locator('#logPanel')).toBeVisible();
  await expect(page.locator('#logActivity')).toBeVisible();
  await page.locator('#logConnectionDetails summary').click();
  await expect(page.locator('#nitradoWorkerUrl')).toBeVisible();
  await page.locator('#logServerFiles summary').click();
  await expect(page.locator('#fileManager')).toBeVisible();
});

test('File Manager and event drafting keep working with decorated controls',async({page})=>{
  await page.locator('#biToggle').click();
  await expect(page.locator('#biPanel')).toBeVisible();
  await expect(page.locator('#biSave')).toHaveText('Save spawn');
  await expect(page.locator('#biPick > svg.bi-icon')).toHaveCount(1);
  await page.locator('#biPick').click();
  await expect(page.locator('#biPick > svg.bi-icon')).toHaveCount(1);
  await expect(page.locator('#biPick')).toContainText('Click a map location');
  await page.locator('#biPick').click();
  await expect(page.locator('#biPick')).toContainText('Pick on map');
  await expect(page.locator('#biPick > svg.bi-icon')).toHaveCount(1);
  const root='/games/ni123/noftp';
  await page.route('https://buildit-nitrado-logs.davaydresnikov.workers.dev/**',async route=>{
    const u=new URL(route.request().url());
    const dir=u.searchParams.get('dir');
    if(u.pathname==='/api/files/list'){
      const body={root,dir:dir||root,entries:[{name:'db',path:root+'/db',type:'directory'},{name:'events.xml',path:root+'/events.xml',type:'file'}]};
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    await route.fulfill({status:404,contentType:'application/json',body:'{"error":"unavailable"}'});
  });
  await page.locator('#biClose').click();
  await page.locator('#logToggle').click();
  await page.locator('#logServerFiles summary').click();
  await page.locator('#nitradoWorkerUrl').evaluate(el=>el.value='https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').evaluate(el=>el.value='test_key');
  await page.locator('#fmBrowse').click();
  await expect(page.locator('.fm-entry')).toHaveCount(2);
  await expect(page.locator('.fm-entry').first()).toHaveText('db');
  await expect(page.locator('.fm-entry').first().locator('svg.bi-icon')).toHaveAttribute('data-icon','folder');
  await expect(page.locator('.fm-entry').last()).toHaveText('events.xml');
  await expect(page.locator('.fm-entry').last().locator('svg.bi-icon')).toHaveAttribute('data-icon','file');
});

test('New design stays inside viewport on desktop and mobile',async({page})=>{
  const vp=page.viewportSize();
  for(const id of ['filterToggle','logToggle','biToggle','placeSearchBox']){
    const b=await page.locator('#'+id).boundingBox();
    expect(b.x,id).toBeGreaterThanOrEqual(0);
    expect(b.x+b.width,id).toBeLessThanOrEqual(vp.width+1);
  }
  await page.locator('#filterToggle').click();
  for(const option of ['map','spawns','admin','players']){
    await page.locator('#filterViewSelect').selectOption(option);
    const b=await page.locator('#filterPanel').boundingBox();
    expect(b.x,option).toBeGreaterThanOrEqual(0);
    expect(b.x+b.width,option).toBeLessThanOrEqual(vp.width+1);
    expect(await page.locator('#filterPanel').evaluate(el=>el.scrollWidth-el.clientWidth),option).toBeLessThanOrEqual(2);
  }
});


test('Light mode has high-contrast readable text throughout filters, logs, events and file manager',async({page})=>{
  await page.locator('#builditThemeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme','light');
  const cssTokens=await page.evaluate(()=>{
    const style=getComputedStyle(document.documentElement);
    return {
      foreground:style.getPropertyValue('--bi-text').trim(),
      muted:style.getPropertyValue('--bi-muted').trim(),
      subtle:style.getPropertyValue('--bi-subtle').trim(),
      panel:style.getPropertyValue('--bi-panel').trim()
    };
  });
  expect(cssTokens.foreground).toBe('#1b3345');
  expect(cssTokens.muted).toBe('#425c6e');
  expect(cssTokens.subtle).toBe('#526d7c');
  const inspect=async(items,backgroundSelector)=>{
    const result=await page.evaluate(({items,backgroundSelector})=>{
      const parse=str=>{
        const numbers=String(str).match(/[\d.]+/g);
        return numbers?numbers.slice(0,3).map(Number):[];
      };
      const luminance=rgb=>{
        const out=rgb.map(x=>{
          x=x/255;
          return x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4);
        });
        return 0.2126*out[0]+0.7152*out[1]+0.0722*out[2];
      };
      const background=parse(getComputedStyle(document.querySelector(backgroundSelector)).backgroundColor);
      return items.map(selector=>{
        const element=document.querySelector(selector);
        const color=parse(getComputedStyle(element).color);
        const high=Math.max(luminance(background),luminance(color));
        const low=Math.min(luminance(background),luminance(color));
        return {selector,contrast:(high+0.05)/(low+0.05),color:getComputedStyle(element).color};
      });
    },{items,backgroundSelector});
    for(const entry of result){
      expect(entry.contrast,'Poor contrast for '+entry.selector+' ('+entry.color+')').toBeGreaterThanOrEqual(4.5);
    }
  };
  await page.locator('#filterToggle').click();
  await inspect(['#filterPanel','.filter-title','#filterPanel .filter-row','#filterPanel .filter-menu-label','#filterPanel .filter-note'],'#filterPanel');
  await page.locator('#filterToggle').click();
  await page.locator('#logToggle').click();
  await inspect(['#logPanel','#logPanel .log-title','#logPanel .log-head-note','#logPanel .log-filter-hint','#logPanel .log-compact-help'],'#logPanel');
  await page.locator('#logServerFiles summary').click();
  await inspect(['#logPanel #fileManager','#logPanel #fileManager .fm-label','#logPanel #fileManager .fm-note','#logPanel #fileManager .fm-path'],'#logPanel');
  await page.locator('#logToggle').click();
  await page.locator('#biToggle').click();
  await inspect(['#biPanel','#biPanel .biHeader .biSmall','#biPanel label[for="biName"]','#biPanel .biDraftCount'],'#biPanel');
  await page.locator('#biToggle').click();
  await page.locator('#builditThemeToggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-buildit-theme','dark');
});
