# Jobs Smart Outreach — Setup & Usage Guide

## ✅ Quick Setup

### 1. **Load Extension in Chrome**
- Open `chrome://extensions/`
- Toggle **Developer mode** (top right)
- Click **"Load unpacked"**
- Select: `JobsSmartOutreachExtension/dist/`

### 2. **Hard Reload Extension**
- After any code changes, go to `chrome://extensions/`
- Click the refresh ⟳ icon on "Jobs Smart Outreach"

### 3. **Test the Extension**

**Option A: LinkedIn DOM Scraping** (Real Data)
- Go to: `https://www.linkedin.com/search/results/content/?keywords=we%20are%20hiring`
- Wait for feed to load with posts
- Click extension popup
- Enter keyword: `we are hiring`
- Click search
- Watch the **floating panel** at bottom-right of LinkedIn page
- See contacts being collected with increasing counter

**Option B: Dashboard** (Mock Data)
- Go to: `http://localhost:3001/dashboard/cold-emails`
- Click extension popup
- Click search
- Watch debug logs update with contacts

---

## 🔍 How It Works

### **Scraping Flow**
1. Click **Search** in extension popup
2. Extension navigates to **LinkedIn search page**
3. Content script **clicks each post** to expand
4. Extracts **email addresses** from expanded content
5. **Saves contacts** to dashboard
6. **Auto-scrolls** to load more posts
7. Repeats until **100 contacts** reached or timeout

### **Data Collected**
- ✅ Name
- ✅ Title (HR Manager, Recruiter, etc.)
- ✅ Company
- ✅ Email (primary objective)
- ✅ LinkedIn URL
- ✅ Category/Hashtags

---

## 🛠️ Debug Logs

**View Debug Logs:**
- Click extension popup
- Scroll to bottom
- Click **"📋 Copy Debug Logs"**
- Paste into text editor or browser console

**Key Log Events:**
- `content_scrape_request` — Scraping started
- `content_posts_found` — Posts detected on page
- `content_email_captured_from_detail` — Email extracted
- `contact_added` — Contact saved to dashboard
- `dom_scrape_done` — Scraping completed

---

## 📊 Clear Data

**Clear All Contacts:**
- Click extension popup
- Click **"🗑️ Clear All Contacts"**

**Clear Debug Logs:**
- Click extension popup
- Click **"Clear Debug Logs"**

---

## ⚙️ Environment Setup

### **For Real Google Custom Search** (Optional)
If you want to use the API instead of DOM scraping:

1. Get Google CSE credentials
2. Create `.env.local` file in app root:
   ```
   GOOGLE_CSE_API_KEY=your_api_key
   GOOGLE_CSE_ID=your_cx_id
   ```
3. Restart server: `npm run dev`

Without these, extension will use **real LinkedIn DOM scraping** automatically.

---

## 🚀 Performance Tips

- **First run takes 30-40 seconds** (scrolling + post clicking)
- **Timeout is 30 seconds** max before auto-stopping
- **Each post takes ~2 seconds** to click and extract
- **Approximate rate**: 2-3 contacts per post (one per expansion)

---

## ✨ Features

✅ **Real LinkedIn Scraping** — No API needed  
✅ **Automatic Pagination** — Scrolls and loads more posts  
✅ **Email Extraction** — Regex-based email detection  
✅ **Floating Panel** — Live progress display  
✅ **Debug Logging** — Complete activity history  
✅ **Contact Deduplication** — No duplicate emails  
✅ **Auto-stop** — Stops at 100 contacts or 30s timeout  
✅ **Error Recovery** — Handles timeouts gracefully  

---

## 🐛 Troubleshooting

### **Floating panel doesn't appear**
- Extension not loaded/reloaded
- LinkedIn page not fully loaded
- Open browser DevTools console to check errors

### **No contacts collected**
- LinkedIn page may have different DOM structure
- Check Debug Logs for `content_posts_found` event
- Try manual LinkedIn search to load posts

### **Timeout stops collection**
- 30-second timeout is intentional safety feature
- LinkedIn may be slow or blocking clicks
- Try again with more posts visible before clicking search

### **Contacts not saving to dashboard**
- Check if dashboard page is open in another tab
- Verify authentication (logged in to dashboard)
- Check browser console for errors

---

## 📝 File Structure

```
JobsSmartOutreachExtension/
├── src/
│   ├── background.js      — Service worker (orchestrates collection)
│   ├── content.js         — LinkedIn page injected script (scrapes emails)
│   ├── bridge.js          — Dashboard communication bridge
│   └── panel.css          — Floating panel styles
├── popup/
│   ├── popup.html         — Extension popup UI
│   ├── popup.js           — Popup script
│   └── popup.css          — Popup styles
├── manifest.json          — Extension configuration
├── icons/                 — Extension icons
└── dist/                  — Built extension (load in Chrome)
```

---

## 🔄 Dev Workflow

```bash
# Build extension
npm run build

# Run tests
npm test

# Watch mode (rebuild on changes)
npm run dev

# View test report
npx playwright show-report
```

---

**Last Updated**: March 19, 2026  
**Version**: 1.0.0  
**Status**: ✅ Production Ready
