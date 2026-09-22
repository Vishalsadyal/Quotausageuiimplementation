# Cloudflare Bypass - Quick Reference

## For Users

### When You See a Cloudflare Challenge

```
⚠️ "Just a moment..."  
🔍 "Checking your browser"  
Ray ID: 9dd9a506dc1de0d2
```

**What to do:**
1. **Wait 5-30 seconds** - Extension may auto-bypass
2. **If checkbox appears** - Click "I'm not a robot"
3. **If still stuck** - Check console for Ray ID (see below)

**Note:** Challenges are normal. The extension is designed to handle them automatically.

---

## For Developers

### Quick Access Points

#### 1. Check Challenge History (DevTools Console)

```javascript
// View all stored challenges
chrome.storage.local.get('cpCloudflareHistory', r => console.table(r.cpCloudflareHistory));

// Count challenges in last hour
const now = Date.now();
const hour = 60 * 60 * 1000;
chrome.storage.local.get('cpCloudflareHistory', r => {
  const recent = (r.cpCloudflareHistory || []).filter(c => 
    new Date(c.storedAt).getTime() > now - hour
  );
  console.log(`${recent.length} challenges in last hour`);
});
```

#### 2. View Real-Time Logs (DevTools Console)

Filter for CareerPilot messages:
```javascript
// Show only CareerPilot messages in console
// DevTools → Console → Filter box → "[CareerPilot]"
```

Look for:
```
[CareerPilot] 🚨 Cloudflare Challenge Detected
[CareerPilot] ⚠️ Cloudflare Challenge Detected | Status: 403 | Ray ID: ...
[CareerPilot] ✅ Challenge resolved after XXXms
[CareerPilot] 📝 Stored challenge event
```

#### 3. Analyze Bypass Strategies

```javascript
// Check what bypass strategies are enabled
const getBypassStrategy = function() {
  // Copy from cloudflare-bypass.js
};

const strategies = getBypassStrategy();
Object.entries(strategies).forEach(([name, config]) => {
  console.log(`${name}: ${config.enabled ? '✅ ON' : '❌ OFF'}`);
});
```

#### 4. Manually Clear History

```javascript
// Clear all stored challenges
chrome.storage.local.remove('cpCloudflareHistory');
console.log('✅ Challenge history cleared');
```

#### 5. Test Headers Being Sent

```javascript
// View bypass headers being injected
const CLOUDFLARE_BYPASS_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "Accept": "text/html,application/xhtml+xml...",
  "Sec-Fetch-Dest": "document",
  // ... more headers
};

Object.entries(CLOUDFLARE_BYPASS_HEADERS).forEach(([key, val]) => {
  console.log(`${key}: ${val.substring(0, 40)}...`);
});
```

---

## For Testing

### Playwright Challenge Test

```javascript
// Playwright waits up to 2 minutes for challenge resolution
const challengeTimeout = 2 * 60 * 1000;

await page.goto('https://www.indeed.com/jobs?q=engineer');

// Wait for page to load (or challenge to be solved)
await page.waitForTimeout(5000);

// Check if challenged
const isChallenge = await page.evaluate(() => 
  document.body.innerText.includes('Just a moment')
);

if (isChallenge) {
  console.log('⏳ Cloudflare challenge detected, waiting for resolution...');
  
  // Wait up to 2 minutes
  await page.waitForFunction(
    () => !document.body.innerText.includes('Just a moment'),
    { timeout: challengeTimeout }
  );
  
  console.log('✅ Challenge resolved');
}
```

### Manual Browser Test

1. Open DevTools (F12)
2. Go to Network tab
3. Visit https://www.indeed.com/jobs
4. Look for:
   - Response status: 200 (success) or 403/503 (challenge)
   - Response headers: Look for `CF-Ray` header
   - Server header: Should NOT say "cloudflare" if bypassed

---

## Architecture Overview

```
Content Script (content.js)
    ↓ detects page challenge text
    ↓ "Just a moment" found?
    ↓
Message: CP_CLOUDFLARE_CHALLENGE_DETECTED
    ↓
Background Script (background.js)
    ↓ stores in cpCloudflareHistory
    ↓ logs with Ray ID
    ↓
Chrome Storage
    ↓
Accessible in DevTools Console
```

---

## Common Ray IDs & Meaning

| Ray ID | Meaning | Action |
|--------|---------|--------|
| Any with status 403 | IP might be blocked | Wait 1-2 hours or change IP |
| Any with status 503 | Cloudflare overloaded | Retry automatically (exponential backoff) |
| Changes per request | Different challenge | Normal, retry will work |
| Same Ray ID > 3x | Possible bot signature | Check browser automation flags |

---

## Bypass Strategies Active

| Strategy | Purpose | Enabled |
|----------|---------|---------|
| **Anti-Bot Headers** | Emulate real browser | ✅ Yes |
| **Request Delays** | Appear more human | ✅ Yes |
| **Exponential Backoff** | Smart retry timing | ✅ Yes |
| **Extended Wait (2 min)** | Allow JS challenge | ✅ Yes |

---

## Performance Stats

- **Header Injection Time:** < 1ms
- **Retry Max Delay:** 8 seconds
- **Challenge Detection:** Every 2 seconds
- **History Storage:** < 1MB
- **Memory Impact:** Minimal (arrays auto-pruned)

---

## Troubleshooting Checklist

- [ ] Can you see `[CareerPilot]` messages in console?
- [ ] Is `cpCloudflareHistory` populated?
- [ ] Do you see Ray IDs in logs?
- [ ] Is the Ray ID different each time?
- [ ] Are you using a modern browser (Chrome 90+)?
- [ ] Is extension popup showing any errors?
- [ ] Have you tried clearing cache/cookies?
- [ ] Does the same Ray ID repeat every time?

---

## Next Steps if Stuck

1. **Collect Data**
   - Copy all `[CareerPilot]` console messages
   - Export challenge history (see above)
   - Note the Ray ID

2. **Report Issue**
   - Email: support@autoapplycv.in
   - Include Ray ID and challenge history
   - Include timestamp of when it happened
   - Your browser version and OS

3. **Workaround**
   - Disable auto-apply, use manual mode
   - Try from different network/IP
   - Wait 2+ hours before retrying
   - Clear all cookies and cache

---

**Quick Links:**
- [Full Implementation Guide](./CLOUDFLARE_IMPLEMENTATION.md)
- [User Troubleshooting Guide](./CLOUDFLARE_TROUBLESHOOTING.md)
- [DevTools Guide](https://developer.chrome.com/docs/devtools/)
- [Chrome Extension Debugging](https://developer.chrome.com/docs/extensions/mv3/getstarted/)

**Last Updated:** 2025-01-17
