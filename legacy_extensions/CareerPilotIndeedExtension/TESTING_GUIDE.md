# Indeed Extension - Playwright Testing Guide

## Quick Start

### Using the Helper Script (Easiest)

```bash
# Run full SmartApply flow test
./run-tests.sh full

# Run with custom search
./run-tests.sh full --search "python developer" --location "Remote"

# Run in headless mode
./run-tests.sh full --headless

# Run multiple applications
./run-tests.sh full --max-apps 3

# Run with Playwright UI (interactive)
./run-tests.sh full --ui

# View help
./run-tests.sh --help
```

### Using NPM Scripts

```bash
# Install dependencies
npm install

# Run full SmartApply test (headed)
npm run test:full

# Run full SmartApply test (headless)
npm run test:full:headless

# Run dry-run smoke test
npm run test:e2e:live:indeed:dry

# Run original SmartApply test
npm run test:smartapply

# View HTML report
npm run test:report
```

### Using Playwright Directly

```bash
# Set required environment variable
export CP_REAL_INDEED_TEST=1

# Optional: Customize search
export CP_INDEED_SEARCH="remote developer"
export CP_INDEED_LOCATION="United States"
export CP_MAX_APPS=1

# Run specific test
npx playwright test tests/indeed-smartapply-full.spec.js --headed

# Run with UI
npx playwright test tests/indeed-smartapply-full.spec.js --ui

# Run all tests
npx playwright test --headed
```

## Test Files

### 1. `indeed-smartapply-full.spec.js` (NEW - Recommended)
**Full SmartApply flow test with comprehensive logging**

Features:
- ✅ Complete flow: search → apply → resume selection → questions
- ✅ Detailed console logging at every step
- ✅ Anti-bot detection handling
- ✅ Automatic screenshot capture
- ✅ Progress monitoring
- ✅ Graceful error handling

Use this for:
- Testing the complete SmartApply automation
- Debugging issues in the flow
- Verifying resume auto-selection works
- Checking navigation to questions page

### 2. `smartapply-real-world.spec.js`
**Original SmartApply test**

Use this for:
- Alternative SmartApply testing
- Comparison with new test

### 3. `live-indeed-smoke.spec.js`
**Dry-run smoke test**

Use this for:
- Quick verification extension loads
- Testing without actual applications
- Safe testing in production

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CP_REAL_INDEED_TEST` | Enable live testing (required) | `0` |
| `CP_INDEED_SEARCH` | Job search term | `"remote developer"` |
| `CP_INDEED_LOCATION` | Location filter | `"United States"` |
| `CP_MAX_APPS` | Max applications to submit | `1` |
| `CP_INDEED_HEADLESS` | Run headless (1) or headed (0) | `0` |
| `CP_INDEED_PROFILE_DIR` | Chrome profile directory | `.test-profile` |

## Test Workflow

1. **Setup Extension**
   - Configures settings (dry run OFF, auto-submit ON)
   - Sets search parameters
   - Enables debug mode

2. **Navigate to Indeed**
   - Opens job search page
   - Handles Cloudflare challenges
   - Waits for extension panel to load

3. **Start Automation**
   - Clicks "Start" button
   - Monitors bot progress
   - Watches for new tabs

4. **SmartApply Flow**
   - Detects SmartApply tab opening
   - Verifies resume auto-selection
   - Checks navigation to questions page
   - Captures screenshots at each step

5. **Results**
   - Reports success/failure
   - Shows bot statistics
   - Saves HTML report with screenshots

## Expected Output

```
🚀 Starting Indeed Extension Test
📍 Profile: /path/to/.test-profile
🔍 Search: remote developer
📌 Location: United States
👁️  Headless: false

✅ Extension service worker ready
✅ Extension configured
✅ Page loaded
✅ Extension panel loaded
✅ Found 25 job cards
▶️  Starting bot...
✅ Engine initialized
👀 Watching for SmartApply tab...

  📊 Progress: applied=0, skipped=0, failed=0
  📊 Progress: applied=0, skipped=1, failed=0
  📊 Progress: applied=0, skipped=2, failed=0

  🔗 New tab detected: https://smartapply.indeed.com/...
