import { NextRequest, NextResponse } from "next/server";
import { createAndSendOtp, OtpPurpose } from "src/lib/otp";
import { otpSendSchema } from "src/lib/schemas";
import { fail, handleApiError, ok } from "src/lib/api";
import { prisma } from "src/lib/prisma";
import { enforceRateLimit, rateLimitKey } from "src/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const rl = await enforceRateLimit({
      key: rateLimitKey(req, "auth.send_otp"),
      limit: 6,
      windowMs: 60_000,
    });
    if (rl) return rl;

    const body = otpSendSchema.parse(await req.json());
    const { email, purpose } = body as { email: string; purpose: OtpPurpose };

    // A login code is useless without an account, so say so now instead of after the user enters it.
    if (purpose === "login") {
      const account = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!account) {
        return fail(
          "No account found for this email. Sign up, or upload your resume on the home page to create one.",
          404,
          "USER_NOT_FOUND",
        );
      }
    }

    const result = await createAndSendOtp(email, purpose);
    const showOtp = (process.env.OTP_DEV_SHOW_CODE || "false").toLowerCase() === "true";
    const isDev = process.env.NODE_ENV !== "production";
    const includeOtp = showOtp || (isDev && (!result.delivered || result.bypassed));

    if (!result.delivered && isDev) {
      // Give a clearer message for local development environments.
      return ok(
        "OTP generated (email not delivered). Using dev fallback.",
        includeOtp ? { otp: result.otp, deliveryError: result.deliveryError } : undefined,
      );
    }

    return ok("OTP sent successfully", includeOtp ? { otp: result.otp } : undefined);
  } catch (error) {
    console.error("send-otp error:", error);
    return handleApiError(error, "Failed to send OTP");
  }
}
