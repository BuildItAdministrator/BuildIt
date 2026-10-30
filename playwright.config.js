import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 12000 },
  retries: process.env.CI ? 1 : 0,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1', url: 'http://127.0.0.1:4173', timeout: 20000, reuseExistingServer: !process.env.CI }
});
