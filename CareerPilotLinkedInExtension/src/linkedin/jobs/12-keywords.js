/*
 * LinkedIn Jobs auto-apply - part 12: keywords
 *
 * Role keyword synonym dictionary and title/keyword matching against the configured search terms.
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

const KEYWORD_SYNONYM_DICTIONARY = {
  joomla: [
    "joomla developer",
    "wordpress developer",
    "php developer",
    "cms developer",
    "drupal developer",
    "web developer",
    "backend developer",
    "full stack developer"
  ],
  drupal: [
    "drupal developer",
    "php developer",
    "cms developer",
    "wordpress developer",
    "backend developer",
    "web developer"
  ],
  wordpress: [
    "wordpress developer",
    "wordpress engineer",
    "php developer",
    "woocommerce developer",
    "elementor developer",
    "cms developer",
    "web developer",
    "frontend developer"
  ],
  php: [
    "php developer",
    "laravel developer",
    "wordpress developer",
    "backend developer",
    "web developer",
    "full stack developer"
  ],
  react: [
    "react developer",
    "react js developer",
    "frontend developer",
    "frontend engineer",
    "next.js developer",
    "full stack developer",
    "javascript developer",
    "ui developer"
  ],
  angular: [
    "angular developer",
    "frontend developer",
    "frontend engineer",
    "typescript developer",
    "javascript developer",
    "web developer"
  ],
  vue: [
    "vue developer",
    "vue.js developer",
    "frontend developer",
    "nuxt developer",
    "javascript developer",
    "web developer"
  ],
  javascript: [
    "javascript developer",
    "frontend developer",
    "react developer",
    "node.js developer",
    "full stack developer",
    "web developer"
  ],
  typescript: [
    "typescript developer",
    "frontend developer",
    "full stack developer",
    "backend developer",
    "react developer",
    "node developer"
  ],
  python: [
    "python developer",
    "backend developer",
    "django developer",
    "fastapi developer",
    "data engineer",
    "python engineer",
    "software engineer"
  ],
  node: [
    "node.js developer",
    "nodejs developer",
    "backend engineer",
    "full stack developer",
    "express developer",
    "backend developer"
  ],
  java: [
    "java developer",
    "backend developer",
    "spring boot developer",
    "software engineer",
    "java software engineer"
  ],
  "c#": [
    "c# developer",
    ".net developer",
    "dotnet developer",
    "asp.net developer",
    "backend developer",
    "software engineer"
  ],
  ".net": [
    ".net developer",
    "dotnet developer",
    "c# developer",
    "asp.net developer",
    "backend developer"
  ],
  flutter: [
    "flutter developer",
    "mobile app developer",
    "dart developer",
    "android developer",
    "ios developer"
  ],
  "react native": [
    "react native developer",
    "mobile app developer",
    "frontend developer",
    "cross platform developer"
  ],
  android: [
    "android developer",
    "mobile app developer",
    "kotlin developer",
    "flutter developer"
  ],
  ios: [
    "ios developer",
    "swift developer",
    "mobile app developer",
    "flutter developer"
  ],
  "software engineer": [
    "software developer",
    "full stack engineer",
    "full stack developer",
    "backend engineer",
    "frontend engineer",
    "web developer"
  ],
  "software developer": [
    "software engineer",
    "full stack developer",
    "backend developer",
    "frontend developer",
    "web developer"
  ],
  "full stack": [
    "full stack developer",
    "full stack engineer",
    "software developer",
    "web developer",
    "backend developer",
    "frontend developer"
  ],
  frontend: [
    "frontend developer",
    "frontend engineer",
    "ui developer",
    "web developer",
    "react developer",
    "javascript developer"
  ],
  backend: [
    "backend developer",
    "backend engineer",
    "api developer",
    "software engineer",
    "server side developer"
  ],
  "data analyst": [
    "data analyst",
    "business analyst",
    "bi analyst",
    "analytics engineer",
    "sql analyst",
    "data reporting analyst"
  ],
  "business analyst": [
    "business analyst",
    "data analyst",
    "product analyst",
    "business systems analyst",
    "operations analyst"
  ],
  "data engineer": [
    "data engineer",
    "etl developer",
    "big data engineer",
    "analytics engineer",
    "python data engineer"
  ],
  "data scientist": [
    "data scientist",
    "machine learning engineer",
    "ai engineer",
    "data analyst",
    "quantitative analyst"
  ],
  "machine learning": [
    "machine learning engineer",
    "ai engineer",
    "data scientist",
    "nlp engineer",
    "deep learning engineer"
  ],
  "ai": [
    "ai engineer",
    "artificial intelligence engineer",
    "machine learning engineer",
    "data scientist",
    "python engineer"
  ],
  "ui/ux": [
    "ui/ux designer",
    "product designer",
    "ux designer",
    "ui designer",
    "web designer",
    "figma designer"
  ],
  "ux designer": [
    "ux designer",
    "product designer",
    "ui/ux designer",
    "interaction designer",
    "user researcher"
  ],
  "graphic designer": [
    "graphic designer",
    "visual designer",
    "brand designer",
    "digital designer",
    "creative designer"
  ],
  devops: [
    "devops engineer",
    "cloud engineer",
    "site reliability engineer",
    "sre",
    "aws engineer",
    "infrastructure engineer"
  ],
  cloud: [
    "cloud engineer",
    "aws engineer",
    "azure engineer",
    "devops engineer",
    "cloud architect"
  ],
  qa: [
    "qa engineer",
    "qa tester",
    "quality assurance engineer",
    "software tester",
    "automation tester",
    "sdet"
  ],
  tester: [
    "software tester",
    "qa engineer",
    "qa analyst",
    "automation tester",
    "manual tester"
  ],
  "digital marketing": [
    "digital marketing specialist",
    "seo specialist",
    "performance marketer",
    "growth marketer",
    "social media manager",
    "content marketer"
  ],
  marketing: [
    "marketing specialist",
    "digital marketer",
    "performance marketer",
    "growth marketer",
    "marketing coordinator"
  ],
  seo: [
    "seo specialist",
    "seo expert",
    "search engine optimization",
    "content marketer",
    "digital marketing specialist"
  ],
  "social media": [
    "social media manager",
    "social media specialist",
    "content creator",
    "community manager",
    "digital marketing specialist"
  ],
  content: [
    "content writer",
    "copywriter",
    "content strategist",
    "technical writer",
    "content creator"
  ],
  "appointment setter": [
    "appointment setter",
    "lead generation specialist",
    "cold caller",
    "inside sales representative",
    "sales development representative"
  ],
  sales: [
    "sales representative",
    "business development representative",
    "bdr",
    "sdr",
    "account executive",
    "inside sales"
  ],
  "customer support": [
    "customer support specialist",
    "customer service representative",
    "customer success manager",
    "technical support specialist"
  ],
  "human resources": [
    "hr specialist",
    "hr generalist",
    "recruiter",
    "talent acquisition specialist",
    "hr coordinator"
  ],
  recruiter: [
    "technical recruiter",
    "talent acquisition specialist",
    "it recruiter",
    "hr recruiter",
    "sourcer"
  ],
  "project manager": [
    "project manager",
    "scrum master",
    "product manager",
    "technical project manager",
    "program manager"
  ],
  "product manager": [
    "product manager",
    "associate product manager",
    "product owner",
    "technical product manager"
  ],
  sql: [
    "sql developer",
    "database developer",
    "database administrator",
    "sql engineer",
    "data engineer",
    "data analyst",
    "bi developer",
    "backend developer",
    "mysql developer",
    "postgresql developer"
  ],
  database: [
    "database developer",
    "database administrator",
    "dba",
    "sql developer",
    "data engineer",
    "data analyst",
    "backend developer"
  ],
  mysql: [
    "mysql developer",
    "database developer",
    "sql developer",
    "backend developer",
    "php developer"
  ],
  postgresql: [
    "postgresql developer",
    "database developer",
    "sql developer",
    "backend developer"
  ],
  mongodb: [
    "mongodb developer",
    "nosql developer",
    "backend developer",
    "full stack developer"
  ]
};

const COMMON_ROLE_MODIFIERS = new Set([
  "developer", "engineer", "specialist", "expert", "consultant", "analyst",
  "manager", "lead", "senior", "junior", "intern", "associate", "staff",
  "principal", "director", "head", "remote", "hybrid", "onsite", "freelance",
  "contract", "full-time", "part-time", "job", "role", "position"
]);

function getAlternativeKeywordsForTerm(term) {
  const norm = normalizeLabel(term);
  if (!norm) return [];
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYM_DICTIONARY)) {
    const keyNorm = normalizeLabel(key);
    if (norm === keyNorm || norm.includes(keyNorm) || keyNorm.includes(norm)) {
      return synonyms;
    }
  }
  return [];
}

function isKnownDictionaryRole(jobTitleRaw) {
  const title = normalizeLabel(jobTitleRaw);
  if (!title) return false;

  // 1. Direct dictionary key/synonym check
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYM_DICTIONARY)) {
    const keyNorm = normalizeLabel(key);
    if (keyNorm && (title.includes(keyNorm) || keyNorm.includes(title))) return true;
    for (const syn of synonyms) {
      const synNorm = normalizeLabel(syn);
      if (synNorm && (title.includes(synNorm) || synNorm.includes(title))) return true;
    }
  }

  // 2. Universal recognized professional / tech domain stems
  const UNIVERSAL_DICTIONARY_ROLES = [
    "developer", "software engineer", "programmer", "coder", "full stack",
    "frontend", "backend", "web developer", "web designer", "ui designer",
    "ux designer", "ui/ux", "product designer", "data analyst", "data scientist",
    "data engineer", "database", "sql", "mysql", "postgresql", "mongodb", "devops", "cloud engineer", "qa engineer",
    "software tester", "qa tester", "product manager", "project manager", "scrum master",
    "joomla", "drupal", "cms", "wordpress", "php", "laravel", "react", "next.js", "node", "nodejs",
    "python", "django", "fastapi", "java", "spring boot", ".net", "c#", "flutter",
    "android", "ios", "angular", "vue", "nuxt", "typescript", "javascript", "html", "css"
  ];

  return UNIVERSAL_DICTIONARY_ROLES.some((kw) => title.includes(normalizeLabel(kw)));
}

function isJobMatchingSearchKeywords(jobTitleRaw, activeKeyword, settings) {
  const title = normalizeLabel(jobTitleRaw);
  if (!title) return true;
  const active = normalizeLabel(activeKeyword);
  if (!active) return true;

  // 1. Direct exact/substring match
  if (title.includes(active) || active.includes(title)) return true;

  // 2. Split active keyword into core domain keywords (excluding generic words like developer/engineer/senior)
  const activeWords = active.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
  if (activeWords.length > 0 && activeWords.some((w) => title.includes(w))) {
    return true;
  }

  // 3. Check synonym dictionary for matches
  const synonyms = getAlternativeKeywordsForTerm(active);
  for (const syn of synonyms) {
    const synNorm = normalizeLabel(syn);
    if (title.includes(synNorm) || synNorm.includes(title)) return true;
    const synWords = synNorm.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
    if (synWords.length > 0 && synWords.some((w) => title.includes(w))) {
      return true;
    }
  }

  // 4. Check user-configured searchTerms
  const userTerms = parseListSetting(settings?.searchTerms);
  for (const ut of userTerms) {
    const utNorm = normalizeLabel(ut);
    if (utNorm && (title.includes(utNorm) || utNorm.includes(title))) return true;
    const utWords = utNorm.split(/\s+/).filter((w) => w.length >= 3 && !COMMON_ROLE_MODIFIERS.has(w));
    if (utWords.length > 0 && utWords.some((w) => title.includes(w))) {
      return true;
    }
  }

  // 5. Smart Cross-Dictionary Match:
  // If the job title matches ANY recognized role/skill in our dictionary (e.g. WordPress, PHP, React, SQL, Full Stack, Software Engineer, Data Analyst, etc.), accept it!
  if (isKnownDictionaryRole(title)) {
    return true;
  }

  return false;
}
