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

function extractPhone(text: string) {
  const m = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3}[-.\s]?\d{3,4}/);
  return m?.[0]?.trim();
}

function extractLinkedIn(text: string) {
  const m = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  return m?.[0];
}

function extractUrl(text: string) {
  const links = text.match(/https?:\/\/[^\s)]+/gi) || [];
  const nonLinkedIn = links.find((link) => !/linkedin\.com/i.test(link));
  return nonLinkedIn;
}

function extractCity(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  const cityLine = lines.find((line) => /,/.test(line) && /[A-Za-z]/.test(line));
  return cityLine;
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
