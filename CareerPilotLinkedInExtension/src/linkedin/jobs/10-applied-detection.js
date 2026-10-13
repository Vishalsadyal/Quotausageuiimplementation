/*
 * LinkedIn Jobs auto-apply - part 10: applied-detection
 *
 * Is a job already applied? Card and details-pane detection (5 strategies + CPLinkedInDom
 * fallback). LinkedIn job id / URL helpers, job key of a card, card metadata (title, company,
 * location).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function isAppliedStatusText(text) {
  const t = normalizeLabel(text);
  if (!t) return false;
  if (t.includes("easy apply")) return false;
  if (/\bapplication submitted\b/.test(t)) return true;
  if (/\bapplied\b/.test(t)) return true;
  if (/\bsubmitted\b/.test(t) && t.includes("application")) return true;
  return false;
}

// A whole status line such as "Applied", "Applied 3 days ago", "Applied on company website",
// "Application submitted". Must match the full text so titles like "Applied Scientist" don't count.
const APPLIED_STATUS_LINE_RE =
  /^(you )?(applied|application (submitted|sent|viewed))( (\d+|a|an) (second|minute|hour|day|week|month|year)s? ago| on [a-z ]+| [·•].*)?$/;

function isAppliedStatusLine(text) {
  const t = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= 60 && APPLIED_STATUS_LINE_RE.test(t);
}

/**
 * Returns which detection method found an "Applied" marker on a search card, or "" if none.
 * Several fallbacks because LinkedIn renames its card classes frequently.
 */
function detectAppliedCardMethod(card) {
  if (!card?.querySelectorAll) return "";
  const titleAnchor = getCardAnchor(card);
  const outsideTitle = (node) => !titleAnchor || !titleAnchor.contains(node);

  // 1. Known footer/state classes (classic LinkedIn layout).
  const footerNodes = card.querySelectorAll(
    ".job-card-container__footer-job-state, .job-card-container__footer-item, .job-card-list__footer-wrapper li, .job-card-container__footer-wrapper li, .jobs-card__listdate"
  );
  for (const node of footerNodes) {
    if (outsideTitle(node) && isAppliedStatusLine(node.textContent)) return "footer-class";
  }

  // 2. Any short leaf element (li/span/time/strong/p/div with no child elements) whose text is a status line.
  for (const node of card.querySelectorAll("li, span, time, strong, p, div")) {
    if (node.childElementCount > 0 || !outsideTitle(node)) continue;
    if (isAppliedStatusLine(node.textContent)) return "leaf-text";
  }

  // 3. Rendered text lines of the card (covers new layouts with obfuscated class names).
  const lines = String(card.innerText || "").split(/\n+/);
  if (lines.some((line) => isAppliedStatusLine(line))) return "card-lines";

  // 4. Accessibility labels, e.g. aria-label="Applied" on a status icon.
  for (const node of card.querySelectorAll("[aria-label]")) {
    if (outsideTitle(node) && isAppliedStatusLine(node.getAttribute("aria-label"))) return "aria-label";
  }

  // 5. Legacy loose check on footer wrappers (kept for older LinkedIn markup).
  for (const node of card.querySelectorAll(".job-card-list__footer-wrapper, .job-card-container__footer-wrapper")) {
    if (isAppliedStatusText(node.textContent || "")) return "footer-legacy";
  }

  // 6. Shared fallback chain (adds status attributes and any future strategies).
  return globalThis.CPLinkedInDom?.appliedMethodOf(card) || "";
}

function isAlreadyAppliedCard(card) {
  return Boolean(detectAppliedCardMethod(card));
}

const JOB_DETAIL_ROOT_SELECTORS = [
  ".jobs-search__job-details",
  ".jobs-details",
  ".job-details-jobs-unified-top-card",
  ".jobs-unified-top-card",
  ".jobs-details-top-card",
  ".scaffold-layout__detail",
  "[data-view-name*='job-details']"
];

