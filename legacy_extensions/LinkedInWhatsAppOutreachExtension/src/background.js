/**
 * LinkedIn to WhatsApp Job Outreach Pro - Background Service Worker
 */

const DEFAULT_SETTINGS = {
  targetKeywords: [
    'wordpress',
    'shopify',
    'php',
    'web developer',
    'frontend',
    'full stack',
    'react',
    'web designer',
    'javascript',
    'html',
    'developer',
    'fresher',
    'electrical',
    'field engineer'
  ],
  messageTemplate: `Hi {name}!

I saw your hiring post on LinkedIn regarding the {job_title} role.

I am actively looking for new opportunities. Feel free to check out my portfolio & recent work (specializing in WordPress, Shopify, PHP & Web Development):
🌐 https://parveen-portfolio-xi.vercel.app/

I am available for immediate joining and would love to connect and share more details!

Best regards,
Parveen`,
  autoSendWhatsApp: false,       // If true, automatically clicks Send on WhatsApp Web
  autoCloseTab: true,            // Closes WhatsApp Web tab after sending
  filterJobSeekers: true,        // Avoid job seekers
  matchAllHiringPosts: true,     // Broad match for hiring posts with phones
  removeSentPostFromFeed: true,  // Auto-remove post card from LinkedIn feed after sending WhatsApp message
  autoScroll: true,
  debugMode: true,
  delayBetweenMessages: 6        // Seconds between outreach actions
};

// Initialize default storage
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'contactedLog', 'waLogs', 'duplicateStats']);
  if (!data.waSettings) {
    await chrome.storage.local.set({ waSettings: DEFAULT_SETTINGS });
  } else {
    // Merge new setting defaults
    await chrome.storage.local.set({ waSettings: { ...DEFAULT_SETTINGS, ...data.waSettings } });
  }
  if (!data.waLeads) {
    await chrome.storage.local.set({ waLeads: [] });
  }
  if (!data.contactedPhones) {
    await chrome.storage.local.set({ contactedPhones: [] });
  }
  if (!data.contactedLog) {
    await chrome.storage.local.set({ contactedLog: [] });
  }
  if (!data.duplicateStats) {
    await chrome.storage.local.set({ duplicateStats: { skippedCount: 0 } });
  }
  if (!data.waLogs) {
    await chrome.storage.local.set({ waLogs: [] });
  }
  console.log('[BG] LinkedIn WhatsApp Outreach extension initialized.');
});

// Active WhatsApp Tab Tracking
let activeOutreachTask = null;

