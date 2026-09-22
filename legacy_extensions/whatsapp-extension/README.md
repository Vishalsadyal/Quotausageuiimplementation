# WhatsApp Campaign Extension

Chrome extension that automates sending WhatsApp campaign messages from the AutoApply dashboard.

## How It Works

1. Create a WhatsApp campaign in the dashboard (Marketing → WhatsApp)
2. Click **Send via Extension**
3. The extension opens `wa.me` links for each contact, auto-clicks the send button, tracks delivery status, and reports results back to the dashboard

## Architecture

```
┌─────────────────┐     chrome.storage      ┌──────────────────┐
│   Dashboard      │◄──────────────────────►│  Extension Bg     │
│   (Marketing     │   onChanged/Message     │  (background.js)  │
│    page)         │                          │                    │
└────────┬────────┘                          └─────────┬──────────┘
         │                                              │
         │ postMessage                                  │ chrome.tabs / scripting
         ▼                                              ▼
┌─────────────────┐                          ┌──────────────────┐
│  content-dash.js │                          │  content-wa.js   │
│  (in dashboard)  │                          │  (in WhatsApp)   │
└──────────────────┘                          └──────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest v3 |
| `background.js` | Service worker — orchestrates campaign queue |
| `content-dash.js` | Injected into dashboard — bridges UI to extension |
| `content-wa.js` | Injected into WhatsApp — sends messages |
| `popup.html` / `popup.js` | Popup UI showing status, logs, history |
| `icons/` | Extension icons |

## Features

- ✅ Queue multiple campaigns
- ✅ Auto-send via wa.me (clicks send button)
- ✅ Retry on failure (up to 3 attempts)
- ✅ Rate limiting (4s delay between contacts)
- ✅ Per-contact timeout (25s)
- ✅ Progress tracking in popup + dashboard
- ✅ Campaign history (last 50 campaigns)
- ✅ Cancel running campaign
- ✅ Error logging

## Installation (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `whatsapp-extension/` folder

## Usage

1. Go to AutoApply Dashboard → Marketing → WhatsApp
2. Create a campaign
3. Click **Send via Extension** (appears when extension is detected)
4. Extension processes each contact and reports results
