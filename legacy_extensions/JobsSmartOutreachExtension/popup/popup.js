// ─────────────────────────────────────────────────────────────────────────────
// Jobs Smart Outreach — popup.js
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CONTACTS  = 100;
const CIRCUMFERENCE = 2 * Math.PI * 24; // r=24 → ≈150.8

// ── DOM refs ──────────────────────────────────────────────────────────────────
const countDisplay  = document.getElementById('countDisplay');
const progressSub   = document.getElementById('progressSub');
const capBadge      = document.getElementById('capBadge');
const ringFill      = document.getElementById('ringFill');
const btnStart      = document.getElementById('btnStart');
const btnStop       = document.getElementById('btnStop');
const btnReset      = document.getElementById('btnReset');
const btnDashboard  = document.getElementById('btnDashboard');
const btnClear      = document.getElementById('btnClear');
const exportBtn     = document.getElementById('exportBtn');
const copyLogsBtn   = document.getElementById('copyLogsBtn');
const clearLogsBtn  = document.getElementById('clearLogsBtn');
const statusText    = document.getElementById('statusText');
const statusBar     = document.getElementById('statusBar');
const keywordInput  = document.getElementById('keyword');
const categorySelect= document.getElementById('category');

// ── Helpers ───────────────────────────────────────────────────────────────────

function setSpinner(active) {
  const existing = statusBar.querySelector('.spinner');
  if (active && !existing) {
    const sp = document.createElement('div');
    sp.className = 'spinner';
    statusBar.prepend(sp);
  } else if (!active && existing) {
    existing.remove();
  }
}

function updateRing(count) {
  const pct    = Math.min(1, count / MAX_CONTACTS);
  const offset = CIRCUMFERENCE * (1 - pct);
  ringFill.style.strokeDashoffset = offset;
  countDisplay.textContent = count;
  progressSub.textContent  =
    count >= MAX_CONTACTS ? 'Cap reached! Ready to send.' :
    count === 0           ? 'Not started yet' :
                            `${MAX_CONTACTS - count} more to collect`;
  capBadge.classList.toggle('hidden', count < MAX_CONTACTS);
}

function setCollectingUI(collecting) {
  btnStart.classList.toggle('hidden',  collecting);
  btnStop.classList.toggle('hidden',  !collecting);
  btnReset.classList.toggle('hidden', !collecting);
  keywordInput.disabled  = collecting;
  categorySelect.disabled = collecting;
  setSpinner(collecting);
}

function setStatus(msg) {
  statusText.textContent = msg;
}

// ── Load initial state ────────────────────────────────────────────────────────

async function loadStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'JSO_GET_STATUS' });
    updateRing(status.count ?? 0);
    setCollectingUI(status.isCollecting ?? false);
    if (status.keyword)  keywordInput.value   = status.keyword;
    if (status.category) categorySelect.value = status.category;
    if (status.lastError === 'AUTH_REQUIRED') {
      setCollectingUI(false);
      setStatus('🔐 Login required on dashboard. Click 📬 Dashboard, sign in, then press ▶ Start.');
      return;
    }
    if (status.lastError === 'API_UNAVAILABLE') {
      setStatus('⚠️ Search API unavailable (503). Switched to LinkedIn DOM fallback mode. Keep a LinkedIn tab open.');
    }
    setStatus(
      status.isCollecting
        ? `🔍 Searching for HR contacts… (${status.count}/${MAX_CONTACTS})`
        : status.count >= MAX_CONTACTS
        ? `✅ ${MAX_CONTACTS} contacts collected. Open Dashboard to send.`
        : status.count > 0
        ? `✅ ${status.count} contacts saved. Click ▶ to collect more.`
        : `Ready to collect. Click ▶ Start.`
    );
  } catch {
    setStatus('⚠️ Extension not ready — try reloading.');
  }
}

loadStatus();

// ── Listen for live status updates pushed by background ───────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'JSO_COLLECTING_STATUS') {
    updateRing(msg.count ?? 0);
    setStatus(`🔍 Searching: "${msg.query}" — ${msg.count}/${MAX_CONTACTS} collected`);
    setSpinner(true);
  }
  if (msg.type === 'JSO_COLLECTING_DONE') {
    updateRing(msg.count ?? 0);
    setCollectingUI(false);
    setStatus(
      msg.count >= MAX_CONTACTS
        ? `🎯 Done! ${MAX_CONTACTS} contacts collected. Open Dashboard to send campaign.`
        : `✅ Done! ${msg.count} contacts collected. Click ▶ to search more.`
    );
  }
});

