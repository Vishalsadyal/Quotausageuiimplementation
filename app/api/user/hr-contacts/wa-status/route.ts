import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "src/lib/guards";
import { ok, handleApiError } from "src/lib/api";
import { enforceRateLimit } from "src/lib/rate-limit";
import { setWhatsAppStatus } from "src/lib/hr-contacts";

/**
 * POST /api/user/hr-contacts/wa-status  { phone, status: "valid" | "invalid" }
 * Sent by the extension after a real WhatsApp send: "valid" when the message went out, "invalid"
 * when WhatsApp says the number is not on WhatsApp. Numbers are never messaged just to test them.
 */
const schema = z.object({
  phone: z.string().min(6).max(40),
  status: z.enum(["valid", "invalid"]),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) return authResult.error;
    const limited = await enforceRateLimit({ key: `hr-wa-status:${authResult.auth.user.id}`, limit: 300, windowMs: 60 * 60 * 1000 });
    if (limited) return limited;
    const { phone, status } = schema.parse(await req.json().catch(() => ({})));
    const updated = await setWhatsAppStatus(phone, status);
    return ok("WhatsApp status saved", { updated });
  } catch (error) {
    return handleApiError(error, "Failed to save WhatsApp status");
  }
}
