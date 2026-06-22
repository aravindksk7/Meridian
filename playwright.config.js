const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    headless: true,
  },
  webServer: {
    command: 'npx --yes serve . -p 4321 --no-clipboard',
    port: 4321,
    reuseExistingServer: true,
    timeout: 10000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
