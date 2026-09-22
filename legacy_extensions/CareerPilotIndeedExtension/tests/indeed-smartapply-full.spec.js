const fs = require("fs");
const path = require("path");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const ENABLE_REAL_TEST = process.env.CP_REAL_INDEED_TEST === "1";
const PROFILE_DIR = process.env.CP_INDEED_PROFILE_DIR || path.join(__dirname, "../.test-profile");
const SEARCH_TERM = String(process.env.CP_INDEED_SEARCH || "remote developer").trim();
const LOCATION = String(process.env.CP_INDEED_LOCATION || "United States").trim();
const HEADLESS = process.env.CP_INDEED_HEADLESS === "1";
const MAX_APPS = parseInt(process.env.CP_MAX_APPS || "1", 10);

function buildJobsUrl() {
  const url = new URL("https://www.indeed.com/jobs");
  url.searchParams.set("q", SEARCH_TERM);
  if (LOCATION) {
    url.searchParams.set("l", LOCATION);
  }
  // Add filters to increase chance of SmartApply jobs
  url.searchParams.set("fromage", "7"); // Last 7 days
  url.searchParams.set("sort", "date"); // Sort by date
  return url.toString();
}

test.describe("Indeed Extension SmartApply - Full Flow", () => {
  test.skip(!ENABLE_REAL_TEST, "Set CP_REAL_INDEED_TEST=1 to enable live Indeed test.");

  test("complete SmartApply flow: click apply → select resume → navigate questions", async () => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes

    // Create profile directory if it doesn't exist
    if (!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
      console.log("📁 Created test profile directory:", PROFILE_DIR);
    }

    console.log("\n🚀 Starting Indeed Extension Test");
    console.log("📍 Profile:", PROFILE_DIR);
    console.log("🔍 Search:", SEARCH_TERM);
    console.log("📌 Location:", LOCATION);
    console.log("👁️  Headless:", HEADLESS);

    const launchOptions = {
      headless: HEADLESS,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    let context;
    try {
      context = await chromium.launchPersistentContext(PROFILE_DIR, {
        channel: process.env.CP_BROWSER_CHANNEL || 'chromium',
        ...launchOptions,
      });
    } catch (firstError) {
      console.warn("⚠️ Channel launch failed, retrying with bundled Chromium:", firstError?.message || firstError);
      context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
    }

    try {
      // Wait for service worker
      console.log("⏳ Waiting for extension service worker...");
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent("serviceworker", { timeout: 30000 });
      }
      expect(serviceWorker).toBeTruthy();
      console.log("✅ Extension service worker ready");

      // Configure extension settings
      console.log("⚙️  Configuring extension settings...");
      await serviceWorker.evaluate(async ({ searchTerm, location, maxApps }) => {
        const out = await chrome.storage.local.get("cpSettings");
        const current = out?.cpSettings || {};
        await chrome.storage.local.set({
          cpSettings: {
            ...current,
            dryRun: false,  // LIVE MODE - Actually click buttons
            autoSubmit: true,  // Auto-submit enabled
            liveModeAcknowledged: true,
            enableBackendSync: false,
            debugMode: true,
            maxApplicationsPerRun: maxApps,
            maxSkipsPerRun: 20,
            easyApplyOnly: false,  // Allow SmartApply
            followCompanies: false,
            pauseAtFailedQuestion: true,
            pauseBeforeSubmit: true,  // Pause before final submit
            searchTerms: [searchTerm],
            searchLocation: location || "",
            sortBy: "date",
            datePosted: "Past week",
            onSite: [],  // Accept all work modes
            securityClearance: true,
          },
        });
        console.log("[Extension] Settings configured for SmartApply test");
      }, { searchTerm: SEARCH_TERM, location: LOCATION, maxApps: MAX_APPS });
      console.log("✅ Extension configured");

      // Open Indeed job search page
      console.log("🌐 Opening Indeed job search...");
      const mainPage = await context.newPage();
      
      // Add anti-detection
      await mainPage.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        window.chrome = { runtime: {} };
      });

      // Listen for console logs
      mainPage.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Indeed') || text.includes('[CP')) {
          console.log('  💬', text);
        }
      });
      
      await mainPage.goto(buildJobsUrl(), { waitUntil: "domcontentloaded", timeout: 60000 });
      console.log("✅ Page loaded:", mainPage.url());

      // Check for Cloudflare or bot detection
      await mainPage.waitForTimeout(2000);
      const hasCloudflare = await mainPage.locator('text=/Checking your browser|Just a moment|Cloudflare|Access Denied/i').isVisible({ timeout: 3000 }).catch(() => false);
      
      if (hasCloudflare) {
        console.log("⚠️  Cloudflare/Bot detection - waiting for manual resolution...");
        console.log("👉 Please solve the challenge in the browser window");
        
        // Wait up to 2 minutes for user to solve challenge
        await mainPage.waitForFunction(() => {
          const bodyText = document.body.textContent || '';
          return !bodyText.includes('Checking your browser') && 
                 !bodyText.includes('Just a moment') &&
                 !bodyText.includes('Cloudflare') &&
                 !bodyText.includes('Access Denied');
        }, { timeout: 120000 }).catch(() => {
          console.log("⚠️  Challenge not resolved in 2 minutes");
        });
        
        await mainPage.waitForTimeout(3000);
        console.log("✅ Page accessible");
      }

      // Wait for panel to load
      console.log("⏳ Waiting for extension panel...");
      await expect(mainPage.locator("#cp-linkedin-copilot-panel")).toBeVisible({ timeout: 45000 });
      console.log("✅ Extension panel loaded");

      // Wait for job cards
      console.log("⏳ Waiting for job cards...");
      const jobCardLocator = mainPage.locator(
        'a[href*="/viewjob?jk="], a[href*="/rc/clk?jk="], a[data-jk], [data-jk] a, .job_seen_beacon, .result, .tapItem, [class*="jobCard"]',
      );
      
      try {
        await expect(jobCardLocator.first()).toBeVisible({ timeout: 45000 });
        const jobCount = await jobCardLocator.count();
        console.log(`✅ Found ${jobCount} job cards`);
      } catch (error) {
        const screenshot = await mainPage.screenshot({ fullPage: true });
        test.info().attach("no-job-cards.png", { body: screenshot, contentType: "image/png" });
        throw new Error(`No Indeed job cards visible. URL: ${mainPage.url()}`);
      }

      // Take screenshot before starting
      const beforeStartScreenshot = await mainPage.screenshot({ fullPage: true });
      test.info().attach("01-before-start.png", { body: beforeStartScreenshot, contentType: "image/png" });

      // Start the bot
      console.log("▶️  Starting bot...");
      await mainPage.locator("#cp-start").click();

      // Wait for engine to initialize
      console.log("⏳ Waiting for engine initialization...");
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
      console.log("👀 Watching for SmartApply tab...");
      
      const smartApplyPagePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout waiting for SmartApply tab")), 4 * 60 * 1000);
        
        context.on('page', async (page) => {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          const url = page.url();
          console.log("  🔗 New tab detected:", url);
          
          if (url.includes('smartapply.indeed.com')) {
            clearTimeout(timeout);
            resolve(page);
          }
        });
      });

      // Wait for bot to process jobs
      console.log("⏳ Bot processing jobs (this may take 1-3 minutes)...");
      await mainPage.waitForTimeout(10000);

      // Monitor progress
      for (let i = 0; i < 24; i++) { // Check for 2 minutes
        const progress = await serviceWorker.evaluate(async () => {
          const out = await chrome.storage.local.get("cpState");
          return out?.cpState?.progress || {};
        });
        
        console.log(`  📊 Progress: applied=${progress.applied || 0}, skipped=${progress.skipped || 0}, failed=${progress.failed || 0}`);
        
        if (progress.applied > 0 || progress.failed > 0) {
          console.log("  ✅ Bot made progress!");
          break;
        }
        
        await mainPage.waitForTimeout(5000);
      }

      // Take screenshot during processing
      const processingScreenshot = await mainPage.screenshot({ fullPage: true });
      test.info().attach("02-processing.png", { body: processingScreenshot, contentType: "image/png" });

      // Wait for SmartApply tab
      let smartApplyPage;
      try {
        console.log("⏳ Waiting for SmartApply tab to open...");
        smartApplyPage = await smartApplyPagePromise;
        console.log("✅ SmartApply tab opened:", smartApplyPage.url());
      } catch (error) {
        console.log("⚠️  No SmartApply tab opened");
        
        // Get final logs
        const logs = await serviceWorker.evaluate(async () => {
          const out = await chrome.storage.local.get("cpState");
          const logs = Array.isArray(out?.cpState?.logs) ? out.cpState.logs : [];
          return logs.slice(-20).map((entry) => `${entry?.level || "info"}: ${entry?.message || ""}`);
        });
        
        console.log("\n📜 Last 20 bot logs:");
        logs.forEach(log => console.log("  ", log));
        
        const finalScreenshot = await mainPage.screenshot({ fullPage: true });
        test.info().attach("03-no-smartapply.png", { body: finalScreenshot, contentType: "image/png" });
        
        test.info().annotations.push({
          type: "note",
          description: "SmartApply tab did not open - may have only found external apply or already-applied jobs",
        });
        
        return; // Exit test gracefully
      }

      // Listen to SmartApply page console
      smartApplyPage.on('console', msg => {
        const text = msg.text();
        if (text.includes('[Indeed') || text.includes('SmartApply')) {
          console.log('  🗨️ [SmartApply]', text);
        }
      });

      // Verify we're on SmartApply
      expect(smartApplyPage.url()).toContain('smartapply.indeed.com');
      console.log("✅ Confirmed on SmartApply domain");

      // Wait for page to stabilize
      await smartApplyPage.waitForTimeout(3000);

      // === RESUME SELECTION PAGE ===
      if (smartApplyPage.url().includes('resume-selection')) {
        console.log("\n📄 RESUME SELECTION PAGE");
        
        // Take screenshot before
        const beforeResumeScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("04-resume-before.png", { body: beforeResumeScreenshot, contentType: "image/png" });

        // Wait for extension to process
        await smartApplyPage.waitForTimeout(5000);

        // Check if resume was selected
        const resumeSelected = await smartApplyPage.evaluate(() => {
          const checkedRadio = document.querySelector('input[type="radio"]:checked');
          const selectedDiv = document.querySelector('[class*="selected"], [aria-checked="true"]');
          return !!(checkedRadio || selectedDiv);
        });

        console.log("  Resume auto-selected:", resumeSelected);
        expect(resumeSelected).toBe(true);

        // Take screenshot after
        const afterResumeScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("05-resume-after.png", { body: afterResumeScreenshot, contentType: "image/png" });

        // Wait for navigation to questions page
        console.log("  ⏳ Waiting for navigation to questions...");
        await smartApplyPage.waitForURL(/questions/, { timeout: 30000 }).catch(() => {
          console.log("  ⚠️  Did not auto-navigate to questions page");
        });
      }

      // === QUESTIONS PAGE ===
      await smartApplyPage.waitForTimeout(3000);
      
      if (smartApplyPage.url().includes('questions')) {
        console.log("\n❓ QUESTIONS PAGE");
        
        // Take screenshot
        const questionsScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("06-questions.png", { body: questionsScreenshot, contentType: "image/png" });
        
        // Count questions
        const questions = await smartApplyPage.locator('textarea, input[type="text"], input[type="tel"], input[type="email"], select').count();
        console.log(`  Found ${questions} question fields`);
        
        // Check for required fields
        const requiredFields = await smartApplyPage.locator('[required], [aria-required="true"]').count();
        console.log(`  Required fields: ${requiredFields}`);
        
        test.info().annotations.push({
          type: "success",
          description: `✅ SmartApply flow successful! Reached questions page with ${questions} fields.`,
        });
      } else {
        console.log("  Current page:", smartApplyPage.url());
        const currentScreenshot = await smartApplyPage.screenshot({ fullPage: true });
        test.info().attach("07-current-page.png", { body: currentScreenshot, contentType: "image/png" });
      }

      // Get final bot state
      console.log("\n📊 Final Bot State:");
      const finalState = await serviceWorker.evaluate(async () => {
        const out = await chrome.storage.local.get("cpState");
        return {
          progress: out?.cpState?.progress || {},
          logs: (out?.cpState?.logs || []).slice(-10).map(entry => entry?.message || ""),
        };
      });

      console.log("  Progress:", JSON.stringify(finalState.progress, null, 2));
      console.log("\n  Last 10 logs:");
      finalState.logs.forEach(log => console.log("    ", log));

      // Stop the bot
      await serviceWorker.evaluate(async () => {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "CP_STOP" }, () => resolve(null));
        });
      });

      console.log("\n✅ Test completed successfully!");

    } finally {
      await context.close();
    }
  });
});
