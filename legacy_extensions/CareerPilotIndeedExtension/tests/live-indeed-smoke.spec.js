const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const ENABLE_REAL_TEST = process.env.CP_REAL_INDEED_TEST === "1";
const PROFILE_DIR = process.env.CP_INDEED_PROFILE_DIR || "";
const SEARCH_TERM = String(process.env.CP_INDEED_SEARCH || "software engineer").trim() || "software engineer";
const LOCATION = String(process.env.CP_INDEED_LOCATION || "").trim();
const HEADLESS = process.env.CP_INDEED_HEADLESS === "1";

function buildJobsUrl() {
  const url = new URL("https://www.indeed.com/jobs");
  url.searchParams.set("q", SEARCH_TERM);
  if (LOCATION) {
    url.searchParams.set("l", LOCATION);
  }
  return url.toString();
}

test.describe("real indeed dry-run smoke", () => {
  test.skip(!ENABLE_REAL_TEST, "Set CP_REAL_INDEED_TEST=1 to enable live Indeed smoke test.");

  test("loads panel on real Indeed and detects apply flow in dry-run", async () => {
    test.setTimeout(6 * 60 * 1000);

    expect(PROFILE_DIR, "Set CP_INDEED_PROFILE_DIR to a dedicated Chromium profile directory.").toBeTruthy();
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: "chromium",
      headless: HEADLESS,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });

    try {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30000 });
      }
      expect(serviceWorker).toBeTruthy();

      await serviceWorker.evaluate(async ({ searchTerm, location }) => {
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
            maxSkipsPerRun: 25,
            easyApplyOnly: true,
            followCompanies: false,
            pauseAtFailedQuestion: true,
            pauseBeforeSubmit: false,
            searchTerms: [searchTerm],
            searchLocation: location || "",
            sortBy: "Most recent",
            datePosted: "Past week",
          },
        });
      }, { searchTerm: SEARCH_TERM, location: LOCATION });

      const page = await context.newPage();
      await page.goto(buildJobsUrl(), { waitUntil: "domcontentloaded" });

      await expect(page.locator("#cp-linkedin-copilot-panel")).toBeVisible({ timeout: 40000 });

      const jobCardLocator = page.locator(
        'a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk], [data-jk] a, .job_seen_beacon, .result, .tapItem',
      );
      try {
        await expect(jobCardLocator.first()).toBeVisible({ timeout: 45000 });
      } catch (error) {
        const [title, url, screenshot] = await Promise.all([
          page.title(),
          page.url(),
          page.screenshot({ fullPage: true }),
        ]);
        test.info().attach("indeed-no-job-cards.png", { body: screenshot, contentType: "image/png" });
        throw new Error(`No Indeed job cards visible. URL: ${url} | Title: ${title}`);
      }

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

      try {
        await expect
          .poll(async () => {
            return await serviceWorker.evaluate(async () => {
              const out = await chrome.storage.local.get("cpState");
              const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
              const hasInternal = logs.some((entry) => String(entry?.message || "").includes("detected Indeed apply flow"));
              const hasExternal = logs.some((entry) => String(entry?.message || "").includes("Skipped (external apply)"));
              return hasInternal || hasExternal;
            });
          }, { timeout: 3 * 60 * 1000 })
          .toBe(true);
      } catch (error) {
        const lastLogs = await serviceWorker.evaluate(async () => {
          const out = await chrome.storage.local.get("cpState");
          const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
          return logs.slice(-20).map((entry) => `${entry?.level || "info"}: ${entry?.message || ""}`);
        });
        console.log("Last logs from cpState:\n" + lastLogs.join("\n"));
        test.info().annotations.push({
          type: "debug",
          description: `Last logs:\n${lastLogs.join("\n")}`,
        });
        throw error;
      }

      const detection = await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get("cpState");
        const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
        const hasInternal = logs.some((entry) => String(entry?.message || "").includes("detected Indeed apply flow"));
        const hasExternal = logs.some((entry) => String(entry?.message || "").includes("Skipped (external apply)"));
        const lastMessage = logs.length ? String(logs[logs.length - 1]?.message || "") : "";
        return { hasInternal, hasExternal, lastMessage };
      });

      if (!detection.hasInternal && detection.hasExternal) {
        test.info().annotations.push({
          type: "note",
          description: "Only external apply flows detected on this run. Internal Indeed apply may vary by search results.",
        });
      }

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
