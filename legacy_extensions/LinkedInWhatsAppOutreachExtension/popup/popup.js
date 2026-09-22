/**
 * LinkedIn to WhatsApp Job Outreach Pro - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const tabBtnSearch = document.getElementById('tab-btn-search');
  const tabBtnLeads = document.getElementById('tab-btn-leads');
  const tabBtnSettings = document.getElementById('tab-btn-settings');
  const paneSearch = document.getElementById('pane-search');
  const paneLeads = document.getElementById('pane-leads');
  const paneSettings = document.getElementById('pane-settings');

  const statTotal = document.getElementById('stat-total');
  const statSent = document.getElementById('stat-sent');
  const statPending = document.getElementById('stat-pending');
  const statDupes = document.getElementById('stat-dupes');
  const leadsBadge = document.getElementById('leads-count-badge');
  const leadsList = document.getElementById('popup-leads-list');

  const popSearchInput = document.getElementById('pop-search-input');
  const btnPopExecSearch = document.getElementById('btn-pop-exec-search');

  const inputKeywords = document.getElementById('pop-keywords');
  const inputTemplate = document.getElementById('pop-template');
  const checkRemoveSent = document.getElementById('pop-remove-sent');
  const checkMatchAll = document.getElementById('pop-match-all');
  const checkAutoSend = document.getElementById('pop-auto-send');
  const checkAutoClose = document.getElementById('pop-auto-close');
  const checkFilterSeekers = document.getElementById('pop-filter-seekers');
  const btnSaveSettings = document.getElementById('btn-save-pop-settings');
  const btnExport = document.getElementById('btn-export');

  let activePopupFilter = 'all';

  // Load data
  const data = await chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'duplicateStats']);
  const settings = data.waSettings || {};
  const leads = data.waLeads || [];
  const contacted = data.contactedPhones || [];
  const dupesCount = (data.duplicateStats && data.duplicateStats.skippedCount) || 0;

  // Populate settings
  if (settings.targetKeywords) inputKeywords.value = settings.targetKeywords.join(', ');
  if (settings.messageTemplate) inputTemplate.value = settings.messageTemplate;
  if (checkRemoveSent) checkRemoveSent.checked = settings.removeSentPostFromFeed !== false;
  if (checkMatchAll) checkMatchAll.checked = settings.matchAllHiringPosts !== false;
  if (checkAutoSend) checkAutoSend.checked = !!settings.autoSendWhatsApp;
  if (checkAutoClose) checkAutoClose.checked = settings.autoCloseTab !== false;
  if (checkFilterSeekers) checkFilterSeekers.checked = settings.filterJobSeekers !== false;

  // Stats
  const sentCount = leads.filter(l => l.status === 'sent').length;
  statTotal.textContent = `${leads.length}`;
  statSent.textContent = `${sentCount}`;
  statPending.textContent = `${leads.length - sentCount}`;
  if (statDupes) statDupes.textContent = `${dupesCount}`;
  leadsBadge.textContent = `${leads.length} Leads`;

  // Render Leads
  renderPopupLeads(leads);

  // Tabs
  tabBtnSearch.addEventListener('click', () => switchTab('search'));
  tabBtnLeads.addEventListener('click', () => switchTab('leads'));
  tabBtnSettings.addEventListener('click', () => switchTab('settings'));

  function switchTab(tab) {
    [tabBtnSearch, tabBtnLeads, tabBtnSettings].forEach(t => t?.classList.remove('active'));
    [paneSearch, paneLeads, paneSettings].forEach(p => { if (p) p.style.display = 'none'; });

    if (tab === 'search') {
      tabBtnSearch.classList.add('active');
      paneSearch.style.display = 'block';
    } else if (tab === 'leads') {
      tabBtnLeads.classList.add('active');
      paneLeads.style.display = 'block';
    } else if (tab === 'settings') {
      tabBtnSettings.classList.add('active');
      paneSettings.style.display = 'block';
    }
  }

  // Filter Buttons in Popup Leads Pane
  document.querySelectorAll('.pop-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pop-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePopupFilter = btn.getAttribute('data-filter') || 'all';
      renderPopupLeads(leads);
    });
  });

  // Execute Search
  function performSearch(query) {
    const q = (query || '').trim();
    if (!q) {
      alert('Please enter a keyword to search.');
      return;
    }
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(q)}&sortBy=%5B%22date_posted%22%5D`;
    chrome.tabs.create({ url: searchUrl });
  }

  btnPopExecSearch?.addEventListener('click', () => {
    performSearch(popSearchInput ? popSearchInput.value : '');
  });

  popSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch(popSearchInput.value);
    }
  });

  document.querySelectorAll('.pop-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-q');
      if (popSearchInput) popSearchInput.value = q;
      performSearch(q);
    });
  });

  // Save settings
  btnSaveSettings.addEventListener('click', async () => {
    const rawKws = inputKeywords.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const updatedSettings = {
      ...settings,
      targetKeywords: rawKws.length > 0 ? rawKws : ['wordpress', 'react', 'web developer', 'fresher'],
      messageTemplate: inputTemplate.value.trim(),
      removeSentPostFromFeed: checkRemoveSent ? checkRemoveSent.checked : true,
      matchAllHiringPosts: checkMatchAll ? checkMatchAll.checked : true,
      autoSendWhatsApp: checkAutoSend.checked,
      autoCloseTab: checkAutoClose.checked,
      filterJobSeekers: checkFilterSeekers.checked
    };
    await chrome.storage.local.set({ waSettings: updatedSettings });
    alert('Settings saved successfully!');
  });

  // Export CSV
  btnExport?.addEventListener('click', () => {
    if (leads.length === 0) {
      alert('No leads to export.');
      return;
    }
    const headers = ['Recruiter Name', 'Company', 'Job Title', 'Phone Number', 'Status', 'Extracted At', 'Post Snippet'];
    const rows = leads.map(l => [
      `"${(l.recruiterName || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.jobTitle || '').replace(/"/g, '""')}"`,
      `"+${l.cleanPhone}"`,
      `"${l.status}"`,
      `"${l.timestamp}"`,
      `"${(l.postSnippet || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `whatsapp_leads_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  function renderPopupLeads(items) {
    if (!leadsList) return;

    let itemsToRender = items;
    if (activePopupFilter === 'pending') {
      itemsToRender = items.filter(l => l.status !== 'sent');
    } else if (activePopupFilter === 'sent') {
      itemsToRender = items.filter(l => l.status === 'sent');
    }

    if (itemsToRender.length === 0) {
      leadsList.innerHTML = `
        <div class="empty-state">
          No ${activePopupFilter !== 'all' ? activePopupFilter : ''} leads found.<br>
          Open LinkedIn hiring search and start scanning!
        </div>
      `;
      return;
    }

    leadsList.innerHTML = '';
    itemsToRender.slice(0, 40).forEach(lead => {
      const isSent = lead.status === 'sent';
      const el = document.createElement('div');
      el.className = 'lead-item';
      el.innerHTML = `
        <div class="lead-item-top">
          <span class="lead-item-name">${escapeHtml(lead.recruiterName)}</span>
          <span style="font-size:10px; color:${isSent ? '#25D366' : '#38bdf8'};">${isSent ? '✅ Sent' : '⏳ Pending'}</span>
        </div>
        <div class="lead-item-title">🎯 ${escapeHtml(lead.jobTitle)}</div>
        <div class="lead-item-phone">📞 +${lead.cleanPhone}</div>
        <button class="btn-wa-sm" id="pop-wa-${lead.id}" style="${isSent ? 'background:rgba(37,211,102,0.2); color:#86efac; border:1px solid rgba(37,211,102,0.4);' : ''}">
          💬 ${isSent ? 'Message Again' : 'Open WhatsApp Chat'}
        </button>
      `;

      el.querySelector(`#pop-wa-${lead.id}`)?.addEventListener('click', () => {
        chrome.runtime.sendMessage({
          type: 'DISPATCH_WHATSAPP_MESSAGE',
          payload: lead
        });
      });

      leadsList.appendChild(el);
    });
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
