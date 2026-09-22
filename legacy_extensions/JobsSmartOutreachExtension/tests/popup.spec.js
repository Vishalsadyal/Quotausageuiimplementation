const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..');

test.describe('Jobs Smart Outreach extension', () => {
  test('popup renders core controls and debug buttons', async () => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !!process.env.CI,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      let [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
      }

      const extensionId = serviceWorker.url().split('/')[2];
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      await expect(page.locator('.header-title')).toHaveText('Jobs Smart Outreach');
      await expect(page.locator('#btnStart')).toBeVisible();
      await expect(page.locator('#btnDashboard')).toBeVisible();
      await expect(page.locator('#copyLogsBtn')).toBeVisible();
      await expect(page.locator('#clearLogsBtn')).toBeVisible();
      await expect(page.locator('#statusText')).toContainText(/Ready|Searching|Login required|Dashboard session expired|Extension not ready/i);

      // Verify copy logs button can be clicked without crashing popup
      await page.locator('#copyLogsBtn').click();
      await expect(page.locator('#statusText')).toContainText(/No logs yet|Copied|Copy failed/i);
    } finally {
      await context.close();
    }
  });
});
