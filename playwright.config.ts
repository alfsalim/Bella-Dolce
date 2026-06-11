import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

const PORT = process.env.PORT || '3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}/belladolce`,
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}/belladolce`,
    reuseExistingServer: !process.env.CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
