// Smoke test: npm test (first time: npm install && npx playwright install chromium)
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export default defineConfig({
  testDir: 'tools/test',
  timeout: 120_000,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/` },
  webServer: { command: `node tools/serve.mjs ${PORT}`, url: `http://localhost:${PORT}/`, reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
