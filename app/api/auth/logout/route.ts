import {
  clearAuthCookies,
  clearImpersonatorCookie,
  readImpersonatorCookie,
  readRefreshTokenFromCookies,
  revokeByRefreshToken,
} from "src/lib/auth";
import { ok } from "src/lib/api";

export async function POST() {
  const refreshToken = await readRefreshTokenFromCookies();
  if (refreshToken) {
    await revokeByRefreshToken(refreshToken);
  }
  // Logging out mid-impersonation also ends the parked admin session.
  const impersonatorToken = await readImpersonatorCookie();
  if (impersonatorToken) {
    await revokeByRefreshToken(impersonatorToken);
    await clearImpersonatorCookie();
  }
  await clearAuthCookies();
  return ok("Logged out");
}
