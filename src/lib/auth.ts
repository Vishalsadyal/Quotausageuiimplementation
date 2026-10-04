import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";
import { getRequiredEnv } from "./env";

const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 30 * 24 * 60 * 60);
const ACCESS_COOKIE = "cp_access_token";
const REFRESH_COOKIE = "cp_refresh_token";
// Holds the admin's own refresh token while they are impersonating a user.
const IMPERSONATOR_COOKIE = "cp_impersonator_refresh";
const IMPERSONATION_TTL_SECONDS = 8 * 60 * 60;

export type AuthUser = {
  id: string;
  email: string;
  role: "user" | "admin";
};

type AccessTokenPayload = AuthUser & {
  sessionId: string;
  tokenType: "access";
};

function getJwtSecret() {
  return getRequiredEnv("JWT_SECRET", { minLength: 24 });
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

function verifyAccessToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as AccessTokenPayload & { exp: number; iat: number };
}

function createRefreshToken() {
  return randomBytes(48).toString("hex");
}

async function getRequestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent") || undefined,
    ipAddress:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined,
  };
}

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(accessToken: string, refreshToken: string) {
  return (async () => {
    const store = await cookies();
    store.set(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd(),
      path: "/",
      maxAge: ACCESS_TOKEN_TTL_SECONDS,
    });
    store.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd(),
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });
  })();
}

export function clearAuthCookies() {
  return (async () => {
    const store = await cookies();
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
  })();
}

export async function createSessionAndTokens(user: AuthUser) {
  const refreshToken = createRefreshToken();
  const family = randomBytes(16).toString("hex");
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const meta = await getRequestMeta();

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      family,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      status: "active",
    },
  });

  const accessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
    sessionId: session.id,
    tokenType: "access",
  });

  return { accessToken, refreshToken, sessionId: session.id };
}

export async function rotateRefreshToken(rawRefreshToken: string) {
  const hashed = hashToken(rawRefreshToken);
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hashed, status: "active" },
    include: { user: true },
  });

  if (!session) {
    throw new Error("Invalid refresh session");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.update({ where: { id: session.id }, data: { status: "expired" } });
    throw new Error("Refresh session expired");
  }

  const newRefreshToken = createRefreshToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  const meta = await getRequestMeta();

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
      lastUsedAt: new Date(),
      userAgent: meta.userAgent || session.userAgent,
      ipAddress: meta.ipAddress || session.ipAddress,
    },
    include: { user: true },
  });

  const accessToken = signAccessToken({
    id: updated.user.id,
    email: updated.user.email,
    role: updated.user.role,
    sessionId: updated.id,
    tokenType: "access",
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: updated.user,
    sessionId: updated.id,
  };
}

export async function revokeByRefreshToken(rawRefreshToken: string) {
  const hashed = hashToken(rawRefreshToken);
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hashed, status: "active" },
  });
  if (!session) return;
  await prisma.session.update({
    where: { id: session.id },
    data: { status: "revoked" },
  });
}

export async function getAuthUserFromRequest() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      return {
        sessionId: payload.sessionId,
        user: {
          id: payload.id,
          email: payload.email,
          role: payload.role,
        } as AuthUser,
      };
    } catch {
      // Access token expired or invalid — try refresh below.
    }
  }

  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  try {
    const rotated = await rotateRefreshToken(refreshToken);
    await setAuthCookies(rotated.accessToken, rotated.refreshToken);
    return {
      sessionId: rotated.sessionId,
      user: {
        id: rotated.user.id,
        email: rotated.user.email,
        role: rotated.user.role,
      } as AuthUser,
    };
  } catch {
    return null;
  }
}

export function readRefreshTokenFromCookies() {
  return (async () => {
    const store = await cookies();
    return store.get(REFRESH_COOKIE)?.value || null;
  })();
}

export function toClientUser(user: {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  avatar: string | null;
  phone?: string | null;
  currentCity?: string | null;
  addressLine?: string | null;
  linkedinUrl?: string | null;
  portfolioUrl?: string | null;
  resumeFileName?: string | null;
  onboardingCompleted?: boolean;
  plan: "free" | "pro" | "coach";
  createdAt: Date;
  quotaUsed: number;
  quotaTotal: number;
  quotaResetTime: Date;
  hireBalance: number;
  hireSpent: number;
  hirePurchased: number;
  dailyHireUsed: number;
  dailyHireCap: number;
  dailyHireResetTime: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar ?? undefined,
    phone: user.phone ?? undefined,
    currentCity: user.currentCity ?? undefined,
    addressLine: user.addressLine ?? undefined,
    linkedinUrl: user.linkedinUrl ?? undefined,
    portfolioUrl: user.portfolioUrl ?? undefined,
    resumeFileName: user.resumeFileName ?? undefined,
    onboardingCompleted: Boolean(user.onboardingCompleted),
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
    quotaUsed: user.quotaUsed,
    quotaTotal: user.quotaTotal,
    quotaResetTime: user.quotaResetTime.toISOString(),
    hireBalance: user.hireBalance,
    hireSpent: user.hireSpent,
    hirePurchased: user.hirePurchased,
    dailyHireUsed: user.dailyHireUsed,
    dailyHireCap: user.dailyHireCap,
    dailyHireResetTime: user.dailyHireResetTime.toISOString(),
  };
}

export function setImpersonatorCookie(adminRefreshToken: string) {
  return (async () => {
    const store = await cookies();
    store.set(IMPERSONATOR_COOKIE, adminRefreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd(),
      path: "/",
      maxAge: IMPERSONATION_TTL_SECONDS,
    });
  })();
}

export function readImpersonatorCookie() {
  return (async () => {
    const store = await cookies();
    return store.get(IMPERSONATOR_COOKIE)?.value || null;
  })();
}

export function clearImpersonatorCookie() {
  return (async () => {
    const store = await cookies();
    store.delete(IMPERSONATOR_COOKIE);
  })();
}

export async function revokeSessionById(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, status: "active" },
    data: { status: "revoked" },
  });
}

// Returns the admin behind the current impersonation, if any.
export async function getImpersonator() {
  const token = await readImpersonatorCookie();
  if (!token) return null;
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: hashToken(token), status: "active", expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session || session.user.role !== "admin") return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}
