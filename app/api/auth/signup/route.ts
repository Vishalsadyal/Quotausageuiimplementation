import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { signupSchema } from "src/lib/schemas";
import { createSessionAndTokens, setAuthCookies, toClientUser } from "src/lib/auth";
import { createUserAccount } from "src/lib/account";
import { writeAuditLog } from "src/lib/audit";
import { fail, handleApiError } from "src/lib/api";
import { attributeReferralFromCookie } from "src/lib/referrals";

export async function POST(req: NextRequest) {
  try {
    const body = signupSchema.parse(await req.json());
    const { name, email, password, phone } = body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("An account with this email already exists", 409, "EMAIL_TAKEN");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUserAccount({ name, email, phone, passwordHash });
    await attributeReferralFromCookie(user.id);

    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    await setAuthCookies(accessToken, refreshToken);

    await writeAuditLog({
      actorUserId: user.id,
      action: "auth.signup",
      targetType: "user",
      targetId: user.id,
    });

    const refreshedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const clientUser = toClientUser(refreshedUser || user);
    return NextResponse.json(
      {
        success: true,
        message: "Account created",
        data: { user: clientUser },
        user: clientUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("signup error:", error);
    return handleApiError(error, "Failed to create account");
  }
}
