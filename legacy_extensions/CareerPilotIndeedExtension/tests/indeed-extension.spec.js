const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const FIXTURE_PATH = path.resolve(__dirname, "fixtures", "indeed-jobs-search.html");

function readFixture() {
  return fs.readFileSync(FIXTURE_PATH, "utf8");
}

test("Indeed extension injects panel and honors configured filters on mocked jobs", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-indeed-ext-test-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  });

  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
    }
    expect(serviceWorker).toBeTruthy();
    const extensionId = new URL(serviceWorker.url()).host;

    const html = readFixture();
    await context.route("https://www.indeed.com/jobs**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await context.route("https://www.indeed.com/viewjob**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });

    await serviceWorker.evaluate(async () => {
      const snapshot = await chrome.storage.local.get([
        "cpState",
        "cpSkippedHistory",
        "cpAppliedHistory",
        "cpFailedHistory",
        "cpDailyCapState",
      ]);
      const now = new Date();
      const dayKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      await chrome.storage.local.set({
        cpState: {
          ...(snapshot.cpState || {}),
          running: false,
          paused: false,
          applied: 0,
          skipped: 0,
          failed: 0,
          logs: [],
          lastError: null,
        },
        cpSkippedHistory: [],
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpDailyCapState: {
          dayKey,
          used: 0,
          cap: 3,
          resetAt: "",
        },
      });
    });

    const optionsPage = await context.newPage();
    await optionsPage.goto(`chrome-extension://${extensionId}/src/options.html`, { waitUntil: "load" });
    await optionsPage.locator("#searchTerms").fill("Frontend Engineer");
    await optionsPage.locator("#maxApplicationsPerRun").fill("1");
    await optionsPage.locator("#maxSkipsPerRun").fill("2");
    await optionsPage.locator("#sortBy").selectOption({ label: "Most recent" });
    await optionsPage.locator("#datePosted").selectOption({ label: "Past week" });
    await optionsPage.locator("#jobType").fill("Full-time");
    await optionsPage.locator("#settings-form").evaluate((form) => form.requestSubmit());
    await expect(optionsPage.locator("#status")).toHaveText(/Settings saved/, { timeout: 10000 });
    await optionsPage.close();

    const page = await context.newPage();
    await page.goto("https://www.indeed.com/jobs", { waitUntil: "load" });

    await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible();
    await page.locator("#cp-start").click();

    await expect.poll(() => page.url(), { timeout: 10000 }).toContain("q=Frontend+Engineer");
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain("sort=date");
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain("fromage=7");
    await expect.poll(() => page.url(), { timeout: 10000 }).toContain("jt=fulltime");

    await expect.poll(async () => {
      return await serviceWorker.evaluate(async () => {
        const snap = await chrome.storage.local.get("cpState");
        return Array.isArray(snap?.cpState?.logs) ? snap.cpState.logs.length : 0;
      });
    }, { timeout: 10000 }).toBeGreaterThan(0);

    await expect.poll(async () => {
      return await serviceWorker.evaluate(async () => {
        const snap = await chrome.storage.local.get("cpState");
        return Array.isArray(snap?.cpState?.logs)
          ? snap.cpState.logs.some((entry) => String(entry?.message || "").includes("Automation engine initialized"))
          : false;
      });
    }, { timeout: 20000 }).toBe(true);
  } finally {
    await context.close();
  }
});