/** Returns which method found "Applied" in the open job's detail pane, or "". */
function detectAppliedInDetailPane() {
  const root = getBySelectorList(JOB_DETAIL_ROOT_SELECTORS) || globalThis.CPLinkedInDom?.findDetailPane().element;
  if (!root) return "";

  // 1. LinkedIn's applied banner / feedback ("Applied 2 days ago", "Application submitted").
  if (root.querySelector(".jobs-apply-button--applied, .post-apply-timeline")) return "detail-applied-class";
  for (const node of root.querySelectorAll(".artdeco-inline-feedback__message, .jobs-s-apply__application-link")) {
    if (isAppliedStatusLine(node.textContent)) return "detail-feedback";
  }

  // 2. "See application" / "Application status" controls only show after applying.
  for (const node of root.querySelectorAll("a, button")) {
    const label = `${node.getAttribute("aria-label") || ""} ${node.textContent || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (/^(see|view) (your )?application\b/.test(label) || /^application status\b/.test(label)) return "detail-see-application";
  }

  // 3. Short leaf text that is a status line.
  for (const node of root.querySelectorAll("span, li, p, div, time")) {
    if (node.childElementCount > 0) continue;
    if (isAppliedStatusLine(node.textContent)) return "detail-leaf-text";
  }

  // 4. Shared fallback chain (e.g. an "Applied" state on the apply button itself).
  return globalThis.CPLinkedInDom?.detailAppliedMethod(root) || "";
}

function extractLinkedInJobIdFromUrl(url) {
  const raw = String(url || "");
  if (!raw) return "";
  const viewMatch = raw.match(/\/jobs\/view\/(\d+)/);
  if (viewMatch?.[1]) return viewMatch[1];
  const currentJobIdMatch = raw.match(/[?&]currentJobId=(\d+)/);
  if (currentJobIdMatch?.[1]) return currentJobIdMatch[1];
  const jobIdMatch = raw.match(/[?&]jobId=(\d+)/);
  if (jobIdMatch?.[1]) return jobIdMatch[1];
  return "";
}

function extractLinkedInViewJobIdFromUrl(url) {
  const raw = String(url || "");
  if (!raw) return "";
  const viewMatch = raw.match(/\/jobs\/view\/(\d+)/);
  return viewMatch?.[1] ? String(viewMatch[1]) : "";
}

function buildCanonicalLinkedInJobUrl(jobId, fallbackUrl = "") {
  const normalizedJobId = String(jobId || "").trim();
  if (/^\d+$/.test(normalizedJobId)) {
    return `https://www.linkedin.com/jobs/view/${normalizedJobId}/`;
  }
  const fallbackJobId = extractLinkedInViewJobIdFromUrl(fallbackUrl) || extractLinkedInJobIdFromUrl(fallbackUrl);
  if (/^\d+$/.test(fallbackJobId)) {
    return `https://www.linkedin.com/jobs/view/${fallbackJobId}/`;
  }
  return String(fallbackUrl || "");
}

function extractLinkedInJobIdFromEntityUrn(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Examples:
  // urn:li:jobPosting:4375945722
  // urn:li:fsd_jobPosting:4375945722
  const m = raw.match(/jobPosting:(\d+)/i);
  if (m?.[1]) return String(m[1]);
  return "";
}

function getJobKeyFromCard(card) {
  // Prefer stable LinkedIn job IDs; do not fall back to title (causes duplicate opens).
  const explicitCandidates = [
    card?.getAttribute?.("data-occludable-job-id"),
    card?.closest?.("[data-occludable-job-id]")?.getAttribute?.("data-occludable-job-id"),
    card?.getAttribute?.("data-job-id"),
    card?.querySelector?.("[data-job-id]")?.getAttribute?.("data-job-id"),
  ].filter(Boolean);
  for (const candidate of explicitCandidates) {
    const explicit = String(candidate || "").trim();
    if (explicit && /^\d+$/.test(explicit)) return explicit;
  }

  const urnCandidates = [
    getCardAnchor(card)?.getAttribute?.("data-entity-urn"),
    card?.getAttribute?.("data-entity-urn"),
    card?.querySelector?.("[data-entity-urn]")?.getAttribute?.("data-entity-urn"),
  ].filter(Boolean);
  for (const urn of urnCandidates) {
    const id = extractLinkedInJobIdFromEntityUrn(urn) || extractLinkedInJobIdFromUrl(urn);
    if (id) return id;
  }

  const hrefCandidates = [
    String(getCardAnchor(card)?.href || ""),
    String(card?.querySelector?.("a[href*='/jobs/view/']")?.href || ""),
  ].filter(Boolean);
  for (const href of hrefCandidates) {
    const fromViewHref = extractLinkedInViewJobIdFromUrl(href);
    if (fromViewHref) return fromViewHref;
  }
  for (const href of hrefCandidates) {
    const fromHref = extractLinkedInJobIdFromUrl(href);
    if (fromHref) return fromHref;
  }

  // Shared fallback chain (job-id attributes, numeric attributes, selected tile URL, text fingerprint).
  // A text fingerprint is replaced by the real id from the URL once the card is opened.
  return globalThis.CPLinkedInDom?.jobIdOf(card)?.id || "";
}

