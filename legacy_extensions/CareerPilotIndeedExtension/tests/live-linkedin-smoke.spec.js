const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const JOBS_SEARCH_URL = "https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800";
const ENABLE_REAL_TEST = process.env.CP_REAL_LINKEDIN_TEST === "1";
const PROFILE_DIR = process.env.CP_LINKEDIN_PROFILE_DIR || "";

test.describe("real linkedin dry-run smoke", () => {
  test.skip(!ENABLE_REAL_TEST, "Set CP_REAL_LINKEDIN_TEST=1 to enable live LinkedIn smoke test.");

  test("loads panel on real LinkedIn and starts dry-run safely", async () => {
    test.setTimeout(6 * 60 * 1000);

    expect(PROFILE_DIR, "Set CP_LINKEDIN_PROFILE_DIR to a dedicated Chromium profile directory.").toBeTruthy();
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chromium",
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`
      ]
    });

    try {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30000 });
      }
      expect(serviceWorker).toBeTruthy();

      await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get("cpSettings");
        const current = out?.cpSettings || {};
        await chrome.storage.local.set({
          cpSettings: {
            ...current,
            dryRun: true,
            autoSubmit: false,
            liveModeAcknowledged: true,
            enableBackendSync: false,
            debugMode: true,
            maxApplicationsPerRun: 1,
            maxSkipsPerRun: 15,
            easyApplyOnly: true,
            followCompanies: false,
            pauseAtFailedQuestion: true,
            pauseBeforeSubmit: false
          }
        });
      });

      const page = await context.newPage();
      await page.goto(JOBS_SEARCH_URL, { waitUntil: "domcontentloaded" });

      const loginFormVisible = await page.locator("input[name='session_key']").isVisible().catch(() => false);
      const signInButtonVisible = await page.locator("a[href*='login'], button:has-text('Sign in')").first().isVisible().catch(() => false);
      expect(loginFormVisible || signInButtonVisible, "LinkedIn appears signed out. Login in this profile first, then rerun.").toBe(false);

      await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible({ timeout: 40000 });
      await page.locator("#cp-start").click();

      await expect
        .poll(async () => {
          return await serviceWorker.evaluate(async () => {
            const out = await chrome.storage.local.get("cpState");
            const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
            return logs.some((entry) => String(entry?.message || "").includes("Automation engine initialized"));
          });
        }, { timeout: 90000 })
        .toBe(true);

      await serviceWorker.evaluate(async () => {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
        });
      });
    } finally {
      await context.close();
    }
  });
});