// Lightweight poll — just keeps count fresh if background pushes are missed
const poll = setInterval(async () => {
  try {
    const status = await chrome.runtime.sendMessage({ type: 'JSO_GET_STATUS' });
    updateRing(status.count ?? 0);
    if (status.lastError === 'AUTH_REQUIRED') {
      setCollectingUI(false);
      setStatus('🔐 Dashboard session expired. Click 📬 Dashboard and login again.');
      return;
    }
    if (status.lastError === 'API_UNAVAILABLE' && status.isCollecting) {
      setStatus('⚠️ API unavailable; collecting via LinkedIn page fallback…');
      return;
    }
    if (!status.isCollecting) {
      setCollectingUI(false);
    }
  } catch { clearInterval(poll); }
}, 2000);

// ── Button Handlers ───────────────────────────────────────────────────────────

btnStart.addEventListener('click', async () => {
  const keyword  = keywordInput.value.trim() || 'we are hiring';
  const category = categorySelect.value;
  const contacts = await chrome.runtime.sendMessage({ type: 'JSO_GET_CONTACTS' });
  if ((contacts.count ?? 0) >= MAX_CONTACTS) {
    setStatus('🎯 Already at 100 contacts! Clear list or open Dashboard to send.');
    return;
  }
  setCollectingUI(true);
  setStatus('⏳ Starting — opening dashboard to connect to search API…');
  const res = await chrome.runtime.sendMessage({ type: 'JSO_START_COLLECTING', keyword, category });
  if (res?.ok === false && res?.reason === 'capped') {
    setCollectingUI(false);
    setStatus('🎯 Cap reached! Open Dashboard to send your campaign.');
  } else {
    setStatus(`🔍 Searching for "${keyword}" — results will appear shortly…`);
  }
});

btnStop.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'JSO_STOP_COLLECTING' });
  setCollectingUI(false);
  setStatus('⏹ Collection stopped.');
});

btnReset.addEventListener('click', async () => {
  // Fixes stuck "collecting" state without clearing collected contacts
  await chrome.runtime.sendMessage({ type: 'JSO_RESET' });
  setCollectingUI(false);
  setStatus('🔄 Reset. Click ▶ Start to collect again.');
});

btnDashboard.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'JSO_SYNC_TO_DASHBOARD' });
  window.close();
});

btnClear.addEventListener('click', async () => {
  if (!confirm('Clear all collected HR contacts?')) return;
  await chrome.runtime.sendMessage({ type: 'JSO_CLEAR_CONTACTS' });
  updateRing(0);
  setCollectingUI(false);
  setStatus('🗑 Contacts cleared. Click ▶ to start fresh.');
});

exportBtn.addEventListener('click', async () => {
  const resp = await chrome.runtime.sendMessage({ type: 'JSO_GET_CONTACTS' });
  const contacts = resp?.contacts ?? [];
  if (contacts.length === 0) {
    setStatus('⚠️ No contacts to export yet.');
    return;
  }
  const headers = ['Name', 'Title', 'Company', 'Email', 'Category', 'LinkedIn URL', 'Collected At'];
  const rows = contacts.map(c => [
    c.name, c.title, c.company, c.email, c.category, c.linkedinUrl, c.collectedAt,
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `hr_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`✅ Exported ${contacts.length} contacts as CSV.`);
});

copyLogsBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'JSO_GET_LOGS' });
    const logs = Array.isArray(resp?.logs) ? resp.logs : [];
    if (!logs.length) {
      setStatus('ℹ️ No logs yet. Run Start once, then copy logs.');
      return;
    }
    const lines = logs.map((entry, idx) => {
      const ts = entry?.ts || '';
      const level = String(entry?.level || 'info').toUpperCase();
      const event = entry?.event || 'unknown';
      const data = JSON.stringify(entry?.data || {});
      return `${idx + 1}. [${ts}] [${level}] ${event} ${data}`;
    });
    const text = `Jobs Smart Outreach Debug Logs\nTotal: ${logs.length}\n\n${lines.join('\n')}`;
    await navigator.clipboard.writeText(text);
    setStatus(`✅ Copied ${logs.length} logs to clipboard. Paste and send here.`);
  } catch (err) {
    setStatus(`⚠️ Copy failed: ${String(err?.message || err)}.`);
  }
});

clearLogsBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.runtime.sendMessage({ type: 'JSO_CLEAR_LOGS' });
  setStatus('🧹 Debug logs cleared.');
});
