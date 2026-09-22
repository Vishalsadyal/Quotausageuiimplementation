const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..');

test.describe('Jobs Smart Outreach collection flow', () => {
  test('collects unique HR emails through background message API', async () => {
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

      // Start from clean state
      await page.evaluate(async () => {
        await chrome.runtime.sendMessage({ type: 'JSO_CLEAR_CONTACTS' });
        await chrome.runtime.sendMessage({ type: 'JSO_CLEAR_LOGS' });
      });

      const result = await page.evaluate(async () => {
        const contactsToAdd = [
          {
            name: 'Ria Sharma',
            title: 'HR Manager',
            company: 'TechNova',
            email: 'ria.sharma@technova.com',
            category: 'Software Engineering',
            linkedinUrl: 'https://www.linkedin.com/in/ria-sharma/',
          },
          {
            name: 'Aman Verma',
            title: 'Talent Acquisition',
            company: 'CloudNest',
            email: 'aman@cloudnest.io',
            category: 'DevOps / Cloud',
            linkedinUrl: 'https://www.linkedin.com/in/aman-verma/',
          },
          {
            // duplicate email; should not increase count
            name: 'Ria S.',
            title: 'Recruiter',
            company: 'TechNova',
            email: 'ria.sharma@technova.com',
            category: 'Software Engineering',
            linkedinUrl: 'https://www.linkedin.com/in/ria-sharma/',
          },
        ];

        for (const contact of contactsToAdd) {
          await chrome.runtime.sendMessage({ type: 'JSO_ADD_CONTACT', contact });
        }

        const status = await chrome.runtime.sendMessage({ type: 'JSO_GET_STATUS' });
        const list = await chrome.runtime.sendMessage({ type: 'JSO_GET_CONTACTS' });
        const logs = await chrome.runtime.sendMessage({ type: 'JSO_GET_LOGS' });

        return {
          status,
          contacts: list.contacts || [],
          logCount: Array.isArray(logs?.logs) ? logs.logs.length : 0,
        };
      });

      expect(result.status.count).toBe(2);
      expect(result.contacts).toHaveLength(2);
      expect(result.contacts.map((c) => c.email).sort()).toEqual([
        'aman@cloudnest.io',
        'ria.sharma@technova.com',
      ]);
      expect(result.logCount).toBeGreaterThan(0);

      // Popup should show updated count
      await expect(page.locator('#countDisplay')).toHaveText('2');
    } finally {
      await context.close();
    }
  });
});
