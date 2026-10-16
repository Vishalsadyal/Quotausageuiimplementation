/*
 * LinkedIn Jobs auto-apply - part 08: answers
 *
 * Question label normalisation and canonical keys, value formatters (phone, numbers, salary, city,
 * name), and answers to common Easy Apply questions from the profile.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

function normalizeLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalQuestionKey(label) {
  const n = String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!n) return "";
  if (n === "full name" || n === "full legal name" || n === "legal name") return "full_name";
  if (n === "first name" || n === "given name") return "first_name";
  if (n === "last name" || n === "family name" || n === "surname") return "last_name";
  if (n === "email" || n === "email address") return "email_address";
  if (n === "phone" || n === "phone number" || n === "mobile phone" || n === "mobile phone number" || n === "contact number") {
    return "phone_number";
  }
  if (n.includes("linkedin") && (n.includes("profile") || n.includes("url"))) return "linkedin_url";
  if (n.includes("portfolio") && (n.includes("url") || n.includes("website") || n.includes("site") || n === "portfolio")) {
    return "portfolio_url";
  }
  if (n === "current city" || n === "city" || n.includes("location city") || n.includes("city state")) {
    return "current_city";
  }
  if (n === "state" || n === "state region" || n === "region") return "state_region";
  if (n === "country") return "country";
  if (
    ((n.includes("authorized") && n.includes("work")) ||
      (n.includes("eligible") && n.includes("work")) ||
      (n.includes("work") && n.includes("authorization"))) &&
    (n.includes("united states") || n.includes("u s") || n.includes("us"))
  ) {
    return "work_authorization_us";
  }
  if ((n.includes("visa") && n.includes("sponsorship")) || (n.includes("require") && n.includes("sponsorship"))) {
    return "visa_sponsorship_required";
  }
  if (n.includes("onsite") || n.includes("on site")) return "comfortable_working_onsite";
  if (n.includes("commut")) return "comfortable_commuting";
  if (n.includes("relocat")) return "comfortable_relocation";
  if ((n.includes("salary") || n.includes("compensation") || n.includes("pay")) && n.includes("expect")) {
    return "expected_salary";
  }
  if (n.includes("year") && n.includes("experience")) return "years_of_experience";
  if (n.includes("bachelor") && n.includes("degree")) return "bachelors_degree_completed";
  if (n.includes("english") && n.includes("proficiency")) return "english_proficiency";
  if (n.includes("confidence") && n.includes("level")) return "cp_pref_confidence_level";
  if (n.includes("notice") && n.includes("period")) return "notice_period_days";
  if (n.includes("start") && n.includes("date")) return "start_date_availability";
  return n.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

function questionKeyFromLabel(label) {
  return canonicalQuestionKey(label);
}

function cleanQuestionLabel(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // LinkedIn puts the label in the page twice (visible + screen reader): "Location (city)Location (city)".
  const doubled = text.match(/^(.{3,}?)\s*\1$/);
  return doubled ? doubled[1].trim() : text;
}

function getQuestionLabel(block) {
  if (!block) return "";
  // A block shared by several questions (class-free layouts): return the label of the FIRST control,
  // which is the one fillQuestionBlock fills; the longest-label rule below could pick another
  // question's label and put its answer into the wrong field.
  if (typeof countQuestionsIn === "function" && countQuestionsIn(block) > 1) {
    const first = block.querySelector(QUESTION_CONTROL_SELECTOR);
    const root = first?.getRootNode?.() || document;
    const own =
      (first?.id && block.querySelector(`label[for="${CSS.escape(first.id)}"]`)?.textContent) ||
      first?.getAttribute("aria-label") ||
      String(first?.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => (root.getElementById?.(id) || document.getElementById(id))?.textContent || "")
        .join(" ") ||
      first?.closest("label")?.textContent ||
      "";
    return cleanQuestionLabel(own);
  }
  const candidates = [];
  const labelNodes = block.querySelectorAll(
    "label, legend, .fb-dash-form-element__label, .artdeco-text-input--label, [data-test-form-builder-radio-button-form-component__title], [class*='label']"
  );
  for (const el of labelNodes) {
    const text = cleanQuestionLabel(el.textContent || "");
    if (text) candidates.push(text);
  }

  const inputLike = block.querySelector(
    "input:not([type='hidden']), textarea, select, [role='combobox'], button[aria-haspopup='listbox'], [aria-labelledby]"
  );
  if (inputLike) {
    const ariaLabel = cleanQuestionLabel(inputLike.getAttribute("aria-label") || "");
    if (ariaLabel) candidates.push(ariaLabel);
    const labelledBy = String(inputLike.getAttribute("aria-labelledby") || "").trim();
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/g)) {
        const el = document.getElementById(id);
        const txt = cleanQuestionLabel(el?.textContent || "");
        if (txt) candidates.push(txt);
      }
    }
  }

  if (!candidates.length) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

function normalizePhoneForInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d]/g, "");
}

function normalizeNumberString(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.round(n)));
}

function normalizeAmount(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatNumericAnswer(value, maxFractionDigits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Number(n.toFixed(maxFractionDigits));
  return String(rounded);
}

function getSalaryAnswer(label, settings) {
  const l = normalizeLabel(label);
  const useCurrent = l.includes("current") || l.includes("present");
  const amount = normalizeAmount(useCurrent ? settings.currentCtc : settings.desiredSalary);
  if (amount === null) return "";
  if (l.includes("month")) return formatNumericAnswer(amount / 12, 2);
  if (l.includes("lakh") || l.includes("lac")) return formatNumericAnswer(amount / 100000, 2);
  return String(Math.round(amount));
}

function normalizeCityAnswer(currentCityValue, workLocationValue = "") {
  const source = String(currentCityValue || "").trim() || String(workLocationValue || "").trim();
  if (!source) return "";
  const noParen = source.split("(", 1)[0].trim();
  const firstPart = noParen.split(",", 1)[0].trim();
  const normalized = normalizeLabel(firstPart);
  if (!firstPart || ["remote", "united states", "usa", "india", "worldwide"].includes(normalized)) {
    return "";
  }
  return firstPart;
}

function buildFullName(settings) {
  const explicit = String(settings.fullName || "").trim();
  if (explicit) return explicit;
  return [settings.firstName, settings.middleName, settings.lastName]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function visibleText(el) {
  return normalizeLabel(el?.textContent || el?.innerText || "");
}

function isMarketingConsentQuestion(label) {
  const l = normalizeLabel(label);
  return (
    (l.includes("receive") && (l.includes("email") || l.includes("text") || l.includes("phone"))) ||
    l.includes("matching opportunities") ||
    l.includes("prerecorded voice")
  );
}

function answerCommonQuestion(label, settings) {
  const l = normalizeLabel(label);
  const key = questionKeyFromLabel(l);

  const fullName = buildFullName(settings);
  const currentCity = normalizeCityAnswer(settings.currentCity, currentJobContext.workLocation);
  const yearsValue =
    String(settings.yearsOfExperienceAnswer || "").trim() ||
    (Number(settings.currentExperience) >= 0 ? String(Number(settings.currentExperience)) : "3");
  const noticeDays = normalizeNumberString(settings.noticePeriodDays) || "30";
  const noticeMonths = noticeDays ? String(Math.floor(Number(noticeDays) / 30)) : "1";
  const noticeWeeks = noticeDays ? String(Math.floor(Number(noticeDays) / 7)) : "4";

  const identityKeys = new Set(["full_name", "first_name", "last_name", "phone_number", "email_address", "linkedin_url"]);
  const manualByKey = settings?.screeningAnswers?.[key];
  const manualByLabel = settings?.screeningAnswers?.[l];
  const manualValue = manualByKey ? String(manualByKey) : manualByLabel ? String(manualByLabel) : "";
  // Prefer explicit profile fields over screeningAnswers for identity fields to avoid bad/stale overrides.
  if (manualValue && !identityKeys.has(String(key || "").trim())) return manualValue;

  // 1. Visa sponsorship & Work Authorization
  if (l.includes("visa") || l.includes("sponsorship") || l.includes("require sponsorship") || l.includes("need sponsorship")) {
    return settings.requireVisa || "No";
  }
  if (
    l.includes("citizenship") ||
    l.includes("employment eligibility") ||
    l.includes("work authorization") ||
    (l.includes("authorized") && l.includes("work")) ||
    l.includes("legally authorized") ||
    l.includes("eligible to work")
  ) {
    return settings.usCitizenship || "Yes";
  }

  // 2. Skill-specific experience matching (e.g. "How many years of work experience do you have with [Skill]?")
  if (l.includes("experience") || l.includes("years of work") || l.includes("how many years") || l.includes("how many years of")) {
    const skillMatch = l.match(/(?:with|in|using|experience with|knowledge of|working with)\s+([^?.,]+)/i);
    if (skillMatch && skillMatch[1]) {
      const skillName = normalizeLabel(skillMatch[1].trim());
      const skillKey = questionKeyFromLabel(skillName);
      if (settings?.screeningAnswers) {
        if (!isBlankValue(settings.screeningAnswers[skillKey])) return String(settings.screeningAnswers[skillKey]);
        if (!isBlankValue(settings.screeningAnswers[skillName])) return String(settings.screeningAnswers[skillName]);
        for (const [k, v] of Object.entries(settings.screeningAnswers)) {
          const kNorm = normalizeLabel(k);
          if (kNorm.includes(skillName) || skillName.includes(kNorm)) {
            if (!isBlankValue(v)) return String(v);
          }
        }
      }
    }
    return yearsValue;
  }

  // 3. Education levels & degree completion
  if (l.includes("bachelor") || l.includes("undergraduate") || l.includes("b.tech") || l.includes("bs degree") || l.includes("ba degree")) {
    return settings.screeningAnswers?.["bachelors_degree_completed"] || "Yes";
  }
  if (l.includes("master") || l.includes("postgraduate") || l.includes("ms degree") || l.includes("mba")) {
    return settings.screeningAnswers?.["masters_degree_completed"] || "No";
  }
  if (l.includes("high school") || l.includes("ged") || l.includes("secondary education")) {
    return "Yes";
  }
  if (l.includes("highest") && (l.includes("education") || l.includes("degree") || l.includes("level of education"))) {
    return settings.educationLevel || "Bachelor's Degree";
  }

  // 4. Commute, On-site, and Relocation
  if (l.includes("commute") || l.includes("commuting") || l.includes("reliable transportation") || l.includes("travel to")) {
    return settings.screeningAnswers?.["comfortable_commuting"] || "Yes";
  }
  if (l.includes("on-site") || l.includes("onsite") || l.includes("in-person") || l.includes("in office") || l.includes("hybrid") || l.includes("work location")) {
    return settings.screeningAnswers?.["comfortable_working_onsite"] || "Yes";
  }
  if (l.includes("relocate") || l.includes("relocation") || l.includes("willing to move")) {
    return settings.screeningAnswers?.["comfortable_relocation"] || "Yes";
  }

  // 5. Background Checks, Drug Test, Driver's License
  if (l.includes("background check") || l.includes("background screening") || l.includes("background investigation")) {
    return settings.screeningAnswers?.["willing_background_check"] || "Yes";
  }
  if (l.includes("drug test") || l.includes("drug screen") || l.includes("drug screening")) {
    return settings.screeningAnswers?.["willing_drug_test"] || "Yes";
  }
  if (l.includes("driver") || l.includes("driver's license") || l.includes("driving license") || l.includes("valid license")) {
    return settings.screeningAnswers?.["valid_drivers_license"] || "Yes";
  }

  // 6. Language & English Proficiency
  if (l.includes("english") || l.includes("language proficiency") || l.includes("fluent in english") || l.includes("english proficiency")) {
    return settings.englishProficiency || settings.screeningAnswers?.["english_proficiency"] || "Professional";
  }

  // 7. Demographics & EEO
  if (l.includes("protected") && l.includes("veteran")) return settings.veteranStatus || "I am not a protected veteran";
  if (l.includes("veteran")) return settings.veteranStatus || "No";
  if (l.includes("disability") || l.includes("handicapped")) return settings.disabilityStatus || "No, I don't have a disability";
  if (l.includes("gender") || l.includes("sex")) return settings.gender || "";
  if (l.includes("ethnicity") || l.includes("race")) return settings.ethnicity || "";
  if (isMarketingConsentQuestion(l)) {
    return settings.marketingConsent || "Yes";
  }

  // 8. Notice Period & Availability
  if (l.includes("notice")) {
    if (l.includes("month")) return noticeMonths;
    if (l.includes("week")) return noticeWeeks;
    return noticeDays;
  }
  if (l.includes("available immediately") || l.includes("start immediately") || l.includes("immediate joiner")) {
    return "Yes";
  }
  if (l.includes("start date") || l.includes("when can you start") || l.includes("how soon can you start") || l.includes("earliest start")) {
    return "Immediately";
  }

  // 9. Compensation
  if (l.includes("salary") || l.includes("compensation") || l.includes("ctc") || l.includes("pay") || l.includes("hourly rate")) {
    return getSalaryAnswer(l, settings);
  }

  // 10. Contact & Profile Information
  if (l.includes("location") || l.includes("city") || l.includes("address")) return currentCity || "";
  if (l.includes("email")) return settings.contactEmail || "";
  if (l.includes("phone number") || l === "phone" || l.includes("mobile")) return normalizePhoneForInput(settings.phoneNumber || "");
  if (l.includes("phone country code")) return settings.phoneCountryCode || "";
  if (l.includes("signature")) return fullName;
  if (l.includes("name")) {
    if (l.includes("full")) return fullName;
    if (l.includes("first") && !l.includes("last")) return settings.firstName || fullName;
    if (l.includes("middle") && !l.includes("last")) return settings.middleName || "";
    if (l.includes("last") && !l.includes("first")) return settings.lastName || fullName;
    if (l.includes("employer")) return settings.recentEmployer || "";
    return fullName;
  }
  if (l.includes("linkedin")) return settings.linkedinUrl || "";
  if (l.includes("website") || l.includes("blog") || l.includes("portfolio") || l.includes("link") || l.includes("github")) return settings.websiteUrl || "";
  if (l.includes("scale of 1-10") || l.includes("confidence level")) return settings.confidenceLevel || "8";
  if ((l.includes("hear") || l.includes("come across")) && l.includes("this") && (l.includes("job") || l.includes("position"))) {
    return settings.websiteUrl || settings.linkedinUrl || "LinkedIn";
  }
  if (l.includes("headline")) return settings.linkedinHeadline || "";
  if (
    l.includes("description") ||
    l.includes("describe your") ||
    l.includes("brief description") ||
    l.includes("work description") ||
    l.includes("job description") ||
    l.includes("project description") ||
    l.includes("summary") ||
    l.includes("about yourself") ||
    l.includes("about you") ||
    l.includes("bio") ||
    l.includes("background")
  ) {
    const userSummary =
      settings.linkedinSummary ||
      settings.coverLetter ||
      settings.screeningAnswers?.["description"] ||
      settings.screeningAnswers?.["summary"] ||
      settings.screeningAnswers?.["profile_summary"] ||
      "";
    if (userSummary) return userSummary;
  }
  if (l.includes("cover")) return settings.coverLetter || "";
  if (l.includes("street")) return settings.streetAddress || "";
  if (l.includes("state") || l.includes("province")) return settings.stateRegion || "";
  if (l.includes("zip") || l.includes("postal")) return settings.postalCode || "";
  if (l.includes("country")) return settings.country || "";
  return "";
}
