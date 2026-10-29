const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../server-tools-extensions.js');

const grouped = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<playerspawnpoints>',
  '  <fresh>',
  '    <spawn_params><min_dist_player>65</min_dist_player></spawn_params>',
  '    <generator_posbubbles>',
  '      <group name="West" lifetime="300">',
  '        <pos x="100" z="200" />',
  '        <pos x="101" z="201" />',
  '      </group>',
  '      <group name="East" lifetime="300">',
  '        <pos x="900" z="800" />',
  '      </group>',
  '    </generator_posbubbles>',
  '  </fresh>',
  '  <hop><generator_posbubbles><pos x="1000" z="1100" /></generator_posbubbles></hop>',
  '  <travel><generator_posbubbles><pos x="1200" z="1300" /></generator_posbubbles></travel>',
  '</playerspawnpoints>'
].join('\n');

test('replace mode removes all old fresh spawns and unused groups, keeping other sections', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: extensionPath });
  const result = await page.evaluate(src => {
    const output = window.BUILD_IT_SERVER_EXTENSIONS.replaceSpawnPoints(src, 555.55, 666.66, 'East');
    const doc = new DOMParser().parseFromString(output.content, 'application/xml');
    const fresh = doc.querySelector('playerspawnpoints > fresh');
    return {
      changed: output.changed,
      oldPoints: output.oldPoints,
      removedGroups: output.removedGroups,
      points: [...fresh.querySelectorAll('generator_posbubbles pos')].map(p => [p.getAttribute('x'), p.getAttribute('z')]),
      groups: [...fresh.querySelectorAll('generator_posbubbles group')].map(g => ({ name: g.getAttribute('name'), lifetime: g.getAttribute('lifetime') })),
      originalParams: fresh.querySelector('spawn_params min_dist_player')?.textContent,
      hopUnchanged: output.content.includes('<hop><generator_posbubbles><pos x="1000" z="1100" /></generator_posbubbles></hop>'),
      travelUnchanged: output.content.includes('<travel><generator_posbubbles><pos x="1200" z="1300" /></generator_posbubbles></travel>'),
      parserError: !!doc.querySelector('parsererror')
    };
  }, grouped);
  expect(result).toEqual({
    changed: 1,
    oldPoints: 3,
    removedGroups: 1,
    points: [['555.55', '666.66']],
    groups: [{ name: 'East', lifetime: '300' }],
    originalParams: '65',
    hopUnchanged: true,
    travelUnchanged: true,
    parserError: false
  });
});

test('replace mode also works for ungrouped spawn points', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: extensionPath });
  const result = await page.evaluate(() => {
    const src = '<playerspawnpoints><fresh><generator_posbubbles><pos x="10" z="20" /><pos x="30" z="40" /></generator_posbubbles></fresh></playerspawnpoints>';
    const output = window.BUILD_IT_SERVER_EXTENSIONS.replaceSpawnPoints(src, 1234, 5678, 'Direct positions');
    const doc = new DOMParser().parseFromString(output.content, 'application/xml');
    return {
      oldPoints: output.oldPoints,
      pos: [...doc.querySelectorAll('fresh generator_posbubbles pos')].map(p => [p.getAttribute('x'), p.getAttribute('z')]),
      groupCount: doc.querySelectorAll('fresh generator_posbubbles group').length,
      parserError: !!doc.querySelector('parsererror')
    };
  });
  expect(result).toEqual({ oldPoints: 2, pos: [['1234', '5678']], groupCount: 0, parserError: false });
});

test('invalid coordinates or group fail without producing an unsafe file', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({ path: extensionPath });
  const errors = await page.evaluate(src => {
    const replace = window.BUILD_IT_SERVER_EXTENSIONS.replaceSpawnPoints;
    const getError = fn => { try { fn(); return 'NO_ERROR'; } catch (error) { return error.message; } };
    return {
      invalidCoordinates: getError(() => replace(src, -1, 500, 'West')),
      invalidGroup: getError(() => replace(src, 123, 500, 'Missing'))
    };
  }, grouped);
  expect(errors.invalidCoordinates).toMatch(/Chernarus/);
  expect(errors.invalidGroup).toMatch(/existing fresh-spawn group/);
});

test('Spawn Point Generator UI calls replacement and not append', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../server-tools.js'), 'utf8');
  expect(source).toContain('ext.replaceSpawnPoints(source,');
  expect(source).not.toContain('ext.addSpawnPoint(source,');
  expect(source).toContain('REPLACE ALL EXISTING FRESH SPAWNS?');
});
