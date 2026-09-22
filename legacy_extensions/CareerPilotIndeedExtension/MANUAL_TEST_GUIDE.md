# Manual Testing Guide for Indeed SmartApply

Since Cloudflare bot protection blocks automated tests, follow these steps for manual testing:

## Prerequisites

1. Make sure the extension is loaded in Chrome
2. Go to `chrome://extensions/` 
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `CareerPilotIndeedExtension` folder

## Test Steps

### 1. Configure Extension Settings

1. Click the extension icon in Chrome toolbar
2. Click "Options" or go to extension settings
3. Configure:
   - **Dry Run**: OFF (uncheck)
   - **Auto Submit**: ON (check)
   - **Max Applications**: 1 (for testing)
   - **Search Terms**: "developer" or "software engineer"
   - **Location**: "Remote" or your preferred location
   - **On-Site Filter**: Leave empty or check all options
   - **Security Clearance**: ON (check)
4. Save settings

### 2. Test Main Job Search Page

1. Go to https://www.indeed.com/jobs?q=developer&l=Remote
2. Wait for page to load
3. The CareerPilot panel should appear on the right side
4. Click the green **"Start"** button
5. Watch the console (F12 → Console tab)

**Expected behavior:**
- Console shows: `[Indeed Debug] 🎯 Processing job card`
- Console shows: `[Indeed Debug] ✅ Found apply button`
- Console shows: `[Indeed Debug] 🖱️ Clicking apply button...`
- A new tab opens with SmartApply form

### 3. Test SmartApply Resume Selection

When the new SmartApply tab opens at `https://smartapply.indeed.com/*/resume-selection`:

1. Check the console (F12 → Console)
2. Look for: `[Indeed SmartApply] 🚀 SmartApply page detected`
3. Look for: `[Indeed SmartApply] 📄 Resume selection page detected`
4. **Expected behavior:**
   - Extension auto-selects your Indeed Resume or uploaded PDF
   - Extension clicks the "Continue" button automatically
   - Page navigates to questions page

### 4. Test Questions Page

At `https://smartapply.indeed.com/*/questions`:

1. Check console for: `[Indeed SmartApply] ❓ Questions page detected`
2. **Expected behavior:**
   - Extension logs that questions need manual input
   - You fill out the employer's custom questions manually
   - Click "Submit application" or "Continue"

### 5. Verify Application Submission

1. Watch for confirmation page or success message
2. Check the main Indeed tab - the CareerPilot panel should show:
   - Applied: 1 (or higher)
   - Status updated in panel

## Troubleshooting

### Issue: Panel doesn't appear
**Solution:** 
- Reload the Indeed page (Ctrl+R)
- Check extension is enabled in `chrome://extensions/`
- Check console for errors

### Issue: Bot doesn't click apply button
**Solution:**
- Check console logs for filter messages
- Verify settings (Dry Run OFF, Auto Submit ON)
- Try different search terms to find jobs with direct apply

### Issue: SmartApply doesn't auto-fill
**Solution:**
- Check console logs in SmartApply tab
- Extension only auto-selects resume and clicks continue
- Questions require manual input (by design)

### Issue: Cloudflare blocks the page
**Solution:**
- This is normal for automated browsers
- Use manual testing as described above
- Complete Cloudflare challenge if prompted
- Once logged in and cookies saved, it should work better

## Console Debug Logs to Watch

### Main Indeed Page:
```
[Indeed Debug] 🎯 Processing job card: [Job Title]
[Indeed Debug] 🔍 Checking filters for job
[Indeed Debug] ✅ Work mode: accepting
[Indeed Debug] ✅ Found apply button: "apply now"
[Indeed Debug] 🖱️ Clicking apply button...
[Indeed Debug] ⏳ Waiting for apply modal...
[Indeed Debug] ⚠️ Apply modal did not appear - opened in new tab
```

### SmartApply Tab:
```
[Indeed SmartApply] 🚀 SmartApply page detected
[Indeed SmartApply] 📄 Resume selection page detected
[Indeed SmartApply] ✅ Clicking resume option: "indeed resume"
[Indeed SmartApply] ➡️ Clicking Continue button
[Indeed SmartApply] ❓ Questions page detected
```

## Success Criteria

✅ Extension panel loads on Indeed job search
✅ Bot finds and clicks "Apply now" buttons
✅ SmartApply tab opens automatically
✅ Resume is auto-selected in SmartApply
✅ Continue button is auto-clicked
✅ User can complete questions manually
✅ Application submits successfully

## Known Limitations

- **Employer Questions**: Cannot auto-fill custom questions (requires manual input)
- **Cloudflare**: Automated tests blocked by bot protection (manual testing works)
- **External Applies**: "Apply on company site" buttons are skipped (by design)
- **Complex Forms**: Multi-page forms with dropdowns/custom fields need manual completion

## Next Steps After Testing

If all tests pass:
1. Increase **Max Applications** in settings
2. Let it run on multiple jobs
3. Monitor the panel for applied/skipped/failed counts
4. Review applications in your Indeed account
