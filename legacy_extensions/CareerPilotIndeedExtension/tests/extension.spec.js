const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "linkedin-jobs-search.html");

function readFixture() {
  return fs.readFileSync(FIXTURE_PATH, "utf8");
}

test("extension injects panel and run starts on mocked LinkedIn jobs search", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-test-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
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
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    expect(serviceWorker).toBeTruthy();

    const html = readFixture();
    await context.route("https://www.linkedin.com/jobs/search/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await context.route("https://www.linkedin.com/jobs/view/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });

    const page = await context.newPage();
    await page.goto("https://www.linkedin.com/jobs/search/?f_AL=true", { waitUntil: "load" });

    await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible();
    await page.locator("#cp-start").click();

    await expect(page.locator("#cp-status-badge")).toHaveText(/Running|Idle|Paused/, { timeout: 10000 });
    await expect(page.locator("#cp-log .cp-line").first()).toBeVisible({ timeout: 10000 });

    const state = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get("cpState");
      return out?.cpState || null;
    });

    expect(state).toBeTruthy();
    expect(state.running).toBe(true);
    expect(Array.isArray(state.logs)).toBe(true);
    expect(state.logs.length).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
