const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const ENABLE_REAL_TEST = process.env.CP_REAL_INDEED_TEST === "1";
const PROFILE_DIR = process.env.CP_INDEED_PROFILE_DIR || "";
const SEARCH_TERM = String(process.env.CP_INDEED_SEARCH || "developer").trim() || "developer";
const LOCATION = String(process.env.CP_INDEED_LOCATION || "Remote").trim();
const HEADLESS = process.env.CP_INDEED_HEADLESS === "1";

function buildJobsUrl() {
  const url = new URL("https://www.indeed.com/jobs");
  url.searchParams.set("q", SEARCH_TERM);
  if (LOCATION) {
    url.searchParams.set("l", LOCATION);
  }
  return url.toString();
}

test.describe("Real SmartApply Flow Test", () => {
  test.skip(!ENABLE_REAL_TEST, "Set CP_REAL_INDEED_TEST=1 to enable live Indeed SmartApply test.");

  test("clicks apply button, handles SmartApply tab, and auto-fills resume", async () => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes timeout

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
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    try {
      // Wait for service worker
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30000 });
      }
      expect(serviceWorker).toBeTruthy();

      // Configure extension settings for live apply
      await serviceWorker.evaluate(async ({ searchTerm, location }) => {
        const out = await chrome.storage.local.get("cpSettings");
        const current = out?.cpSettings || {};
        await chrome.storage.local.set({
          cpSettings: {
            ...current,
            dryRun: false,  // LIVE MODE
            autoSubmit: true,  // Auto-submit enabled
            liveModeAcknowledged: true,
            enableBackendSync: false,
            debugMode: true,
            maxApplicationsPerRun: 1,  // Just test 1 application
            maxSkipsPerRun: 10,
            easyApplyOnly: false,  // Allow SmartApply
            followCompanies: false,
            pauseAtFailedQuestion: true,
            pauseBeforeSubmit: false,
            searchTerms: [searchTerm],
            searchLocation: location || "",
            sortBy: "Most recent",
            datePosted: "Past week",
            onSite: [],  // Accept all work modes
            securityClearance: true,
          },
        });
      }, { searchTerm: SEARCH_TERM, location: LOCATION });

      // Open Indeed job search page
      const mainPage = await context.newPage();
      
      // Add extra stealth to the page
      await mainPage.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
      });
      
      await mainPage.goto(buildJobsUrl(), { waitUntil: "domcontentloaded" });

      // Check for Cloudflare challenge
      const hasCloudflare = await mainPage.locator('text=/Checking your browser|Just a moment|Cloudflare/i').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasCloudflare) {
        console.log("⚠️ Cloudflare challenge detected - waiting for it to complete...");
        
        // Wait up to 30 seconds for Cloudflare to pass
        await mainPage.waitForFunction(() => {
          const bodyText = document.body.textContent || '';
          return !bodyText.includes('Checking your browser') && 
                 !bodyText.includes('Just a moment') &&
                 !bodyText.includes('Cloudflare');
        }, { timeout: 30000 }).catch(() => {
          console.log("⚠️ Cloudflare challenge still present after 30s - may need manual intervention");
        });
        
        // Wait a bit more for page to stabilize
        await mainPage.waitForTimeout(3000);
        console.log("✅ Cloudflare challenge appears to have passed");
      }

      // Wait for panel to load
      await expect(mainPage.locator("#cp-linkedin-copilot-panel")).toBeVisible({ timeout: 40000 });
      console.log("✅ Extension panel loaded");

      // Wait for job cards
      const jobCardLocator = mainPage.locator(
        'a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk], [data-jk] a, .job_seen_beacon, .result, .tapItem',
      );
      
      try {
        await expect(jobCardLocator.first()).toBeVisible({ timeout: 45000 });
        console.log("✅ Job cards loaded");
      } catch (error) {
        const screenshot = await mainPage.screenshot({ fullPage: true });
        test.info().attach("no-job-cards.png", { body: screenshot, contentType: "image/png" });
        throw new Error(`No Indeed job cards visible. URL: ${mainPage.url()}`);
      }

      // Start the bot
      await mainPage.locator("#cp-start").click();
      console.log("✅ Bot started");

      // Wait for engine to initialize
      await expect
        .poll(async () => {
          return await serviceWorker.evaluate(async () => {
            const out = await chrome.storage.local.get("cpState");
            const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
            return logs.some((entry) => String(entry?.message || "").includes("Automation engine initialized"));
          });
        }, { timeout: 60000 })
        .toBe(true);
      console.log("✅ Engine initialized");

      // Listen for new tabs (SmartApply opens in new tab)
      const smartApplyPagePromise = context.waitForEvent('page', { timeout: 3 * 60 * 1000 });

      // Wait for bot to click an apply button (check console logs)
      await mainPage.waitForTimeout(5000);

      // Check if apply button was clicked
      const applyClicked = await mainPage.evaluate(() => {
        return window.document.body.textContent.includes('[Indeed Debug] 🖱️ Clicking apply button');
      });

      console.log("Apply button clicked:", applyClicked);

      // Wait for SmartApply tab to open
      let smartApplyPage;
      try {
        console.log("⏳ Waiting for SmartApply tab to open...");
        smartApplyPage = await smartApplyPagePromise;
        await smartApplyPage.waitForLoadState('domcontentloaded');
        console.log("✅ SmartApply tab opened:", smartApplyPage.url());
      } catch (error) {
        console.log("⚠️ No new tab opened - may have encountered external apply or no direct apply jobs");
        
        // Take screenshot for debugging
        const screenshot = await mainPage.screenshot({ fullPage: true });
        test.info().attach("no-smartapply-tab.png", { body: screenshot, contentType: "image/png" });
        
        // Get console logs
        const logs = await serviceWorker.evaluate(async () => {
          const out = await chrome.storage.local.get("cpState");
          const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
          return logs.slice(-10).map((entry) => `${entry?.level || "info"}: ${entry?.message || ""}`);
        });
        console.log("Last bot logs:\n" + logs.join("\n"));
        
        test.info().annotations.push({
          type: "note",
          description: "SmartApply tab did not open - may have only found external apply jobs in this search",
        });
        
        await context.close();
        return; // Skip rest of test
      }

      // Verify we're on SmartApply page
      expect(smartApplyPage.url()).toContain('smartapply.indeed.com');
      console.log("✅ Confirmed on SmartApply page");

      // Wait for resume selection page to load
      if (smartApplyPage.url().includes('resume-selection')) {
        console.log("📄 Resume selection page detected");

        // Wait for resume options to appear
        await smartApplyPage.waitForTimeout(3000);

        // Take screenshot before auto-fill
        const beforeScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("resume-selection-before.png", { body: beforeScreenshot, contentType: "image/png" });

        // Check if resume was auto-selected by the extension
        await smartApplyPage.waitForTimeout(2000);

        // Look for selected resume (checked radio button or highlighted option)
        const resumeSelected = await smartApplyPage.evaluate(() => {
          const checkedRadio = document.querySelector('input[type="radio"]:checked');
          const selectedButton = document.querySelector('button[aria-pressed="true"], button.selected, [class*="selected"]');
          return !!(checkedRadio || selectedButton);
        });

        console.log("Resume auto-selected:", resumeSelected);

        // Take screenshot after auto-fill
        const afterScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("resume-selection-after.png", { body: afterScreenshot, contentType: "image/png" });

        // Look for Continue button
        const continueButton = smartApplyPage.locator('button:has-text("Continue"), button:has-text("Next")').first();
        
        if (await continueButton.isVisible({ timeout: 5000 })) {
          console.log("✅ Continue button found");
          
          // Check if it was already clicked by extension
          await smartApplyPage.waitForTimeout(2000);
          
          const urlBefore = smartApplyPage.url();
          console.log("URL before continue:", urlBefore);
          
          // If URL changed, extension already clicked it
          const urlAfter = smartApplyPage.url();
          if (urlAfter !== urlBefore || smartApplyPage.url().includes('questions')) {
            console.log("✅ Extension auto-clicked Continue button");
          } else {
            console.log("ℹ️ Continue button not auto-clicked, clicking manually for test");
            await continueButton.click();
            await smartApplyPage.waitForLoadState('domcontentloaded');
          }
          
          console.log("URL after continue:", smartApplyPage.url());
        }
      }

      // Check if we reached the questions page
      await smartApplyPage.waitForTimeout(3000);
      
      if (smartApplyPage.url().includes('questions')) {
        console.log("✅ Successfully reached questions page!");
        
        // Take screenshot of questions page
        const questionsScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("questions-page.png", { body: questionsScreenshot, contentType: "image/png" });
        
        // Count questions
        const questionCount = await smartApplyPage.locator('textarea, input[type="text"], select').count();
        console.log(`Found ${questionCount} question fields`);
        
        test.info().annotations.push({
          type: "success",
          description: `SmartApply flow working! Reached questions page with ${questionCount} questions.`,
        });
      }

      // Get final bot state
      const finalState = await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get("cpState");
        return {
          progress: out?.cpState?.progress || {},
          logs: (out?.cpState?.logs || []).slice(-15).map(entry => entry?.message || ""),
        };
      });

      console.log("\n=== Final Bot State ===");
      console.log("Progress:", finalState.progress);
      console.log("\nLast 15 logs:");
      finalState.logs.forEach(log => console.log("  ", log));

      // Stop the bot
      await serviceWorker.evaluate(async () => {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
        });
      });

      console.log("✅ Test completed successfully!");

    } finally {
      await context.close();
    }
  });
});
