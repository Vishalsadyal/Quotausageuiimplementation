function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => resolve(res || { ok: false }));
  });
}

function setStatus(text, ok = true) {
  const el = document.getElementById("status");
  el.textContent = text;
  el.style.color = ok ? "#166534" : "#b91c1c";
}

function listToText(value) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function parseList(id) {
  return String(document.getElementById(id).value || "")
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function setValue(id, value = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value;
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = Boolean(value);
}

function getValue(id) {
  const el = document.getElementById(id);
  if (!el) return "";
  return String(el.value || "").trim();
}

function getChecked(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  return Boolean(el.checked);
}

function setForm(settings) {
  setValue("apiBaseUrl", settings.apiBaseUrl || "");
  setValue("authToken", settings.authToken || "");
  setChecked("enableBackendSync", settings.enableBackendSync);
  setChecked("liveModeAcknowledged", settings.liveModeAcknowledged);

  setValue("maxApplicationsPerRun", String(settings.maxApplicationsPerRun ?? 200));
  setValue("maxSkipsPerRun", String(settings.maxSkipsPerRun || 50));
  setValue("switchNumber", String(settings.switchNumber || 30));

  setChecked("easyApplyOnly", settings.easyApplyOnly ?? true);
  setChecked("debugMode", settings.debugMode ?? false);
  setChecked("dryRun", settings.dryRun ?? true);
  setChecked("autoSubmit", settings.autoSubmit ?? false);
  setChecked("autoResumeOnAnswer", settings.autoResumeOnAnswer ?? true);
  setChecked("runNonStop", settings.runNonStop ?? false);
  setChecked("alternateSortBy", settings.alternateSortBy ?? false);
  setChecked("cycleDatePosted", settings.cycleDatePosted ?? false);
  setChecked("stopDateCycleAt24hr", settings.stopDateCycleAt24hr ?? true);
  setChecked("followCompanies", settings.followCompanies ?? false);
  setChecked("pauseBeforeSubmit", settings.pauseBeforeSubmit ?? false);
  setChecked("pauseAtFailedQuestion", settings.pauseAtFailedQuestion ?? true);
  setChecked("overwritePreviousAnswers", settings.overwritePreviousAnswers ?? false);

  setValue("searchTerms", listToText(settings.searchTerms));
  setChecked("randomizeSearchOrder", settings.randomizeSearchOrder);
  setValue("sortBy", settings.sortBy || "");
  setValue("datePosted", settings.datePosted || "Past week");
  setValue("salary", settings.salary || "");
  setValue("searchLocation", settings.searchLocation || "");
  setValue("experienceLevel", listToText(settings.experienceLevel));
  setValue("jobType", listToText(settings.jobType));
  setValue("onSite", listToText(settings.onSite));
  setValue("companies", listToText(settings.companies));
  setValue("filterLocations", listToText(settings.filterLocations));
  setValue("industry", listToText(settings.industry));
  setValue("jobFunction", listToText(settings.jobFunction));
  setValue("jobTitles", listToText(settings.jobTitles));
  setValue("benefits", listToText(settings.benefits));
  setValue("commitments", listToText(settings.commitments));
  setChecked("under10Applicants", settings.under10Applicants);
  setChecked("inYourNetwork", settings.inYourNetwork);
  setChecked("fairChanceEmployer", settings.fairChanceEmployer);
  setChecked("didMasters", settings.didMasters);
  setChecked("securityClearance", settings.securityClearance);
  setValue("currentExperience", String(settings.currentExperience ?? -1));
  setValue("blacklistedCompanies", listToText(settings.blacklistedCompanies));
  setValue("aboutCompanyBadWords", listToText(settings.aboutCompanyBadWords));
  setValue("aboutCompanyGoodWords", listToText(settings.aboutCompanyGoodWords));
  setValue("badWords", listToText(settings.badWords));

  setValue("currentCity", settings.currentCity || "");
  setValue("contactEmail", settings.contactEmail || "");
  setValue("phoneNumber", settings.phoneNumber || "");
  setValue("phoneCountryCode", settings.phoneCountryCode || "");
  setValue("marketingConsent", settings.marketingConsent || "No");
  setValue("requireVisa", settings.requireVisa || "No");

  setValue("usCitizenship", settings.usCitizenship || "");
  setValue("veteranStatus", settings.veteranStatus || "");
  setValue("disabilityStatus", settings.disabilityStatus || "");
  setValue("gender", settings.gender || "");
  setValue("ethnicity", settings.ethnicity || "");
  setValue("yearsOfExperienceAnswer", settings.yearsOfExperienceAnswer || "");
  setValue("desiredSalary", settings.desiredSalary || "");
  setValue("currentCtc", settings.currentCtc || "");
  setValue("noticePeriodDays", settings.noticePeriodDays || "");
  setValue("confidenceLevel", settings.confidenceLevel || "");

  setValue("linkedinUrl", settings.linkedinUrl || "");
  setValue("websiteUrl", settings.websiteUrl || "");
  setValue("recentEmployer", settings.recentEmployer || "");

  setValue("firstName", settings.firstName || "");
  setValue("middleName", settings.middleName || "");
  setValue("lastName", settings.lastName || "");
  setValue("fullName", settings.fullName || "");

  setValue("streetAddress", settings.streetAddress || "");
  setValue("stateRegion", settings.stateRegion || "");
  setValue("postalCode", settings.postalCode || "");
  setValue("country", settings.country || "");

  setValue("linkedinHeadline", settings.linkedinHeadline || "");
  setValue("linkedinSummary", settings.linkedinSummary || "");
  setValue("coverLetter", settings.coverLetter || "");
}

function readForm() {
  const settings = {
    apiBaseUrl: "",
    authToken: "",
    enableBackendSync: false,
    liveModeAcknowledged: getChecked("liveModeAcknowledged"),

    maxApplicationsPerRun: Math.max(1, Number(getValue("maxApplicationsPerRun") || 200)),
    maxSkipsPerRun: Math.max(1, Number(getValue("maxSkipsPerRun") || 50)),
    switchNumber: Math.max(1, Number(getValue("switchNumber") || 30)),

    easyApplyOnly: getChecked("easyApplyOnly"),
    debugMode: getChecked("debugMode"),
    dryRun: getChecked("dryRun"),
    autoSubmit: getChecked("autoSubmit"),
    autoResumeOnAnswer: getChecked("autoResumeOnAnswer"),
    runNonStop: getChecked("runNonStop"),
    alternateSortBy: getChecked("alternateSortBy"),
    cycleDatePosted: getChecked("cycleDatePosted"),
    stopDateCycleAt24hr: getChecked("stopDateCycleAt24hr"),
    followCompanies: getChecked("followCompanies"),
    pauseBeforeSubmit: getChecked("pauseBeforeSubmit"),
    pauseAtFailedQuestion: getChecked("pauseAtFailedQuestion"),
    overwritePreviousAnswers: getChecked("overwritePreviousAnswers"),

    searchTerms: parseList("searchTerms"),
    randomizeSearchOrder: getChecked("randomizeSearchOrder"),
    sortBy: getValue("sortBy"),
    datePosted: getValue("datePosted"),
    salary: getValue("salary"),
    searchLocation: getValue("searchLocation"),
    experienceLevel: parseList("experienceLevel"),
    jobType: parseList("jobType"),
    onSite: parseList("onSite"),
    companies: parseList("companies"),
    filterLocations: parseList("filterLocations"),
    industry: parseList("industry"),
    jobFunction: parseList("jobFunction"),
    jobTitles: parseList("jobTitles"),
    benefits: parseList("benefits"),
    commitments: parseList("commitments"),
    under10Applicants: getChecked("under10Applicants"),
    inYourNetwork: getChecked("inYourNetwork"),
    fairChanceEmployer: getChecked("fairChanceEmployer"),
    didMasters: getChecked("didMasters"),
    securityClearance: getChecked("securityClearance"),
    currentExperience: Number(getValue("currentExperience") || -1),
    blacklistedCompanies: parseList("blacklistedCompanies"),
    aboutCompanyBadWords: parseList("aboutCompanyBadWords"),
    aboutCompanyGoodWords: parseList("aboutCompanyGoodWords"),
    badWords: parseList("badWords"),

    currentCity: getValue("currentCity"),
    contactEmail: getValue("contactEmail"),
    phoneNumber: getValue("phoneNumber"),
    phoneCountryCode: getValue("phoneCountryCode"),
    marketingConsent: getValue("marketingConsent") || "No",
    requireVisa: getValue("requireVisa") || "No",

    usCitizenship: getValue("usCitizenship"),
    veteranStatus: getValue("veteranStatus"),
    disabilityStatus: getValue("disabilityStatus"),
    gender: getValue("gender"),
    ethnicity: getValue("ethnicity"),
    yearsOfExperienceAnswer: getValue("yearsOfExperienceAnswer"),
    desiredSalary: getValue("desiredSalary"),
    currentCtc: getValue("currentCtc"),
    noticePeriodDays: getValue("noticePeriodDays"),
    confidenceLevel: getValue("confidenceLevel"),

    linkedinUrl: getValue("linkedinUrl"),
    websiteUrl: getValue("websiteUrl"),
    recentEmployer: getValue("recentEmployer"),

    firstName: getValue("firstName"),
    middleName: getValue("middleName"),
    lastName: getValue("lastName"),
    fullName: getValue("fullName"),

    streetAddress: getValue("streetAddress"),
    stateRegion: getValue("stateRegion"),
    postalCode: getValue("postalCode"),
    country: getValue("country"),

    linkedinHeadline: getValue("linkedinHeadline"),
    linkedinSummary: getValue("linkedinSummary"),
    coverLetter: getValue("coverLetter")
  };

  return settings;
}

async function init() {
  const loaded = await sendMessage({ type: "CP_LOAD_SETTINGS" });
  if (loaded.ok) setForm(loaded.settings || {});
}

document.getElementById("settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const settings = readForm();
  if (!settings) return;
  const saved = await sendMessage({ type: "CP_SAVE_SETTINGS", settings });
  if (saved.ok) {
    setStatus("Settings saved");
    return;
  }
  setStatus(saved.error || "Failed to save settings", false);
});

init().catch(() => setStatus("Failed to load settings", false));
