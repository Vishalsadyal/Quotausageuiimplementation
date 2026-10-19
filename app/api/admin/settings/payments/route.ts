import { z } from "zod";
import { requireAdmin } from "src/lib/guards";
import { fail, handleApiError, ok } from "src/lib/api";
import { writeAuditLog } from "src/lib/audit";
import { PAYMENT_MODE_ACTION, clearPaymentModeCache, getPaymentMode, paymentModeStatus } from "src/lib/payment-mode";

const bodySchema = z.object({ mode: z.enum(["live", "test"]) });

async function snapshot() {
  const mode = await getPaymentMode();
  return { mode, live: paymentModeStatus("live"), test: paymentModeStatus("test") };
}

/** GET /api/admin/settings/payments: current Razorpay mode and which keys are filled in (never the values). */
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    return ok("Payment settings", await snapshot());
  } catch (error) {
    return handleApiError(error, "Failed to load payment settings");
  }
}

/** PUT /api/admin/settings/payments: switch between live and test (refused if that mode's keys are incomplete). */
export async function PUT(req: Request) {
  try {
    const authResult = await requireAdmin();
    if ("error" in authResult) return authResult.error;
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return fail("Mode must be live or test", 400, "VALIDATION_ERROR");
    const { mode } = parsed.data;
    const status = paymentModeStatus(mode);
    if (!status.keyId || !status.keySecret) {
      return fail(`The ${mode} Razorpay key id and secret are not set on the server`, 400, "KEYS_MISSING");
    }
    if (!status.keyPrefixOk) {
      return fail(`The ${mode} key id does not start with rzp_${mode}_. Check the environment variable.`, 400, "KEY_MODE_MISMATCH");
    }
    const previous = await getPaymentMode();
    await writeAuditLog({
      actorUserId: authResult.auth.user.id,
      action: PAYMENT_MODE_ACTION,
      targetType: "site_config",
      targetId: "payments",
      metadataJson: { mode, previous },
    });
    clearPaymentModeCache();
    return ok(`Payments are now in ${mode} mode`, await snapshot());
  } catch (error) {
    return handleApiError(error, "Failed to save payment settings");
  }
}
