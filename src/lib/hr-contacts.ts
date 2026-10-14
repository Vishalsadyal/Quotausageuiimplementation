import crypto from "crypto";
import { promises as dns } from "dns";
import { prisma } from "src/lib/prisma";
import { sendMail } from "src/lib/mail";
import { hasHrContacts } from "src/lib/plans";

/**
 * HR Contacts: a shared pool of recruiter contacts (phone / email) that users messaged from public
 * LinkedIn hiring posts. Pro Connect users get DAILY_LIMIT new contacts a day, matched to their
 * target roles, and an email with the same list.
 *
 *   recordContactFromOutreach  capture on every paid send (if the user shares)
 *   setWhatsAppStatus          valid / invalid from real WhatsApp sends
 *   assignDailyContacts        pick today's contacts for a user (idempotent per day)
 *   sendDailyContactsEmail     email today's list
 *   removeContact              recruiter opt-out (keeps only a hash)
 */

export const DAILY_LIMIT = 20;
/** A recruiter goes to at most this many users per 7 days, so nobody gets flooded. */
export const WEEKLY_PER_CONTACT_CAP = 25;
/** Contacts not seen again within this window are no longer handed out. */
export const CONTACT_TTL_DAYS = 90;

export type ContactKind = "phone" | "email";

export type OutreachContactMeta = {
  recruiterName?: string;
  company?: string;
  jobTitle?: string;
  location?: string;
  postUrl?: string;
  postSnippet?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** YYYY-MM-DD in India time: the "day" a delivery belongs to. */
export function istDay(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// ── normalising ─────────────────────────────────────────────────────────────

export function normalizeContact(kind: ContactKind, raw: string) {
  if (kind === "phone") {
    const digits = String(raw || "").replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? digits : "";
  }
  const email = String(raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function contactHash(kind: ContactKind, value: string) {
  return crypto.createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

const clip = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have hiring in is it of on or our the this to we with you your job role roles team position opening openings urgent immediate join looking apply dm share send resume cv".split(" ")
);

/** Lowercase role / skill words used to match contacts to a user's target roles. */
export function roleKeywords(...texts: string[]) {
  const words = new Set<string>();
  for (const text of texts) {
    for (const w of String(text || "").toLowerCase().split(/[^a-z0-9+#.]+/)) {
      const word = w.replace(/^\.+|\.+$/g, "");
      if (word.length >= 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word)) words.add(word);
    }
  }
  return Array.from(words);
}

/** LinkedIn post link from the post id the extension sends, when it is a real activity URN. */
export function postUrlFromUrn(urn: string) {
  const m = String(urn || "").match(/urn:li:(activity|ugcPost|share):\d+/);
  return m ? `https://www.linkedin.com/feed/update/${m[0]}/` : "";
}

// ── checks ──────────────────────────────────────────────────────────────────

/** Does the email's domain accept mail? Unknown on timeout / DNS trouble (never blocks a send). */
export async function checkEmailDomain(email: string): Promise<"valid" | "invalid" | "unknown"> {
  const domain = email.split("@")[1];
  if (!domain) return "invalid";
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    return records.length ? "valid" : "invalid";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    return code === "ENOTFOUND" || code === "ENODATA" ? "invalid" : "unknown";
  }
}

// ── capture ─────────────────────────────────────────────────────────────────

/**
 * Adds (or refreshes) a contact the user just messaged. Skips users who turned sharing off and
 * recruiters who asked to be removed. Never throws: capture must not break a send.
 */
export async function recordContactFromOutreach(input: {
  userId: string;
  kind: ContactKind;
  rawValue: string;
  meta?: OutreachContactMeta;
}) {
  try {
    const value = normalizeContact(input.kind, input.rawValue);
    if (!value) return null;

    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { shareOutreachContacts: true } });
    if (!user?.shareOutreachContacts) return null;

    const removed = await prisma.hrContactRemoval.findUnique({ where: { valueHash: contactHash(input.kind, value) } });
    if (removed) return null;

    const meta = input.meta || {};
    const details = {
      recruiterName: clip(meta.recruiterName, 120),
      company: clip(meta.company, 160),
      jobTitle: clip(meta.jobTitle, 160),
      location: clip(meta.location, 120),
      postUrl: /^https:\/\/(www\.)?linkedin\.com\//.test(String(meta.postUrl || "")) ? clip(meta.postUrl, 300) : "",
      postSnippet: clip(meta.postSnippet, 400),
    };
    // Only overwrite stored details with non-empty new ones.
    const freshDetails = Object.fromEntries(Object.entries(details).filter(([, v]) => v)) as Partial<typeof details>;
    const keywords = roleKeywords(details.jobTitle, details.postSnippet).slice(0, 60).join(" ");
    const now = new Date();

    const contact = await prisma.hrContact.upsert({
      where: { kind_value: { kind: input.kind, value } },
      create: { kind: input.kind, value, ...details, keywords, firstSeenAt: now, lastSeenAt: now },
      update: { ...freshDetails, ...(keywords ? { keywords } : {}), lastSeenAt: now, seenCount: { increment: 1 } },
    });

    const sighting = await prisma.hrContactSighting
      .create({ data: { contactId: contact.id, userId: input.userId, jobTitle: details.jobTitle, postUrl: details.postUrl } })
      .catch(() => null); // already found by this user
    if (sighting && contact.seenCount > 1) {
      await prisma.hrContact.update({ where: { id: contact.id }, data: { contributorCount: { increment: 1 } } });
    }

    if (input.kind === "email" && contact.emailStatus === "unknown") {
      const status = await checkEmailDomain(value);
      if (status !== "unknown") await prisma.hrContact.update({ where: { id: contact.id }, data: { emailStatus: status } });
    }
    return contact.id;
  } catch (error) {
    console.error("[hr-contacts] capture failed:", error);
    return null;
  }
}

/** From a real WhatsApp send: "valid" after a message went out, "invalid" when WhatsApp says so. */
export async function setWhatsAppStatus(rawPhone: string, status: "valid" | "invalid") {
  const value = normalizeContact("phone", rawPhone);
  if (!value) return 0;
  const res = await prisma.hrContact.updateMany({ where: { kind: "phone", value }, data: { waStatus: status } });
  return res.count;
}

/** Recruiter opt-out: deletes the contact and blocks it from coming back (only a hash is kept). */
export async function removeContact(kind: ContactKind, rawValue: string) {
  const value = normalizeContact(kind, rawValue);
  if (!value) return false;
  const valueHash = contactHash(kind, value);
  await prisma.hrContactRemoval.upsert({ where: { valueHash }, create: { valueHash }, update: {} });
  await prisma.hrContact.deleteMany({ where: { kind, value } });
  return true;
}

// ── daily assignment ────────────────────────────────────────────────────────

const ROLE_ANSWER_KEYS = ["cp_pref_search_terms", "core_skills", "one_word_keywords", "two_words_keywords"];

/** The user's target roles and skills, from the search profile saved as screening answers. */
export async function userRoleKeywords(userId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { actorUserId: userId, action: "user.screening_answer_saved", targetId: { in: ROLE_ANSWER_KEYS } },
    orderBy: { createdAt: "desc" },
    select: { targetId: true, metadataJson: true },
    take: 40,
  });
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (!row.targetId || latest.has(row.targetId)) continue;
    const answer = (row.metadataJson as { answer?: unknown } | null)?.answer;
    latest.set(row.targetId, Array.isArray(answer) ? answer.join(" ") : String(answer || ""));
  }
  return new Set(roleKeywords(...latest.values()));
}

