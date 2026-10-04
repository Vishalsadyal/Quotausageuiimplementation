const path = require("path");
const fs = require("fs");
const os = require("os");
const { test, expect, chromium } = require("@playwright/test");

const EXTENSION_PATH = path.resolve(__dirname, "..");
const MEET_URL = "https://meet.google.com/abc-defg-hij";

// Minimal stand-in for a Google Meet call page with the live captions region.
const MEET_HTML = `<!doctype html><html><head><title>Meet</title></head><body>
  <button aria-label="Turn on captions (c)" onclick="document.getElementById('caps').hidden=false">CC</button>
  <div id="caps" role="region" aria-label="Captions" hidden><div class="wrap"></div></div>
  <script>
    window.addCaption = (name, text) => {
      const block = document.createElement("div");
      block.className = "nMcdL";
      block.innerHTML = '<div class="NWpY1d"></div><div class="ygicle"></div>';
      block.querySelector(".NWpY1d").textContent = name;
      block.querySelector(".ygicle").textContent = text;
      document.querySelector("#caps .wrap").appendChild(block);
      return block;
    };
    window.extendCaption = (block, text) => { block.querySelector(".ygicle").textContent = text; };
    // Meet recycles an old caption element for a brand-new line.
    window.recycleOldestCaption = (name, text) => {
      const wrap = document.querySelector("#caps .wrap");
      const block = wrap.firstElementChild;
      block.querySelector(".NWpY1d").textContent = name;
      block.querySelector(".ygicle").textContent = text;
      wrap.appendChild(block);
    };
  </script>
</body></html>`;

test("client call copilot suggests replies from Meet captions without storing data", async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-ext-test-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`]
  });

  const copilotRequests = [];
  try {
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) serviceWorker = await context.waitForEvent("serviceworker", { timeout: 15000 });

    await context.route("https://meet.google.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: MEET_HTML })
    );
    // No portal tab open -> the extension falls back to the production origin.
    await context.route("https://www.autoapplycv.in/api/ai/call-copilot", async (route) => {
      copilotRequests.push(JSON.parse(route.request().postData() || "{}"));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Suggestion ready",
          data: {
            say: "Totally fair — a fixed price works well here once we lock the scope.",
            points: ["Built 3 similar dashboards", "Milestones on Upwork"],
            ask: "Which three features must be in version one?",
            signal: "Budget concern",
            stage: "pricing"
          }
        })
      });
    });

    const page = await context.newPage();
    await page.goto(MEET_URL, { waitUntil: "load" });

    // Launcher appears on a meeting URL; open the panel.
    const launcher = page.locator(".mc-launcher");
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(page.locator(".mc-panel")).toBeVisible();

    // Setup: roles, goal, facts.
    const inputs = page.locator(".mc-setup .mc-input");
    await page.getByPlaceholder("e.g. Freelance full-stack developer (React / Node)").fill("Freelance React developer");
    await page.getByPlaceholder("e.g. Startup founder hiring for an MVP").fill("SaaS founder");
    await page.locator(".mc-setup textarea").nth(0).fill("Win the fixed-price dashboard project");
    await page.locator(".mc-setup textarea").nth(1).fill("Built 3 similar dashboards. Rate $40/h. Can start Monday.");
    await expect(inputs.first()).toBeVisible();
    await page.getByRole("button", { name: "Start live copilot" }).click();

    // Captions are off -> "Turn on" clicks Meet's CC button.
    await page.locator(".mc-cap-status .mc-link").click();
    await expect(page.locator(".mc-cap-status")).toContainText("Listening to captions");

    // My own speech must not trigger a suggestion.
    await page.evaluate(() => window.addCaption("You", "Hi, thanks for having me on the call today."));
    await page.waitForTimeout(2500);
    expect(copilotRequests.length).toBe(0);

    // Lead speaks in growing caption updates, then pauses.
    await page.evaluate(async () => {
      const b = window.addCaption("Sarah Client", "Honestly the budget");
      await new Promise((r) => setTimeout(r, 400));
      window.extendCaption(b, "Honestly the budget is tight, can you do this as a fixed price?");
    });

    const card = page.locator(".mc-card.latest");
    await expect(card).toContainText("fixed price works well", { timeout: 10000 });
    await expect(card).toContainText("Which three features");
    await expect(card).toContainText("Budget concern");
    expect(copilotRequests.length).toBe(1);

    const first = copilotRequests[0];
    expect(first.mode).toBe("auto");
    expect(first.setup.myRole).toBe("Freelance React developer");
    expect(first.setup.theirRole).toBe("SaaS founder");
    expect(first.transcript).toContain("ME: Hi, thanks for having me");
    expect(first.transcript).toContain("LEAD (Sarah Client): Honestly the budget is tight");
    expect(first.trigger).toContain("fixed price");

    if (process.env.MC_SCREENSHOT) await page.screenshot({ path: process.env.MC_SCREENSHOT });

    // Meet recycles the oldest element ("You" line) for the lead's next line:
    // the copilot must answer this new latest line.
    await page.evaluate(() => window.recycleOldestCaption("Sarah Client", "Tumhare ko interview mein kya puchte hai, palindrome banao yeh sab?"));
    await expect.poll(() => copilotRequests.length, { timeout: 10000 }).toBe(2);
    expect(copilotRequests[1].trigger).toContain("palindrome");
    const lines = copilotRequests[1].transcript.trim().split(/\r?\n/);
    expect(lines[lines.length - 1]).toContain("palindrome");
    await expect(page.locator(".mc-heard")).toContainText("palindrome");

    // Quick action button issues a mode-specific request.
    await page.getByRole("button", { name: "Close the deal" }).click();
    await expect.poll(() => copilotRequests.length).toBe(3);
    expect(copilotRequests[2].mode).toBe("close");

    // Privacy: nothing about the call is persisted in extension storage.
    const stored = await serviceWorker.evaluate(async () => JSON.stringify(await chrome.storage.local.get(null)));
    expect(stored).not.toContain("budget is tight");
    expect(stored).not.toContain("SaaS founder");

    // Clear wipes the in-memory transcript and suggestions.
    await page.getByRole("button", { name: "Clear everything" }).click();
    await expect(page.locator(".mc-card")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
