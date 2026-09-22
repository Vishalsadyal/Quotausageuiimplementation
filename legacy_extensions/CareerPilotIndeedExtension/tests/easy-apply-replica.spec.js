const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const HARD_FIXTURE_PATH = path.resolve(__dirname, "fixtures", "linkedin-jobs-search-replica-hard.html");

function readFixture(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

async function getServiceWorker(context) {
  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  }
  return serviceWorker;
}

test("hard easy-apply replica covers no-apply skip + required fields + consent fallback", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-hard-replica-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  try {
    const serviceWorker = await getServiceWorker(context);
    expect(serviceWorker).toBeTruthy();

    const html = readFixture(HARD_FIXTURE_PATH);
    await context.route("https://www.linkedin.com/jobs/search/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await context.route("https://www.linkedin.com/jobs/view/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });

    await serviceWorker.evaluate(async () => {
      const settings = {
        dryRun: true,
        autoSubmit: false,
        liveModeAcknowledged: true,
        enableBackendSync: false,
        debugMode: true,
        easyApplyOnly: true,
        followCompanies: false,
        pauseAtFailedQuestion: true,
        maxApplicationsPerRun: 2,
        maxSkipsPerRun: 20,
        datePosted: "Past week",
        sortBy: "",
        searchTerms: [],
        randomizeSearchOrder: false
      };
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_SAVE_SETTINGS", settings }, () => resolve(null));
      });
      await chrome.storage.local.set({
        cpState: {
          running: false,
          paused: false,
          startedAt: null,
          applied: 0,
          skipped: 0,
          failed: 0,
          logs: [],
          lastError: null
        },
        cpPendingQuestions: [],
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpExternalHistory: [],
        cpSkippedHistory: []
      });
    });

    const page = await context.newPage();
    await page.goto("https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800", { waitUntil: "load" });
    await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible();
    await page.locator("#cp-start").click();

    await expect.poll(async () => {
      return await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get([
          "cpAppliedHistory",
          "cpSkippedHistory"
        ]);
        const applied = Array.isArray(out.cpAppliedHistory) ? out.cpAppliedHistory : [];
        const skipped = Array.isArray(out.cpSkippedHistory) ? out.cpSkippedHistory : [];
        return {
          applied: applied.length,
          skipped: skipped.length
        };
      });
    }, { timeout: 90000 }).toEqual({ applied: 1, skipped: 1 });

    await serviceWorker.evaluate(async () => {
      await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
      });
    });

    const snapshot = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get([
        "cpState",
        "cpAppliedHistory",
        "cpSkippedHistory",
        "cpPendingQuestions"
      ]);
      return {
        state: out.cpState || null,
        applied: Array.isArray(out.cpAppliedHistory) ? out.cpAppliedHistory : [],
        skipped: Array.isArray(out.cpSkippedHistory) ? out.cpSkippedHistory : [],
        pending: Array.isArray(out.cpPendingQuestions) ? out.cpPendingQuestions : []
      };
    });

    const logMessages = (snapshot.state?.logs || []).map((entry) => String(entry?.message || ""));
    const appliedReasonCodes = snapshot.applied.map((entry) => String(entry?.data?.reasonCode || ""));
    const skippedReasonCodes = snapshot.skipped.map((entry) => String(entry?.data?.reasonCode || ""));
    const sawFallbackLog = logMessages.some((msg) => msg.toLowerCase().includes("fallback"));
    const sawConsentLog = logMessages.some((msg) => msg.includes("Checked submit consent field"));
    const sawDateLog = logMessages.some((msg) => msg.includes("Selected today's date for date-picker field"));
    const modalAdvanceClicks = logMessages.filter((msg) => msg.includes("[debug] Clicking modal action")).length;

    expect(snapshot.applied.length).toBeGreaterThan(0);
    expect(appliedReasonCodes).toContain("DRY_RUN_REACHED_SUBMIT");
    expect(skippedReasonCodes).toContain("NO_APPLY_BUTTON");
    expect(sawFallbackLog || sawConsentLog || sawDateLog).toBeTruthy();
    expect(modalAdvanceClicks).toBeGreaterThan(1);
    expect(snapshot.pending.length).toBe(0);
  } finally {
    await context.close();
  }
});

test("hard easy-apply replica validates real submit success path", async () => {
  test.setTimeout(120000);

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cp-ext-hard-submit-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ]
  });

  try {
    const serviceWorker = await getServiceWorker(context);
    expect(serviceWorker).toBeTruthy();

    const html = readFixture(HARD_FIXTURE_PATH);
    await context.route("https://www.linkedin.com/jobs/search/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });
    await context.route("https://www.linkedin.com/jobs/view/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "text/html", body: html });
    });

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        cpState: {
          running: false,
          paused: false,
          startedAt: null,
          applied: 0,
          skipped: 0,
          failed: 0,
          logs: [],
          lastError: null
        },
        cpPendingQuestions: [],
        cpAppliedHistory: [],
        cpFailedHistory: [],
        cpExternalHistory: [],
        cpSkippedHistory: []
      });
    });

    const page = await context.newPage();
    await page.goto("https://www.linkedin.com/jobs/search/?f_AL=true&f_TPR=r604800", { waitUntil: "load" });
    await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible();
    await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get("cpSettings");
      const current = out?.cpSettings || {};
      await chrome.storage.local.set({
        cpSettings: {
          ...current,
          dryRun: false,
          autoSubmit: true,
          liveModeAcknowledged: true,
          enableBackendSync: false,
          debugMode: true,
          easyApplyOnly: true,
          followCompanies: false,
          pauseAtFailedQuestion: true,
          pauseBeforeSubmit: false,
          maxApplicationsPerRun: 1,
          maxSkipsPerRun: 20,
          datePosted: "Past week",
          sortBy: "",
          searchTerms: [],
          randomizeSearchOrder: false
        }
      });
    });
    const liveSettings = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get("cpSettings");
      return out?.cpSettings || {};
    });
    expect(Boolean(liveSettings.autoSubmit)).toBe(true);
    expect(Boolean(liveSettings.dryRun)).toBe(false);
    await page.locator("#cp-start").click();

    await expect.poll(async () => {
      return await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get([
          "cpAppliedHistory",
          "cpState"
        ]);
        const applied = Array.isArray(out.cpAppliedHistory) ? out.cpAppliedHistory : [];
        const hasSubmitted = applied.some((entry) => String(entry?.data?.reasonCode || "") === "SUBMITTED");
        return {
          hasSubmitted,
          running: Boolean(out?.cpState?.running)
        };
      });
    }, { timeout: 90000 }).toEqual({ hasSubmitted: true, running: false });

    const snapshot = await serviceWorker.evaluate(async () => {
      const out = await chrome.storage.local.get([
        "cpState",
        "cpAppliedHistory",
        "cpFailedHistory"
      ]);
      return {
        state: out.cpState || null,
        applied: Array.isArray(out.cpAppliedHistory) ? out.cpAppliedHistory : [],
        failed: Array.isArray(out.cpFailedHistory) ? out.cpFailedHistory : []
      };
    });

    const appliedReasonCodes = snapshot.applied.map((entry) => String(entry?.data?.reasonCode || ""));
    const logMessages = (snapshot.state?.logs || []).map((entry) => String(entry?.message || ""));
    const modalAdvanceClicks = logMessages.filter((msg) => msg.includes("[debug] Clicking modal action")).length;
    expect(appliedReasonCodes).toContain("SUBMITTED");
    expect(snapshot.failed.length).toBe(0);
    expect(snapshot.applied.length).toBeGreaterThan(0);
    expect(modalAdvanceClicks).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