// Message router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, payload } = request;

  switch (type) {
    case 'DISPATCH_WHATSAPP_MESSAGE': {
      handleDispatchWhatsApp(payload)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'WHATSAPP_MESSAGE_SENT': {
      handleMessageSent(payload, sender)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'SAVE_LEAD': {
      saveLeadToStorage(payload)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'GET_STATUS': {
      chrome.storage.local.get(['waSettings', 'waLeads', 'contactedPhones', 'contactedLog', 'duplicateStats'], (data) => {
        sendResponse({
          settings: data.waSettings || DEFAULT_SETTINGS,
          totalLeads: (data.waLeads || []).length,
          contactedCount: (data.contactedPhones || []).length,
          contactedLog: data.contactedLog || [],
          duplicateStats: data.duplicateStats || { skippedCount: 0 },
          activeTask: activeOutreachTask
        });
      });
      return true;
    }

    default:
      break;
  }
});

// Dispatch WhatsApp outreach
async function handleDispatchWhatsApp(lead) {
  const { waSettings, contactedPhones = [] } = await chrome.storage.local.get(['waSettings', 'contactedPhones']);
  const settings = waSettings || DEFAULT_SETTINGS;

  const cleanPhone = cleanPhoneNumber(lead.phone);
  if (!cleanPhone) {
    throw new Error('Invalid phone number: ' + lead.phone);
  }

  // Personalize message
  let text = settings.messageTemplate || DEFAULT_SETTINGS.messageTemplate;
  text = text.replace(/{name}/g, lead.recruiterName || 'Hiring Manager');
  text = text.replace(/{job_title}/g, lead.jobTitle || 'Engineer');
  text = text.replace(/{company}/g, lead.company || 'your team');
  text = text.replace(/{phone}/g, cleanPhone);

  const encodedText = encodeURIComponent(text);
  const waUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}&app_absent=0`;

  activeOutreachTask = {
    leadId: lead.id,
    urn: lead.urn || '',
    phone: cleanPhone,
    recruiterName: lead.recruiterName,
    jobTitle: lead.jobTitle,
    company: lead.company,
    autoSend: settings.autoSendWhatsApp,
    autoClose: settings.autoCloseTab,
    startTime: Date.now()
  };

  // Open WhatsApp Web in new tab
  const tab = await chrome.tabs.create({ url: waUrl, active: true });
  activeOutreachTask.tabId = tab.id;

  return { success: true, tabId: tab.id, phone: cleanPhone };
}

// When WhatsApp Web content script confirms message was sent
async function handleMessageSent(payload, sender) {
  const phone = payload.phone || (activeOutreachTask ? activeOutreachTask.phone : null);
  const { waLeads = [], contactedPhones = [], contactedLog = [] } = await chrome.storage.local.get(['waLeads', 'contactedPhones', 'contactedLog']);

  if (phone && !contactedPhones.includes(phone)) {
    contactedPhones.push(phone);
  }

  const nowIso = new Date().toISOString();

  // Add to persistent contactedLog
  const existingLogIndex = contactedLog.findIndex(item => item.phone === phone);
  const logEntry = {
    phone: phone,
    recruiterName: activeOutreachTask?.recruiterName || 'Recruiter',
    jobTitle: activeOutreachTask?.jobTitle || 'Role',
    company: activeOutreachTask?.company || '',
    urn: activeOutreachTask?.urn || '',
    sentAt: nowIso
  };

  if (existingLogIndex >= 0) {
    contactedLog[existingLogIndex] = { ...contactedLog[existingLogIndex], ...logEntry };
  } else {
    contactedLog.unshift(logEntry);
  }

  // Update lead status in storage
  const updatedLeads = waLeads.map(l => {
    if (l.cleanPhone === phone || (activeOutreachTask && l.id === activeOutreachTask.leadId)) {
      return { ...l, status: 'sent', sentAt: nowIso };
    }
    return l;
  });

  await chrome.storage.local.set({
    waLeads: updatedLeads,
    contactedPhones: contactedPhones,
    contactedLog: contactedLog
  });

  // Badge update
  chrome.action.setBadgeText({ text: `${contactedPhones.length}` });
  chrome.action.setBadgeBackgroundColor({ color: '#25D366' });

  // Broadcast to all LinkedIn tabs to auto-remove/hide the sent post card
  chrome.tabs.query({ url: ["https://*.linkedin.com/*", "http://*.linkedin.com/*"] }, (tabs) => {
    tabs.forEach(t => {
      chrome.tabs.sendMessage(t.id, {
        type: 'LEAD_MESSAGE_SENT',
        payload: {
          phone: phone,
          urn: activeOutreachTask ? activeOutreachTask.urn : '',
          leadId: activeOutreachTask ? activeOutreachTask.leadId : ''
        }
      }).catch(() => {});
    });
  });

  // Close tab if requested
  const shouldClose = payload.autoClose !== undefined ? payload.autoClose : (activeOutreachTask ? activeOutreachTask.autoClose : false);
  if (shouldClose && sender && sender.tab && sender.tab.id) {
    setTimeout(() => {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }, 1800);
  }

  activeOutreachTask = null;
  return { success: true };
}

// Save or update lead in storage
async function saveLeadToStorage(lead) {
  const { waLeads = [], contactedPhones = [] } = await chrome.storage.local.get(['waLeads', 'contactedPhones']);
  const cleanPhone = cleanPhoneNumber(lead.phone);

  const existingIndex = waLeads.findIndex(l => l.cleanPhone === cleanPhone || (lead.urn && l.urn === lead.urn));
  const isAlreadyContacted = contactedPhones.includes(cleanPhone);

  const leadRecord = {
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    urn: lead.urn || '',
    recruiterName: lead.recruiterName || 'Hiring Manager',
    jobTitle: lead.jobTitle || 'Engineer',
    company: lead.company || '',
    rawPhone: lead.phone,
    cleanPhone: cleanPhone,
    postSnippet: lead.postSnippet || '',
    timestamp: lead.timestamp || new Date().toISOString(),
    status: isAlreadyContacted ? 'sent' : (lead.status || 'pending')
  };

  if (existingIndex >= 0) {
    waLeads[existingIndex] = { ...waLeads[existingIndex], ...leadRecord };
  } else {
    waLeads.unshift(leadRecord);
  }

  // Cap at 300 leads
  while (waLeads.length > 300) {
    waLeads.pop();
  }

  await chrome.storage.local.set({ waLeads });
  return { success: true, lead: leadRecord };
}

// Helper: Normalize phone to international format without + or spaces (e.g. 918091184464)
function cleanPhoneNumber(raw) {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  
  // If 10 digits (Standard Indian mobile like 8091184464, 7743003735) -> prefix with 91
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  // If 11 digits starting with 0 -> remove 0 and add 91
  else if (digits.length === 11 && digits.startsWith('0')) {
    digits = '91' + digits.substring(1);
  }
  
  return digits;
}
