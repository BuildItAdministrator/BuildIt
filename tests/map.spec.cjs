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
  expect(await page.locator('#filterPanel input[type="checkbox"]:not(#filterPlaceNames)').evaluateAll(
    elements => elements.every(input => !input.checked)
  )).toBe(true);
  await page.locator('#filterToggle').click();
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
  await page.locator('#nitradoWorkerUrl').fill('https://buildit-nitrado-logs.davaydresnikov.workers.dev');
  await page.locator('#nitradoAccessKey').fill('test_map_sync_key_0123456789');
  await page.locator('#fmFindMission').click();
  await expect(page.locator('#fmStatus')).toContainText('not found automatically');
  await expect(page.locator('#fmStatus')).toContainText('No files were changed');
  expect(posts).toBe(0);
});