function scoreContact(
  contact: { keywords: string; waStatus: string; emailStatus: string; kind: string; lastSeenAt: Date; contributorCount: number },
  wanted: Set<string>,
  now: number
) {
  const words = contact.keywords.split(" ").filter(Boolean);
  const matches = wanted.size ? words.filter((w) => wanted.has(w)).length : 0;
  const verified = contact.kind === "phone" ? contact.waStatus === "valid" : contact.emailStatus === "valid";
  const ageDays = (now - contact.lastSeenAt.getTime()) / DAY_MS;
  return Math.min(matches, 6) * 10 + (verified ? 6 : 0) + Math.min(contact.contributorCount, 5) - Math.min(ageDays, 30) * 0.5;
}

/**
 * Today's contacts for a Pro Connect user: tops the day up to DAILY_LIMIT with contacts they have
 * never received, best role match first, then verified, then freshest. Safe to call repeatedly.
 */
export async function assignDailyContacts(userId: string, day = istDay()) {
  const already = await prisma.hrContactDelivery.count({ where: { userId, day } });
  const need = DAILY_LIMIT - already;
  if (need <= 0) return 0;

  const now = Date.now();
  const candidates = await prisma.hrContact.findMany({
    where: {
      lastSeenAt: { gte: new Date(now - CONTACT_TTL_DAYS * DAY_MS) },
      deliveries: { none: { userId } },
      sightings: { none: { userId } }, // they already have contacts they found themselves
      NOT: [{ kind: "phone", waStatus: "invalid" }, { kind: "email", emailStatus: "invalid" }],
    },
    orderBy: { lastSeenAt: "desc" },
    take: 600,
    select: {
      id: true,
      kind: true,
      keywords: true,
      waStatus: true,
      emailStatus: true,
      lastSeenAt: true,
      contributorCount: true,
      _count: { select: { deliveries: { where: { createdAt: { gte: new Date(now - 7 * DAY_MS) } } } } },
    },
  });

  const wanted = await userRoleKeywords(userId);
  const picked = candidates
    .filter((c) => c._count.deliveries < WEEKLY_PER_CONTACT_CAP)
    .map((c) => ({ id: c.id, score: scoreContact(c, wanted, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, need);
  if (!picked.length) return 0;

  const res = await prisma.hrContactDelivery.createMany({
    data: picked.map((p) => ({ userId, contactId: p.id, day })),
    skipDuplicates: true,
  });
  return res.count;
}

export const DELIVERY_SELECT = {
  id: true,
  day: true,
  sentAt: true,
  contact: {
    select: {
      id: true,
      kind: true,
      value: true,
      recruiterName: true,
      company: true,
      jobTitle: true,
      location: true,
      postUrl: true,
      postSnippet: true,
      waStatus: true,
      emailStatus: true,
      lastSeenAt: true,
      contributorCount: true,
    },
  },
} as const;

// ── daily email ─────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function contactRowHtml(c: { kind: string; value: string; recruiterName: string; company: string; jobTitle: string; postUrl: string; waStatus: string }) {
  const reach =
    c.kind === "phone"
      ? `<a href="https://wa.me/${esc(c.value)}" style="color:#059669;">+${esc(c.value)}</a>${c.waStatus === "valid" ? " ✓ WhatsApp" : ""}`
      : `<a href="mailto:${esc(c.value)}" style="color:#4f46e5;">${esc(c.value)}</a>`;
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
      <div style="font-weight:600;color:#111827;">${esc(c.jobTitle || "Hiring")}${c.company ? ` · ${esc(c.company)}` : ""}</div>
      <div style="color:#6b7280;font-size:13px;">${esc(c.recruiterName || "Recruiter")}${c.postUrl ? ` · <a href="${esc(c.postUrl)}" style="color:#6b7280;">post</a>` : ""}</div>
      <div style="font-size:14px;margin-top:2px;">${reach}</div>
    </td>
  </tr>`;
}

/** Emails today's contacts to a Pro Connect user (once per contact). Returns how many were sent. */
export async function sendDailyContactsEmail(userId: string, day = istDay()) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true, hrContactsDailyEmail: true },
  });
  if (!user || !hasHrContacts(user.plan) || !user.hrContactsDailyEmail) return 0;

  const deliveries = await prisma.hrContactDelivery.findMany({
    where: { userId, day, emailedAt: null },
    select: { id: true, contact: { select: { kind: true, value: true, recruiterName: true, company: true, jobTitle: true, postUrl: true, waStatus: true } } },
  });
  if (!deliveries.length) return 0;

  const appUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://autoapplycv.in").replace(/\/$/, "");
  const firstName = (user.name || "").split(" ")[0] || "there";
  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;padding:24px 0;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:24px;">
      <tr><td>
        <h2 style="margin:0 0 4px;color:#111827;">Your ${deliveries.length} HR contacts for today</h2>
        <p style="margin:0 0 16px;color:#6b7280;font-size:14px;">Hi ${esc(firstName)}, these recruiters recently posted roles that match what you're looking for.</p>
        <table width="100%" cellpadding="0" cellspacing="0">${deliveries.map((d) => contactRowHtml(d.contact)).join("")}</table>
        <p style="margin:20px 0 0;"><a href="${appUrl}/dashboard/hr-contacts" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Message them from your dashboard</a></p>
        <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;">Pro Connect · Keep it personal: one short, relevant message per recruiter. Turn this email off on the HR Contacts page.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = deliveries
    .map((d) => `${d.contact.jobTitle || "Hiring"}${d.contact.company ? ` at ${d.contact.company}` : ""}: ${d.contact.recruiterName || "Recruiter"}, ${d.contact.kind === "phone" ? "+" : ""}${d.contact.value}`)
    .join("\n");

  await sendMail({
    to: user.email,
    subject: `Your ${deliveries.length} HR contacts for today`,
    html,
    text: `${text}\n\nOpen your dashboard: ${appUrl}/dashboard/hr-contacts`,
    template: "hr_contacts_daily",
  });
  await prisma.hrContactDelivery.updateMany({ where: { id: { in: deliveries.map((d) => d.id) } }, data: { emailedAt: new Date() } });
  return deliveries.length;
}
