// Outreach messages sent by the extension. Each one costs 1 Hire and is logged once per recipient
// (AuditLog action below, targetId = phone / email / post URN), which also gives the sent counts.
export const OUTREACH_ACTIONS = {
  whatsapp: "outreach.whatsapp_sent",
  email: "outreach.email_sent",
  comment: "outreach.comment_posted",
} as const;

export type OutreachChannel = keyof typeof OUTREACH_ACTIONS;
