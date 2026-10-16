// Groups screening question keys that ask for the same thing, so one saved answer could serve all of them.
// First matching rule wins, so order matters (for example "expected" must come before "current" salary).
const GROUP_RULES: Array<[name: string, pattern: RegExp]> = [
  ["Notice period / joining time", /notice_period|how_soon|join_within|able_to_join|immediate_join|join_us|join_in|can_you_join|when_can_you_start|start_working|earliest|joining|join_date|start_date|available_to_start/],
  ["Expected salary / CTC", /(expect|desired|minimum).*(ctc|salary|compensation|pay)|(ctc|salary|compensation|pay).*(expect|desired|minimum)|ectc|bare_minimum|rate_cost_range/],
  ["Preferred salary range (min / max)", /salary_range|salary_max|salary_min/],
  ["Current salary / CTC", /ctc|salary|compensation|take_home|cctc|drawn|in_hand/],
  ["Years of experience (overall)", /^(cp_pref_)?years_of_experience$/],
  ["Visa sponsorship", /visa|sponsor/],
  ["Willing to relocate", /relocat/],
  ["U.S. work authorization", /us_citizenship|work_authorization_us/],
  ["Work mode (remote / onsite / hybrid)", /work_mode|remote_onsite_hybrid|comfortable_working_onsite|comfortable_commuting/],
  ["Confidence level", /confidence_level/],
  ["Preferred job titles", /search_terms|preferred_job_titles/],
  ["Preferred locations", /search_locations?$|preferred_locations|preference_search_location/],
  ["Preferred countries", /preferred_countries/],
  ["Job types", /job_types/],
  ["Professional summary", /^(description|summary)$|professional_description|summary_of_experience/],
  ["Technical skills", /^(core_skills|skills)$|technical_skills/],
  ["Exclude / blacklist keywords", /bad_words|blacklist_exclude|exclude_keywords|excluded_keywords/],
  ["1-word keywords", /one_word_keywords|1_word_keywords/],
  ["2-word keywords", /two_words_keywords|2_word_phrases/],
  ["Current city / location", /current_city|citycity|location_city|from_where_are_you_based|which_city|city_do_you|currently_live|where_do_you_live|where_are_you_(based|located)|current_location/],
  ["Postal / ZIP code", /postal_code|zip/],
  ["Name (first / last / full)", /^(first_name|last_name|full_name)$/],
  ["Phone / email", /^(phone_number|email_address)$/],
  ["Resume upload", /resume_upload/],
  ["Experience with one technology", /what_is_your_experience_with_|how_much_hands_on|which_programming|rate_your_proficiency|please_rate_yourself|rate_your_digital/],
  ["Where did you hear about us", /hear_about/],
  ["Reason for leaving current job", /reason_for_moving/],
  ["Industry worked in", /industry_worked/],
];

// Groups whose answer is interchangeable, so the extension reuses a saved answer for the other questions
// in the group (CareerPilotLinkedInExtension/src/linkedin/jobs/24-related-answer-groups.js keeps the same list).
export const SHAREABLE_SCREENING_GROUPS = new Set([
  "Notice period / joining time",
  "Expected salary / CTC",
  "Current salary / CTC",
  "Visa sponsorship",
  "Willing to relocate",
  "Current city / location",
  "Postal / ZIP code",
  "Where did you hear about us",
  "Reason for leaving current job",
  "Industry worked in",
]);

// Free-text groups: the answer is always typed text, even when it contains commas.
const TEXT_ONLY_GROUPS = new Set(["Professional summary", "Reason for leaving current job", "Where did you hear about us"]);

/** "text" when this question is always free text, otherwise null (use the saved or guessed type). */
export function forcedScreeningAnswerType(questionKey: string): "text" | null {
  const group = screeningGroupFor(questionKey);
  return group && TEXT_ONLY_GROUPS.has(group) ? "text" : null;
}

/** A short comma-separated list ("React, Node.js, SQL"), not a sentence or paragraph that has commas. */
export function looksLikeAnswerList(value: string) {
  const text = String(value || "").trim();
  if (!text.includes(",") || /[.!?]\s/.test(text) || text.length > 400) return false;
  const items = text.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length >= 2 && items.every((item) => item.length <= 40 && item.split(/\s+/).length <= 4);
}

/**
 * The answer type for a field the extension found on the LinkedIn form
 * (text, number, email, tel, url, textarea, select, radio, checkbox, date, combobox).
 */
export function answerTypeFromFormField(fieldType: string | null | undefined, options: string[] = []) {
  const type = String(fieldType || "").toLowerCase();
  if (type === "number") return "number";
  if (type === "select" || type === "radio" || type === "combobox") {
    const normalized = options.map((o) => o.trim().toLowerCase());
    return normalized.length === 2 && normalized.includes("yes") && normalized.includes("no") ? "boolean" : "choice";
  }
  if (type === "checkbox") return "boolean";
  return type ? "text" : null;
}

// How a question is answered, as shown in the small type tag next to it.
const SCREENING_TYPE_TAGS: Record<string, { label: string; className: string }> = {
  text: { label: "Text", className: "bg-sky-50 text-sky-700" },
  number: { label: "Number", className: "bg-orange-50 text-orange-700" },
  choice: { label: "Select", className: "bg-violet-50 text-violet-700" },
  boolean: { label: "Yes / No", className: "bg-teal-50 text-teal-700" },
  multiselect: { label: "Multi-select", className: "bg-pink-50 text-pink-700" },
};

export function screeningTypeTag(answerType: string | null | undefined) {
  return SCREENING_TYPE_TAGS[String(answerType || "text")] || SCREENING_TYPE_TAGS.text;
}

export function screeningGroupFor(questionKey: string): string | null {
  for (const [name, pattern] of GROUP_RULES) {
    if (pattern.test(questionKey)) return name;
  }
  return null;
}

// The same wording can be saved twice, once with a trailing "_" or the sentence repeated.
export function screeningKeyStem(questionKey: string) {
  return questionKey.replace(/_+$/, "").replace(/^(.{20,}?)_\1.*$/, "$1");
}
