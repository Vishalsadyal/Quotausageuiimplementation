const fs = require('fs');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');

const extensionPath = path.resolve(__dirname, '..');
const LINKEDIN_EMAIL = String(process.env.CP_LINKEDIN_EMAIL || '').trim();
const LINKEDIN_PASSWORD = String(process.env.CP_LINKEDIN_PASSWORD || '').trim();
const LINKEDIN_PROFILE_DIR = String(process.env.CP_LINKEDIN_PROFILE_DIR || '').trim();

async function tryLinkedInLogin(page) {
  // If session is already valid, no login needed
  if (!page.url().includes('/login')) {
    const loginFieldVisible = await page.locator('input[name="session_key"]').isVisible().catch(() => false);
    if (!loginFieldVisible) return { attempted: false, loggedIn: true };
  }

  if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) {
    return { attempted: false, loggedIn: false, reason: 'Missing CP_LINKEDIN_EMAIL / CP_LINKEDIN_PASSWORD' };
  }

  const emailInput = page.locator('input[name="session_key"], #username, input[type="email"]').first();
  const passInput = page.locator('input[name="session_password"], #password, input[type="password"]').first();

  const hasEmail = await emailInput.isVisible({ timeout: 12000 }).catch(() => false);
  const hasPass = await passInput.isVisible({ timeout: 12000 }).catch(() => false);
  if (!hasEmail || !hasPass) {
    return { attempted: false, loggedIn: false, reason: 'Login inputs not found' };
  }

  await emailInput.fill(LINKEDIN_EMAIL);
  await passInput.fill(LINKEDIN_PASSWORD);

  const submitBtn = page
    .locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button[aria-label*="Sign in"]')
    .first();

  const hasSubmit = await submitBtn.isVisible().catch(() => false);
  if (hasSubmit) {
    await submitBtn.click({ force: true }).catch(() => {});
  }
  await passInput.press('Enter').catch(() => {});

  // Wait for either feed redirect or checkpoint/challenge
  await page.waitForTimeout(6500);
  const url = page.url();
  const challenge = /checkpoint|challenge|captcha/i.test(url);
  if (challenge) {
    return { attempted: true, loggedIn: false, reason: `LinkedIn challenge flow: ${url}` };
  }

  const stillLogin = /\/login/i.test(url);
  return { attempted: true, loggedIn: !stillLogin, reason: stillLogin ? `Still on login page: ${url}` : '' };
}

test.describe('Jobs Smart Outreach on real LinkedIn', () => {
  test('content script loads on linkedin.com and responds safely', async () => {
    const userDataDir = LINKEDIN_PROFILE_DIR || '';
    if (LINKEDIN_PROFILE_DIR && !fs.existsSync(LINKEDIN_PROFILE_DIR)) {
      fs.mkdirSync(LINKEDIN_PROFILE_DIR, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: !!process.env.CI,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    try {
      const page = await context.newPage();

      let navigated = true;
      try {
        await page.goto('https://www.linkedin.com/feed/', {
          waitUntil: 'domcontentloaded',
          timeout: 45_000,
        });
      } catch {
        navigated = false;
      }

      test.skip(!navigated, 'LinkedIn did not load in this environment.');

      // Optional autofill login when LinkedIn asks credentials
      const loginResult = await tryLinkedInLogin(page);
      if (!loginResult.loggedIn) {
        test.skip(
          true,
          `LinkedIn session not ready for automation: ${loginResult.reason || 'unknown reason'} (set CP_LINKEDIN_PROFILE_DIR and login manually once)`
        );
      }

      // Ensure we end up on LinkedIn after possible login redirect
      if (!page.url().includes('linkedin.com/feed')) {
        await page.goto('https://www.linkedin.com/feed/', {
          waitUntil: 'domcontentloaded',
          timeout: 45_000,
        });
      }

      await expect(page).toHaveURL(/linkedin\.com/);

      // Open popup (extension context) and verify content-script receiver exists on LinkedIn tab
      let [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
      }
      const extensionId = serviceWorker.url().split('/')[2];
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);

      const stopResult = await popup.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const linkedinTab = tabs.find((t) => String(t.url || '').includes('linkedin.com'));
        if (!linkedinTab?.id) {
          return { ok: false, error: 'LinkedIn tab not found' };
        }
        return new Promise((resolve) => {
          chrome.tabs.sendMessage(linkedinTab.id, { type: 'JSO_STOP_SCRAPE' }, (response) => {
            const err = chrome.runtime.lastError;
            if (err) {
              resolve({ ok: false, error: err.message });
              return;
            }
            resolve({ ok: !!response?.ok });
          });
        });
      });

      expect(stopResult.ok).toBe(true);
    } finally {
      await context.close();
    }
  });
});
