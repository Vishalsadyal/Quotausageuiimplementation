import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "src/lib/prisma";
import { attributeReferralFromCookie } from "src/lib/referrals";
import { createSessionAndTokens, setAuthCookies } from "src/lib/auth";
import { getPlanQuota } from "src/lib/quota";
import { creditBonusHires, ensureHireWindow, getDailyHireCap } from "src/lib/hires";
import { writeAuditLog } from "src/lib/audit";

function getGoogleRedirectUri(req: NextRequest): string {
  const host = req.headers.get("host") || "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return `http://${host}/api/auth/callback/google`;
  }
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "https://www.autoapplycv.in/api/auth/callback/google"
  );
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = `${url.protocol}//${url.host}`;

  if (error) {
    console.warn("Google OAuth returned error:", error);
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_cancelled`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);
  }

  const storedState = req.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    console.error("Google OAuth state mismatch:", { storedState, state });
    return NextResponse.redirect(`${baseUrl}/login?error=state_mismatch`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment");
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_config_missing`);
  }

  try {
    const redirectUri = getGoogleRedirectUri(req);

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange failed:", errText);
      return NextResponse.redirect(`${baseUrl}/login?error=token_exchange_failed`);
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;

    // 2. Fetch user profile from Google UserInfo endpoint
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoRes.ok) {
      console.error("Failed to fetch Google userinfo:", await userInfoRes.text());
      return NextResponse.redirect(`${baseUrl}/login?error=userinfo_failed`);
    }

    const userInfo = (await userInfoRes.json()) as GoogleUserInfo;

    if (!userInfo.email) {
      return NextResponse.redirect(`${baseUrl}/login?error=email_not_provided`);
    }

    const normalizedEmail = userInfo.email.trim().toLowerCase();
    const fullName = userInfo.name || normalizedEmail.split("@")[0];
    const avatarUrl = userInfo.picture || null;

    // 3. UNIFIED ACCOUNT LOOKUP: Check if user with this email already exists
    let existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const isNewUser = !existingUser;

    if (!existingUser) {
      // 4. Create new user account linked to this email
      const randomPassword = randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const now = new Date();
      const nextReset = new Date(now);
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
      nextReset.setUTCHours(0, 0, 0, 0);

      existingUser = await prisma.user.create({
        data: {
          name: fullName,
          email: normalizedEmail,
          avatar: avatarUrl,
          passwordHash,
          role: "user",
          plan: "free",
          onboardingCompleted: false,
          quotaUsed: 0,
          quotaTotal: getPlanQuota("free"),
          quotaResetTime: nextReset,
          dailyHireUsed: 0,
          dailyHireCap: getDailyHireCap("free"),
          dailyHireResetTime: nextReset,
        },
      });

      await attributeReferralFromCookie(existingUser.id);

      // Credit 30 bonus coins on signup
      const signupBonus = Math.max(0, Math.floor(Number(process.env.SIGNUP_BONUS_HIRES || 30)));
      if (signupBonus > 0) {
        await creditBonusHires({
          userId: existingUser.id,
          hires: signupBonus,
          referenceType: "signup",
          referenceId: existingUser.id,
          idempotencyKey: `signup_bonus:${existingUser.id}`,
          metadataJson: { email: normalizedEmail, provider: "google" },
        });
      }
    } else {
      // Existing user: If avatar or name is missing, update them
      const updateData: { avatar?: string; name?: string } = {};
      if (!existingUser.avatar && avatarUrl) {
        updateData.avatar = avatarUrl;
      }
      if (!existingUser.name && fullName) {
        updateData.name = fullName;
      }

      if (Object.keys(updateData).length > 0) {
        existingUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      }
    }

    // 5. Ensure hire quotas/window are up to date
    const quotaAwareUser = await ensureHireWindow(existingUser.id);

    // 6. Create session and authentication tokens
    const { accessToken, refreshToken } = await createSessionAndTokens({
      id: quotaAwareUser.id,
      email: quotaAwareUser.email,
      role: quotaAwareUser.role,
    });

    await setAuthCookies(accessToken, refreshToken);

    // 7. Write audit log
    await writeAuditLog({
      actorUserId: quotaAwareUser.id,
      action: isNewUser ? "auth.google_signup" : "auth.google_login",
      targetType: "user",
      targetId: quotaAwareUser.id,
      metadataJson: {
        email: normalizedEmail,
        isNewUser,
        googleSub: userInfo.sub,
      },
    });

    // 8. Redirect to dashboard and clear oauth_state cookie
    const response = NextResponse.redirect(`${baseUrl}/dashboard`);
    response.cookies.delete("google_oauth_state");

    // Also set the cookies directly on the response to ensure immediate browser hydration
    const isProd = process.env.NODE_ENV === "production";
    response.cookies.set("cp_access_token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60),
    });
    response.cookies.set("cp_refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 30 * 24 * 60 * 60),
    });

    return response;
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return NextResponse.redirect(`${baseUrl}/login?error=oauth_failed`);
  }
}
