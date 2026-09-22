const path = require('path');
const fs = require('fs');
const os = require('os');
const { test, expect, chromium } = require('@playwright/test');

const EXTENSION_PATH = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.resolve(__dirname, 'fixtures', 'linkedin-feed-replica.html');

function readFixture() {
  return fs.readFileSync(FIXTURE_PATH, 'utf8');
}

test.describe('LinkedIn feed replica collection', () => {
  test('content script scrapes emails from mocked feed posts', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jso-feed-replica-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    try {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
      }
      expect(serviceWorker).toBeTruthy();
      const extensionId = new URL(serviceWorker.url()).host;

      // Start clean
      await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
          jso_collected_hrs: [],
          jso_is_collecting: false,
          jso_active_run_id: '',
          jso_last_error: '',
          jso_debug_logs: [],
        });
      });

      const html = readFixture();
      await context.route('https://www.linkedin.com/feed/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: html,
        });
      });

      const feedPage = await context.newPage();
      await feedPage.goto('https://www.linkedin.com/feed/', { waitUntil: 'load' });

      // Open popup to send command to LinkedIn tab
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'load' });

      const sendResult = await popup.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const linkedinTab = tabs.find((t) => String(t.url || '').includes('linkedin.com/feed'));
        if (!linkedinTab?.id) return { ok: false, reason: 'linkedin_tab_not_found' };

        return new Promise((resolve) => {
          chrome.tabs.sendMessage(
            linkedinTab.id,
            { type: 'JSO_START_SCRAPE', keyword: 'we are hiring', category: 'Software Engineering' },
            (response) => {
              const err = chrome.runtime.lastError;
              if (err) {
                resolve({ ok: false, reason: err.message });
                return;
              }
              resolve({ ok: !!response?.ok, response });
            }
          );
        });
      });

      expect(sendResult.ok).toBe(true);

      // Wait until at least 2 unique contacts are scraped (3rd is duplicate email)
      await expect
        .poll(async () => {
          const state = await serviceWorker.evaluate(async () => {
            const out = await chrome.storage.local.get(['jso_collected_hrs']);
            const contacts = Array.isArray(out?.jso_collected_hrs) ? out.jso_collected_hrs : [];
            return {
              count: contacts.length,
              emails: contacts.map((c) => c.email).sort(),
            };
          });
          return state;
        }, { timeout: 25_000 })
        .toMatchObject({ count: 2 });

      const final = await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get(['jso_collected_hrs', 'jso_debug_logs']);
        const contacts = Array.isArray(out?.jso_collected_hrs) ? out.jso_collected_hrs : [];
        const logs = Array.isArray(out?.jso_debug_logs) ? out.jso_debug_logs : [];
        return { contacts, logs };
      });

      const emails = final.contacts.map((c) => c.email).sort();
      expect(emails).toEqual(['anita@acmelabs.com', 'careers@cloudnest.io']);
      expect(final.logs.length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});
