import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, handleApiError } from "src/lib/api";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";
import { writeAuditLog } from "src/lib/audit";
import { removeContact } from "src/lib/hr-contacts";

/**
 * POST /api/public/hr-contacts/remove  { phone?, email? }
 *
 * Public opt-out for recruiters: removes their number / email from HR Contacts and stops it from
 * being added again. No sign-in needed (removal only ever takes data away). Rate limited per IP.
 */
const schema = z
  .object({
    phone: z.string().max(40).optional(),
    email: z.string().max(200).optional(),
  })
  .refine((v) => Boolean(v.phone?.trim() || v.email?.trim()), { message: "Enter a phone number or an email" });

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit({ key: rateLimitKey(req, "hr-contacts.remove"), limit: 20, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;

    const body = schema.parse(await req.json().catch(() => ({})));
    let removed = 0;
    if (body.phone?.trim() && (await removeContact("phone", body.phone))) removed++;
    if (body.email?.trim() && (await removeContact("email", body.email))) removed++;
    if (!removed) return fail("Enter a valid phone number (with country code) or email address", 400, "INVALID_CONTACT");

    await writeAuditLog({ action: "hr_contacts.removal_requested", targetType: "hr_contact", metadataJson: { count: removed } }).catch(() => null);
    return ok("Removed. Your contact details won't be shared through AutoApply CV.", { removed });
  } catch (error) {
    return handleApiError(error, "Failed to process removal");
  }
}
