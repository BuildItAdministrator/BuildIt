import { test, expect } from '@playwright/test';

// UI-only smoke tests. They never authorize, upload, restart or edit a Nitrado server.
// Session flag exercises the existing static-hosted preview gate; it is not an auth test.
test.beforeEach(async ({ page }) => {
  await page.route(/\/api\//, route => route.abort());
  await page.route('https://static.xam.nu/**', route => route.abort());
  await page.addInitScript(() => sessionStorage.setItem('buildit_access_ok_v1', '1'));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#biWorkspaceHeader')).toBeVisible({ timeout: 20000 });
});

test('workspace navigation opens core panels without server writes', async ({ page }) => {
  const views = [
    ['tools', '#toolHubPanel'],
    ['events', '#biPanel'],
    ['logs', '#logPanel'],
    ['files', '#logPanel'],
    ['layers', '#filterPanel'],
    ['time', '#bwTimePanel'],
    ['doctor', '#bwDoctorPanel'],
    ['servers', '#biServerProfilePanel']
  ];
  for (const [name, panel] of views) {
    await page.locator('.bw-nav[data-view="' + name + '"]').click();
    await expect(page.locator(panel)).toBeVisible();
    if (name === 'files') {
      await expect(page.locator('#logServerFiles')).toHaveAttribute('open', '');
    }
  }
  await page.locator('.bw-nav[data-view="map"]').click();
  await expect(page.locator('#bwDoctorPanel')).toBeHidden();
});

test('tool finder filters registered tools and supports keyboard navigation', async ({ page }) => {
  await page.locator('.bw-nav[data-view="tools"]').click();
  await expect(page.locator('#stCards .st-card')).not.toHaveCount(0);
  await page.locator('#stCategory').selectOption({ label: 'Config & gameplay' });
  await expect(page.locator('#stCards')).not.toContainText('Horde Generator');
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.locator('#biCommandDialog')).toBeVisible();
  await page.locator('#bwCommandInput').fill('Horde Generator');
  await expect(page.locator('#bwCommandList .bw-palette-item')).toHaveCount(1);
  await expect(page.locator('#bwCommandList')).toContainText('Horde Generator');
  await page.keyboard.press('Escape');
  await expect(page.locator('#biCommandDialog')).toBeHidden();
});

test('map focus can be entered and restored', async ({ page }) => {
  await page.locator('#bwFocusMap').click();
  await expect(page.locator('html')).toHaveAttribute('data-buildit-focus', 'true');
  await expect(page.locator('#biWorkspaceRail')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-buildit-focus', 'false');
  await expect(page.locator('#biWorkspaceRail')).toBeVisible();
});

test('day and night planner calculates durations without uploading', async ({ page }) => {
  await page.locator('.bw-nav[data-view="time"]').click();
  await expect(page.locator('#bwDayResult')).toHaveText('1h 0m');
  await expect(page.locator('#bwNightResult')).toHaveText('15m');
  await expect(page.locator('#bwCycleResult')).toHaveText('1h 15m');
  await page.locator('#bwTimeRate').fill('0');
  await expect(page.locator('#bwDayResult')).toHaveText('—');
  await expect(page.locator('#bwCopyTime')).toBeDisabled();
});

test('server doctor is read only when no server is connected', async ({ page }) => {
  let writeAttempt = false;
  await page.route('**/api/files/write', route => { writeAttempt = true; return route.abort(); });
  await page.locator('.bw-nav[data-view="doctor"]').click();
  await expect(page.locator('#bwDoctorPanel')).toBeVisible();
  await page.locator('#bwDoctorRun').click();
  await expect(page.locator('#bwDoctorState')).toContainText(/scan stopped|connection is unavailable|scan complete/i);
  expect(writeAttempt).toBe(false);
});

test('mobile workspace remains reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#biWorkspaceRail')).toBeVisible();
  await page.locator('.bw-nav[data-view="tools"]').click();
  await expect(page.locator('#toolHubPanel')).toBeVisible();
  await expect(page.locator('#toolHubPanel')).toBeInViewport();
});
