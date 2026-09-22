# Debug Capture Tools

## Quick Capture Methods

### Method 1: Console Commands (Easiest)

Open Chrome DevTools (F12), go to Console tab, and run:

```javascript
// Capture everything (HTML + logs + structure)
cpDebugCapture()

// Just get console logs
cpGetLogs()

// Copy logs to clipboard
cpCopyLogs()
```

### Method 2: Bookmarklet (One-Click)

1. Create a new bookmark in Chrome
2. Name it: "Capture Indeed Debug"
3. Set URL to this (copy entire line):

```javascript
javascript:(function(){window.cpDebugCapture?window.cpDebugCapture():alert('Extension not loaded or page not supported')})();
```

4. Click the bookmark when on Indeed page to capture debug info

### Method 3: Manual HTML Capture

If the above don't work:

1. Press F12 to open DevTools
2. Go to **Elements** tab
3. Right-click on `<html>` at the top
4. Select **Copy** → **Copy outerHTML**
5. Paste into a text file

**Plus Console Logs:**
1. Go to **Console** tab
2. Right-click in console
3. Select **Save as...**
4. Save console logs

## What Gets Captured

The `cpDebugCapture()` function captures:

✅ **Page Info:**
- Current URL
- Page title
- Timestamp
- User agent

✅ **HTML Structure:**
- Full page HTML
- All dialogs and their properties
- All forms and form fields
- All buttons (text, labels, visibility)
- All elements with "apply" in class/id

✅ **Extension State:**
- Current settings
- Console logs (last 200)

✅ **Output:**
- Downloads JSON file: `indeed-debug-[timestamp].json`
- Copies to clipboard automatically
- Prints to console for copy/paste

## How to Share Debug Info

### Option A: Send the Downloaded File
1. Run `cpDebugCapture()` in console
2. File downloads automatically: `indeed-debug-123456.json`
3. Send that file

### Option B: Copy from Console
1. Run `cpDebugCapture()` in console
2. Debug info is printed and copied to clipboard
3. Paste into message/email

### Option C: Just Logs
1. Run `cpCopyLogs()` in console
2. Paste the logs (automatically copied to clipboard)

## Troubleshooting

### "cpDebugCapture is not defined"
**Cause:** Extension not loaded on this page or content script hasn't run

**Solution:**
1. Reload the page (Ctrl+R)
2. Wait 2-3 seconds for extension to load
3. Check extension is enabled in `chrome://extensions/`
4. Try manual HTML capture method instead

### "Cannot read clipboard"
**Cause:** Browser security doesn't allow clipboard access

**Solution:** Use the downloaded JSON file instead

### Page is empty/frozen
**Cause:** Cloudflare or bot detection

**Solution:** 
1. Complete any Cloudflare challenge
2. Wait for page to fully load
3. Then run capture commands

## Debug Info Structure

The captured JSON has this structure:

```json
{
  "timestamp": "2026-03-16T...",
  "url": "https://smartapply.indeed.com/...",
  "pageTitle": "Apply - Indeed",
  "htmlSnapshot": "<html>...</html>",
  "documentStructure": {
    "dialogs": [...],
    "forms": [...],
    "buttons": [...],
    "applyElements": [...]
  },
  "settings": {
    "dryRun": false,
    "autoSubmit": true,
    ...
  },
  "extensionLogs": [...]
}
```

## When to Capture

Capture debug info when:

1. **Resume Selection Page** - When bot should auto-select resume
   - URL: `smartapply.indeed.com/*/resume-selection`
   - Run: `cpDebugCapture()`

2. **Questions Page** - To see what fields exist
   - URL: `smartapply.indeed.com/*/questions`
   - Run: `cpDebugCapture()`

3. **Job Search Page** - When apply button not clicking
   - URL: `www.indeed.com/jobs?...`
   - Run: `cpDebugCapture()`

4. **Any Error** - When something doesn't work
   - Run: `cpDebugCapture()` immediately
   - Also run: `cpCopyLogs()` to get console history

## Example Usage

```javascript
// 1. Load Indeed page
// 2. Open console (F12)
// 3. Run this:
await cpDebugCapture()

// 4. File downloads + clipboard has the data
// 5. Send the file or paste the clipboard
```

## Quick Test

To verify it's working:

```javascript
// Should print debug info and download file
cpDebugCapture()

// Should show array of log entries
cpGetLogs()

// Should copy logs to clipboard and show success message
cpCopyLogs()
```

If all three work, you're ready to capture debug info! 🎉
