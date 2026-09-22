# AutoApply CV Indeed Copilot Beta Extension

Chrome extension scaffold for Indeed beta auto-apply behavior with:
- Always-visible floating control panel
- Chat-style live run logs
- Start / Pause / Stop controls
- Resilient selector strategy for Easy Apply flow
- Common question auto-answering (visa, city, marketing consent)

## Load in Chrome
1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select folder: `E:\Autoapply\CareerPilotIndeedExtension`

## Configure
1. Open extension `Details`
2. Open `Extension options`
3. Set:
   - API base URL (default `http://localhost:5000/api`)
   - Max applications per run
   - Dry-run / Auto-submit (safe defaults are Dry-run ON, Auto-submit OFF)
   - Pause-before-submit / pause-at-failed-question / overwrite-answers behavior
   - Non-stop cycle mode with optional sort/date cycling
   - City / marketing consent / visa preferences
   - Live mode acknowledgement (required before real auto-submit)
   - Search terms / switch-after-N / experience / security-clearance preferences
   - Advanced all-filter options (job type, onsite, experience level, company/location filters, etc.)
   - About-company bad words and exceptions

## Usage
1. Open Indeed jobs page
2. Use floating `CP` button (bottom-right) to open panel
3. Click `Start`
4. Watch live logs and counters

## Important
- Keep `Dry Run` ON initially.
- Turn ON `Auto Submit` only after validating behavior on your account.
- If you enable live auto-submit, you must check the live mode acknowledgement in settings first.
- Current extension engine runs in the active Indeed page context. It does not execute Python Selenium directly.

## Local Replica Testing
This repo includes a hard Easy Apply replica and Playwright validation:

1. `tests/fixtures/linkedin-jobs-search-replica-hard.html`
2. `tests/easy-apply-replica.spec.js`
3. `tests/REAL_WORLD_EASY_APPLY_CASE_MATRIX.md`

Run:

```bash
npm run test:e2e -- tests/easy-apply-replica.spec.js
```

The replica test validates:
- `NO_APPLY_BUTTON` skip path on a broken card
- Multi-step fallback filling (radio/select/combobox/unlabeled/date)
- Required consent checkbox auto-selection
- Dry-run reaching submit stage without pending-question pause

## Real Indeed Smoke Test (Dry-Run Only)
You can run an opt-in smoke test on real Indeed pages using your own local profile.

Do not share account credentials in chat or commit them in code.

1. Create/use a dedicated Chromium profile folder. If you want to apply, login to Indeed once manually.
2. Run:

```bash
export CP_INDEED_PROFILE_DIR="/absolute/path/to/chromium-profile"
export CP_INDEED_SEARCH="software engineer"
export CP_INDEED_LOCATION=""
export CP_INDEED_HEADLESS="1"
npm run test:e2e:live:indeed:dry
```

What this live test does:
- Loads the extension on real Indeed Jobs search
- Forces safe mode (`dryRun=true`, `autoSubmit=false`)
- Starts a run and waits for "Automation engine initialized"
- Attempts to detect a live apply flow without submitting
- Stops run after smoke verification
