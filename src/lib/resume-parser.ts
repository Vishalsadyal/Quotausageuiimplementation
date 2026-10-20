import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type ParsedResume = {
  text: string;
  extracted: {
    name?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    currentCity?: string;
  };
};

function normalizeWhitespace(input: string) {
  return input
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function sanitizeField(input?: string) {
  if (!input) return undefined;
  const value = input.replace(/\u0000/g, "").trim();
  return value || undefined;
}

function firstNonEmptyLine(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function extractEmail(text: string) {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return m?.[0];
}

// Any run of digits with phone punctuation, kept only when it has 10-13 digits (so dates and
// years such as "2019 – 2023" never match, and "+91 98055 59015" is not cut short).
function extractPhone(text: string) {
  const candidates = text.match(/\+?\(?\d[\d\s().-]{8,20}\d/g) || [];
  for (const raw of candidates) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) continue;
    if (/^(19|20)\d{2}\D+(19|20)\d{2}$/.test(raw.trim())) continue;
    return raw.trim();
  }
  return undefined;
}

// Accepts "linkedin.com/in/name" without a scheme and returns a full https URL.
function extractLinkedIn(text: string) {
  const m = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s)|,]+/i);
  if (!m) return undefined;
  const url = m[0].replace(/[.;]+$/, "");
  return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^www\./i, "www.")}`;
}

// Contact block: the lines before the first section heading (SUMMARY, EXPERIENCE, SKILLS, ...).
function headerLines(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const heading = /^(summary|profile|objective|about( me)?|experience|work experience|employment|education|skills|core skills|technical skills|projects?)\b/i;
  const end = lines.findIndex((line, i) => i > 0 && heading.test(line) && line.length < 40);
  return lines.slice(0, end > 0 ? Math.min(end, 12) : 8);
}

// A personal site from the contact block only: links further down are usually client or project sites.
function extractUrl(text: string) {
  const header = headerLines(text).join(" ").replace(/\S+@\S+/g, " "); // emails out: their domain is not a site
  const links: string[] = header.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s|,]*)?/gi) || [];
  // "Node.js" or "Three.js" in a title line look like domains: accept explicit links or real web endings only.
  const webTld = /\.(com|in|co|io|dev|me|org|net|app|ai|tech|site|xyz|info|page|design|online|pro|us|uk|ca|au|de|so|link|blog|portfolio)(\/|$)/i;
  const site = links.find(
    (link) =>
      !/linkedin\.com|@|gmail\.|yahoo\.|outlook\.|hotmail\./i.test(link) &&
      (/^(https?:\/\/|www\.)/i.test(link) || webTld.test(link.replace(/^https?:\/\//i, ""))),
  );
  if (!site) return undefined;
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

// "Palampur, Himachal Pradesh, India" from a contact line like "City, State | +91 ... | email".
function extractCity(text: string) {
  for (const line of headerLines(text).slice(1)) {
    for (const part of line.split(/[|•·]/).map((p) => p.trim())) {
      if (/^[A-Za-z][A-Za-z .'-]*(,\s*[A-Za-z][A-Za-z .'-]*){1,2}$/.test(part) && part.length <= 60) return part;
    }
  }
  return undefined;
}

async function parsePdfBuffer(bytes: Buffer): Promise<string> {
  // Strategy 1: Standard parse with modern PDFJS version
  try {
    const parsed = await pdfParse(bytes, { max: 0, version: "v2.0.550" });
    if (parsed.text && parsed.text.trim()) return parsed.text;
  } catch (err1) {
    const msg = err1 instanceof Error ? err1.message : String(err1);
    // If it failed with bad XRef entry, repair CRLF/LF line ending offsets caused by Windows file handling
    if (/xref/i.test(msg)) {
      try {
        const fixedLf = Buffer.from(bytes.toString("binary").replace(/\r\n/g, "\n"), "binary");
        const parsed = await pdfParse(fixedLf, { max: 0, version: "v2.0.550" });
        if (parsed.text && parsed.text.trim()) return parsed.text;
      } catch {
        try {
          const fixedCrlf = Buffer.from(bytes.toString("binary").replace(/(?<!\r)\n/g, "\r\n"), "binary");
          const parsed = await pdfParse(fixedCrlf, { max: 0, version: "v2.0.550" });
          if (parsed.text && parsed.text.trim()) return parsed.text;
        } catch {
          // Fall through to Strategy 2
        }
      }
    }
  }

  // Strategy 2: Fallback to default PDFJS version with both original and LF-normalized buffers
  try {
    const parsed = await pdfParse(bytes);
    if (parsed.text && parsed.text.trim()) return parsed.text;
  } catch {
    try {
      const fixedLf = Buffer.from(bytes.toString("binary").replace(/\r\n/g, "\n"), "binary");
      const parsed = await pdfParse(fixedLf);
      if (parsed.text && parsed.text.trim()) return parsed.text;
    } catch {
      // Fall through
    }
  }

  throw new Error("This PDF could not be read (corrupted XRef table). Please open and re-save it as PDF or DOCX.");
}

export async function parseResumeFile(fileName: string, bytes: Buffer): Promise<ParsedResume> {
  const lower = fileName.toLowerCase();
  let text = "";

  if (lower.endsWith(".pdf")) {
    text = await parsePdfBuffer(bytes);
  } else if (lower.endsWith(".docx")) {
    const parsed = await mammoth.extractRawText({ buffer: bytes });
    text = parsed.value || "";
  } else if (lower.endsWith(".txt")) {
    text = bytes.toString("utf8");
  } else {
    throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT");
  }

  const cleaned = normalizeWhitespace(text);
  const possibleName = firstNonEmptyLine(cleaned);
  const name =
    possibleName && possibleName.length <= 60 && !/@|http/i.test(possibleName)
      ? possibleName
      : undefined;

  return {
    text: cleaned,
    extracted: {
      name: sanitizeField(name),
      email: sanitizeField(extractEmail(cleaned)),
      phone: sanitizeField(extractPhone(cleaned)),
      linkedinUrl: sanitizeField(extractLinkedIn(cleaned)),
      portfolioUrl: sanitizeField(extractUrl(cleaned)),
      currentCity: sanitizeField(extractCity(cleaned)),
    },
  };
}
