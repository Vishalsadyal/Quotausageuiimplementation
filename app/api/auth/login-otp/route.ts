import { NextRequest } from "next/server";
import { prisma } from "src/lib/prisma";
import { fail, handleApiError, ok } from "src/lib/api";
import { verifyOtp, consumeVerifiedOtp } from "src/lib/otp";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { otpVerifySchema } from "src/lib/schemas";
import { ensureHireWindow } from "src/lib/hires";
import { writeAuditLog } from "src/lib/audit";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "auth.login_otp"),
      limit: 10,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = otpVerifySchema.parse(await req.json());
    const { email, otp } = body;

    // Check the account first so a missing account doesn't use up a valid code.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return fail("No account found for this email. Sign up, or upload your resume on the home page to create one.", 404, "USER_NOT_FOUND");
    }

    const result = await verifyOtp(email, otp, "login");
    if (!result.ok) {
      return fail(result.reason || "Invalid OTP", 401, "OTP_INVALID");
    }

    const consumed = await consumeVerifiedOtp(email, "login");
    if (!consumed) {
      return fail("OTP already used or expired", 401, "OTP_CONSUMED");
    }

    const quotaAwareUser = await ensureHireWindow(user.id);
    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: quotaAwareUser.id,
      email: quotaAwareUser.email,
      role: quotaAwareUser.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: quotaAwareUser.id,
      action: "auth.login_otp",
      targetType: "user",
      targetId: quotaAwareUser.id,
    });

    const clientUser = toClientUser(quotaAwareUser);
    return ok("Login successful", { user: clientUser });
  } catch (error) {
    console.error("login-otp error:", error);
    return handleApiError(error, "OTP login failed");
  }
}
