# SmartApply Form Detection - Testing Checklist

## Before You Start
1. **Reload the extension** in Chrome:
   - Go to `chrome://extensions/`
   - Find "CareerPilot Indeed Extension"
   - Click the refresh icon

2. **Open DevTools** on the Indeed/SmartApply pages:
   - Press `F12` or right-click → "Inspect"
   - Go to the "Console" tab
   - Keep it open while testing

## Test Scenario 1: Resume Selection Page
**Goal:** Verify extension detects resume picker and auto-selects

**Steps:**
1. Go to Indeed job listing
2. Click "Apply Now"
3. **Expected outcome:** Redirected to SmartApply resume selection page
4. **Check console logs for:**
   ```
   [Indeed SmartApply] 🎯 Detected SmartApply form page
   [Indeed SmartApply] ✅ ApplyByApplyableJobId page loaded after Xs
   [Indeed SmartApply] ✅ Page type for applybyapplyablejobid: resume-selection
   [Indeed SmartApply] 📄 Resume selection page detected
   ```
5. **Then should see:** Resume auto-selected and Continue button clicked

## Test Scenario 2: Form Fields Page (CRITICAL TEST)
**Goal:** Verify extension detects form fields and auto-fills them

**Steps:**
1. Go to Indeed job listing (one that has inline application form)
2. Click "Apply Now"
3. **Expected redirect:** To SmartApply `/beta/indeedapply/applybyapplyablejobid?...` page
4. **Check console logs for:**
   ```
   [Indeed SmartApply] 📊 Form inventory:
     textInputs: X (should be > 0)
     selects: X (may be 0 or more)
     buttons: X (should be > 0)
   
   [Indeed SmartApply] ✅ Page type for applybyapplyablejobid: questions
   [Indeed SmartApply] ❓ Questions page detected
   ```
5. **Then should see:**
   ```
   [Indeed SmartApply] 📝 Auto-fill complete. Pending required questions: 0
   [Indeed SmartApply] ➡️ Clicking action after auto-fill: "Continue"
   ```

## Test Scenario 3: Page Load Timeout Handling
**Goal:** Verify extension doesn't hang if page loads slowly

**Steps:**
1. Apply to a job as normal
2. If SmartApply page loads slowly:
   - **Should see:** Logs counting down from 1s to 25s:
     ```
     [Indeed SmartApply] ⏳ Load check 1s - buttons: 0, inputs: 0
     [Indeed SmartApply] ⏳ Load check 2s - buttons: 1, inputs: 0
     [Indeed SmartApply] ⏳ Load check 3s - buttons: 2, inputs: 1
     ...
     [Indeed SmartApply] ✅ ApplyByApplyableJobId page loaded after 8s
     ```
   - **After 25s max:** Should proceed even if not fully loaded (with warning)

## Diagnostic Output to Capture
If something doesn't work, **copy these logs from the console:**

1. **Initial detection:**
   ```
   [Indeed SmartApply] 🎯 Detected SmartApply form page
   [Indeed SmartApply] 📍 Full URL with params: [copy full URL]
   ```

2. **Pre-detection page state:**
   ```
   [Indeed SmartApply] 📊 PRE-DETECTION PAGE STATE:
     - Buttons: X
     - Text inputs: X
     - Selects: X
     - Radios: X
     - Total form elements: X
   ```

3. **Page detection results:**
   ```
   [Indeed SmartApply] 📊 Form inventory: {...}
   [Indeed SmartApply] ✅ Page type for applybyapplyablejobid: ???
   ```

4. **Page handler step:**
   ```
   [Indeed SmartApply] 📄 Resume selection page detected
   OR
   [Indeed SmartApply] ❓ Questions page detected
   OR
   [Indeed SmartApply] 📱 Contact info page detected
   ```

## Common Issues & Solutions

| Issue | Sign | Solution |
|-------|------|----------|
| **Page not detected** | No SmartApply logs in console | Make sure console is open BEFORE clicking Apply |
| **Form inputs = 0** | `textInputs: 0` in logs | Page might use iframes or special elements. Check page source. |
| **Wrong page type** | Says "resume-selection" but should be "questions" | This means form fields aren't being detected. Check selector compatibility. |
| **Page loading too slow** | Logs only count to 10s then stop | Network issue or page has performance problems. Try again or check Internet. |
| **No auto-fill happening** | Sees questions page but no "Auto-fill complete" message | Check if profile fields are saved in extension settings. |

## What Should Happen (Happy Path)
```
Extension detects SmartApply page
  ↓
Waits for page to load form elements
  ↓
Detects page type (resume OR questions OR contact)
  ↓
For questions/contact: Auto-fills fields from saved profile
  ↓
Finds Continue/Submit button
  ↓
Clicks it
  ↓
Navigates to next step or completion
```

## Debug Mode
To see even more detailed logs, you can check:
- Chrome DevTools → Console: Lots of `[Indeed SmartApply]` prefixed messages
- Chrome DevTools → Network tab: Track all requests to smartapply.indeed.com
- Check if any errors appear in red

## Still Not Working?
1. **Check your saved profile settings:**
   - Open extension popup
   - Verify your email, phone, name are filled in
   - Make sure "Auto-Submit" toggle is ON

2. **Try a fresh apply:**
   - Close all extension popups
   - Reload the Indeed page
   - Try applying to a fresh job listing

3. **Share these in your feedback:**
   - Full console logs from F12
   - The Indeed job URL you were applying to
   - The SmartApply URL you were redirected to
   - Screenshot of the form you expected to be filled
