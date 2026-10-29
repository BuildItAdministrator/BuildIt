const { test, expect } = require('@playwright/test');
const path = require('node:path');

const corePath = path.resolve(__dirname, '../server-tools-core.js');
const spawnable = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<spawnabletypes>',
  '  <type name="CivilianSedan">',
  '    <attachments chance="0.5"><item name="CarBattery" chance="0.25"/><item name="SparkPlug" chance="0.5"/></attachments>',
  '    <attachments chance="1.0"><item name="CivilianSedan_Wheel" /></attachments>',
  '    <cargo chance="0.3"><item name="BandageDressing" chance="0.6"/></cargo>',
  '    <damage min="0.1" max="0.3"/>',
  '  </type>',
  '  <type name="CustomBikeBlue">',
  '    <attachments chance="0.5"><item name="CustomBikeBattery" chance="0.7"/></attachments>',
  '  </type>',
  '  <type name="M4A1">',
  '    <attachments chance="0.1"><item name="M4_Bttstck" chance="0.5"/></attachments>',
  '  </type>',
  '</spawnabletypes>'
].join('\n');

const events = [
  '<events>',
  ' <event name="VehicleCustomBike"><children><child type="CustomBikeBlue" /></children></event>',
  ' <event name="AnimalBear"><children><child type="M4A1" /></children></event>',
  '</events>'
].join('\n');

test('bulk preset sets groups and listed vehicle parts to 100%, keeping unrelated data', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: corePath });
  const result = await page.evaluate(({ src, events }) => {
    const core = window.BUILD_IT_SERVER_CORE;
    const candidates = core.vehicleSpawnableCandidates(src, events).vehicles;
    const next = core.makeVehicleAttachmentsCertain(src, candidates.map(c => c.name));
    const doc = new DOMParser().parseFromString(next.content, 'application/xml');
    const types = [...doc.documentElement.children].filter(el => el.nodeName === 'type');
    const sedan = types.find(el => el.getAttribute('name') === 'CivilianSedan');
    const rifle = types.find(el => el.getAttribute('name') === 'M4A1');
    const bike = types.find(el => el.getAttribute('name') === 'CustomBikeBlue');
    return {
      recognized: candidates.map(c => c.name).sort(),
      changed: next.changed,
      groupChances: [...sedan.querySelectorAll('attachments'), ...bike.querySelectorAll('attachments')].map(el => el.getAttribute('chance')),
      itemChances: [...sedan.querySelectorAll('attachments item'), ...bike.querySelectorAll('attachments item')].map(el => el.getAttribute('chance')),
      cargo: sedan.querySelector('cargo').outerHTML,
      damage: sedan.querySelector('damage').outerHTML,
      rifle: rifle.outerHTML,
      parserError: !!doc.querySelector('parsererror')
    };
  }, { src: spawnable, events });

  expect(result.recognized).toEqual(['CivilianSedan', 'CustomBikeBlue']);
  expect(result.groupChances.map(Number)).toEqual([1, 1, 1]);
  expect(result.itemChances.map(Number)).toEqual([1, 1, 1, 1]);
  expect(result.changed).toBeGreaterThan(0);
  expect(result.cargo).toContain('chance="0.3"');
  expect(result.cargo).toContain('chance="0.6"');
  expect(result.damage).toContain('max="0.3"');
  expect(result.rifle).toContain('chance="0.1"');
  expect(result.parserError).toBe(false);
});

test('single vehicle mode edits only the selected vehicle', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: corePath });
  const res = await page.evaluate(src => {
    const next = window.BUILD_IT_SERVER_CORE.makeVehicleAttachmentsCertain(src, ['CustomBikeBlue']);
    return {
      changed: next.changed,
      count: next.vehicles,
      sedanIntact: next.content.includes('<attachments chance="0.5"><item name="CarBattery" chance="0.25"/>')
    };
  }, spawnable);
  expect(res).toEqual({ changed: 2, count: 1, sedanIntact: true });
});

test('unknown classnames cannot be created, duplicates are rejected', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: corePath });
  const errors = await page.evaluate(src => {
    const edit = window.BUILD_IT_SERVER_CORE.makeVehicleAttachmentsCertain;
    const fail = fn => { try { fn(); return null; } catch (e) { return String(e.message); } };
    return {
      unknown: fail(() => edit(src, ['UnregisteredVehicle'])),
      duplicate: fail(() => edit(src, ['CivilianSedan', 'CivilianSedan']))
    };
  }, spawnable);
  expect(errors.unknown).toMatch(/absent or duplicated/);
  expect(errors.duplicate).toMatch(/Duplicate/);
});