function parseListSetting(value) {
  if (Array.isArray(value)) return value.map((v) => String(v || "").trim()).filter(Boolean);
  const raw = String(value || "").trim();
  if (!raw) return [];
  return raw
    .split(/[,\n]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function cleanJobTitle(raw) {
  let title = String(raw || "").trim();
  if (!title) return "Job";

  // Remove common LinkedIn badge and status noise
  title = title
    .replace(/\bwith verification\b/gi, "")
    .replace(/\bactively recruiting\b/gi, "")
    .replace(/\bbe an early applicant\b/gi, "")
    .replace(/\bpromoted by hirer\b/gi, "")
    .replace(/\bpromoted\b/gi, "")
    .replace(/\bviewed\b/gi, "")
    .replace(/\beasy apply\b/gi, "")
    .replace(/\bapplied \d+ .* ago\b/gi, "")
    .replace(/\bapplied\b/gi, "")
    .trim();

  // If word is duplicated together without space like "Web DesignerWeb Designer"
  if (title.length >= 6 && title.length % 2 === 0) {
    const half = title.length / 2;
    if (title.slice(0, half).toLowerCase() === title.slice(half).toLowerCase()) {
      title = title.slice(0, half);
    }
  }

  // If words are duplicated with space like "Javascript Developer Javascript Developer"
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    const firstHalf = words.slice(0, half).join(" ");
    const secondHalf = words.slice(half).join(" ");
    if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
      title = firstHalf;
    }
  }

  return title.replace(/\s+/g, " ").trim() || "Job";
}

function extractCardMeta(card) {
  const anchor = getCardAnchor(card);
  const rawTitle = String(
    anchor?.querySelector(".job-card-list__title--link span[aria-hidden='true']")?.textContent ||
    anchor?.querySelector("span[aria-hidden='true']")?.textContent ||
    anchor?.querySelector("strong")?.textContent ||
    anchor?.textContent ||
    card?.querySelector("a span")?.textContent ||
    ""
  ).trim();
  const titleRaw = cleanJobTitle(rawTitle);
  const title = normalizeLabel(titleRaw);
  const companyCandidates = [
    card?.querySelector(".artdeco-entity-lockup__subtitle"),
    card?.querySelector(".job-card-container__primary-description"),
    card?.querySelector(".job-card-list__subtitle"),
  ].filter(Boolean);
  const locationCandidates = [
    card?.querySelector(".job-card-container__metadata-item"),
    card?.querySelector(".job-card-container__metadata-wrapper li"),
    card?.querySelector(".job-card-list__location"),
    card?.querySelector(".artdeco-entity-lockup__caption")
  ].filter(Boolean);
  const companyRaw = String(companyCandidates[0]?.textContent || "").trim();
  const workLocationRaw = String(locationCandidates[0]?.textContent || "").trim();
  // Class-free fallback (src/linkedin/core/job.js) for layouts without the classes above.
  // (cleanJobTitle returns the placeholder "Job" for an empty title, so test the raw text.)
  const generic = !rawTitle || !companyRaw || !workLocationRaw ? globalThis.CPLinkedInJob?.readCard(card) : null;
  const finalTitleRaw = (rawTitle ? titleRaw : generic?.title) || titleRaw || "";
  const finalCompanyRaw = companyRaw || generic?.company || "";
  const finalLocationRaw = workLocationRaw || generic?.location || "";
  return {
    title: normalizeLabel(finalTitleRaw) || title,
    titleRaw: finalTitleRaw,
    company: normalizeLabel(finalCompanyRaw),
    companyRaw: finalCompanyRaw,
    workLocation: normalizeLabel(finalLocationRaw),
    workLocationRaw: finalLocationRaw,
    posted: generic?.posted || "",
  };
}

function getCardElementContainer(card) {
  if (!card) return null;
  return (
    card.closest(".job-card-container, li.jobs-search-results__list-item, .jobs-search-results-list__list-item, div[data-job-id], [data-occludable-job-id], [data-view-name='job-card']") ||
    card
  );
}