✅ SmartApply tab opened
✅ Confirmed on SmartApply domain

📄 RESUME SELECTION PAGE
  Resume auto-selected: true
  ⏳ Waiting for navigation to questions...

❓ QUESTIONS PAGE
  Found 8 question fields
  Required fields: 3

📊 Final Bot State:
  Progress: { applied: 1, skipped: 2, failed: 0 }

✅ Test completed successfully!
```

## Troubleshooting

### Extension Panel Not Loading
```bash
# Check if extension is properly loaded
./run-tests.sh full --headed
# Look for panel in browser window
```

### Cloudflare Blocking
```bash
# Run headed and solve challenge manually
./run-tests.sh full --headed
# The test will wait up to 2 minutes for you to solve it
```

### No SmartApply Jobs Found
```bash
# Try different search terms
./run-tests.sh full --search "software engineer" --location "Remote"

# Or reduce filtering
export CP_INDEED_SEARCH="developer"
npm run test:full
```

### Resume Not Auto-Selected
```bash
# Check extension logs in test output
# Look for: [Indeed SmartApply] messages
# Screenshots will be saved in playwright-report/
```

### Test Timeout
```bash
# Increase timeout in test file (line 57)
# Or run with more specific search to get fewer jobs
./run-tests.sh full --search "python remote" --max-apps 1
```

## Screenshots

All tests automatically capture screenshots:
- `01-before-start.png` - Before clicking Start button
- `02-processing.png` - While bot is processing jobs
- `04-resume-before.png` - Resume selection before auto-fill
- `05-resume-after.png` - Resume selection after auto-fill
- `06-questions.png` - Questions page

View in HTML report:
```bash
npm run test:report
```

## Best Practices

1. **Always test with max-apps 1 first**
   ```bash
   ./run-tests.sh full --max-apps 1
   ```

2. **Use headed mode for debugging**
   ```bash
   ./run-tests.sh full --headed
   ```

3. **Check HTML report after test**
   ```bash
   npm run test:report
   ```

4. **Use specific search terms**
   ```bash
   ./run-tests.sh full --search "react developer remote"
   ```

5. **Keep profile directory separate**
   - The test creates `.test-profile/` by default
   - This keeps your personal Indeed login separate

## Common Issues

### Issue: "Set CP_REAL_INDEED_TEST=1"
**Solution:** Use the helper script or npm scripts which set this automatically

### Issue: Login required
**Solution:** Run once headed, login manually, credentials will be saved in profile

### Issue: All jobs skipped
**Solution:** Check extension settings in test output, may need to adjust filters

### Issue: Bot doesn't click apply
**Solution:** Some jobs don't have direct apply - test will gracefully skip them

## Advanced Usage

### Custom Profile Directory
```bash
./run-tests.sh full --profile ~/my-custom-profile
```

### Debug with Playwright UI
```bash
./run-tests.sh full --ui
```

### Run Multiple Tests
```bash
./run-tests.sh all --search "developer"
```

### Headless CI/CD
```bash
export CP_REAL_INDEED_TEST=1
export CP_INDEED_HEADLESS=1
npx playwright test tests/indeed-smartapply-full.spec.js
```

## CI/CD Integration

```yaml
# Example GitHub Actions
- name: Run Indeed Extension Tests
  run: |
    cd CareerPilotIndeedExtension
    npm install
    export CP_REAL_INDEED_TEST=1
    export CP_INDEED_HEADLESS=1
    npx playwright test tests/indeed-smartapply-full.spec.js
    
- name: Upload Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Support

For issues or questions:
1. Check console logs in test output
2. Review HTML report with screenshots
3. Run with `--ui` flag for interactive debugging
4. Check extension background logs in Chrome DevTools
