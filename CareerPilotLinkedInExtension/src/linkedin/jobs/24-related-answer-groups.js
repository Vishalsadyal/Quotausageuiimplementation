/**
 * Related-question groups: LinkedIn words the same question many ways ("What is your current CTC?",
 * "Current salary in LPA", "Please update your current ctc"). When a question has no answer of its own,
 * the answer engine (24a-answer-engine.js) can borrow the user's saved answer to a related question.
 *
 * The group rules mirror src/lib/screening-groups.ts on the site (admin "Related groups" view).
 * Only groups whose answer is interchangeable are listed in RELATED_USABLE_GROUPS; groups such as
 * "experience with one technology" or "preferred salary range" would give a wrong answer.
 */

const RELATED_GROUP_RULES = [
  ["Notice period / joining time", /notice_period|how_soon|join_within|able_to_join|immediate_join|join_us|join_in|can_you_join|when_can_you_start|start_working|earliest|joining|join_date|start_date|available_to_start/],
  ["Expected salary / CTC", /(expect|desired|minimum).*(ctc|salary|compensation|pay)|(ctc|salary|compensation|pay).*(expect|desired|minimum)|ectc|bare_minimum|rate_cost_range/],
  ["Preferred salary range (min / max)", /salary_range|salary_max|salary_min/],
  ["Current salary / CTC", /ctc|salary|compensation|take_home|cctc|drawn|in_hand/],
  ["Years of experience (overall)", /^(cp_pref_)?years_of_experience$/],
  ["Visa sponsorship", /visa|sponsor/],
  ["Willing to relocate", /relocat/],
  ["Current city / location", /current_city|citycity|location_city|from_where_are_you_based|which_city|city_do_you|currently_live|where_do_you_live|where_are_you_(based|located)|current_location/],
  ["Postal / ZIP code", /postal_code|zip/],
  ["Experience with one technology", /what_is_your_experience_with_|how_much_hands_on|which_programming|rate_your_proficiency|please_rate_yourself|rate_your_digital/],
  ["Where did you hear about us", /hear_about/],
  ["Reason for leaving current job", /reason_for_moving/],
  ["Industry worked in", /industry_worked/],
];

// group -> the question types it may fill. Free-text and number fields only for the salary and
// notice groups, because their yes/no variants ("Can you join within 15 days?") need a different answer.
const RELATED_USABLE_GROUPS = {
  "Notice period / joining time": ["text", "number"],
  "Expected salary / CTC": ["text", "number"],
  "Current salary / CTC": ["text", "number"],
  "Visa sponsorship": ["text", "select", "radio"],
  "Willing to relocate": ["text", "select", "radio"],
  "Current city / location": ["text"],
  "Postal / ZIP code": ["text", "number"],
  "Where did you hear about us": ["text"],
  "Reason for leaving current job": ["text"],
  "Industry worked in": ["text"],
};

// A salary saved in LPA must not fill a field asking for INR, monthly or hourly pay.
const RELATED_UNIT_GROUPS = new Set(["Expected salary / CTC", "Current salary / CTC"]);

function relatedNormalizeText(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function relatedGroupOf(text) {
  const key = relatedNormalizeText(text);
  if (!key) return null;
  for (const [name, pattern] of RELATED_GROUP_RULES) {
    if (pattern.test(key)) return name;
  }
  return null;
}

function relatedUnitHint(text) {
  const key = relatedNormalizeText(text);
  if (/hour|usd|dollar/.test(key)) return "hourly";
  if (/month|in_hand|take_home/.test(key)) return "monthly";
  if (/lpa|lakh|lac/.test(key)) return "lpa";
  if (/(^|_)inr(_|$)|rupee/.test(key)) return "inr";
  return "";
}

/**
 * Saved answers to other questions in the same group as `label`.
 * Returns [{ value, via }] (at most 3, distinct values); empty when the group is not safe to share.
 */
function relatedGroupAnswers(label, saved, type) {
  const group = relatedGroupOf(label);
  const allowedTypes = group ? RELATED_USABLE_GROUPS[group] : null;
  if (!allowedTypes || !allowedTypes.includes(type)) return [];

  const ownKey = relatedNormalizeText(label);
  const ownUnit = relatedUnitHint(label);
  const out = [];
  const seen = new Set();
  for (const [key, rawValue] of Object.entries(saved || {})) {
    const value = String(rawValue ?? "").trim();
    if (!value || relatedNormalizeText(key) === ownKey) continue;
    if (relatedGroupOf(key) !== group) continue;
    if (RELATED_UNIT_GROUPS.has(group) && relatedUnitHint(key) !== ownUnit) continue;
    const dedupe = value.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ value, via: `related answer (${group}): "${String(key).replace(/_/g, " ").slice(0, 40)}"` });
    if (out.length >= 3) break;
  }
  return out;
}
