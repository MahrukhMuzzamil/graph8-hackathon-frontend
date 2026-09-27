import { createHmac, timingSafeEqual } from "node:crypto";

// Sign-in for deployed demos. Credentials come from the server environment (never the browser):
//   ARD_LOGIN_USER, ARD_LOGIN_PASSWORD, ARD_SESSION_SECRET
// Without ARD_LOGIN_PASSWORD (local dev) sign-in is off and every request is allowed.
// nginx asks GET /auth/session before every page and API request (auth_request), so the
// backend is protected too, not just the dashboard.
export const SESSION_COOKIE = "ard_session";
const MAX_AGE_S = 12 * 60 * 60;

export const authEnabled = () => Boolean(process.env.ARD_LOGIN_PASSWORD);

const secret = () => process.env.ARD_SESSION_SECRET || `ard:${process.env.ARD_LOGIN_PASSWORD ?? ""}`;
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkCredentials(user: string, password: string): boolean {
  const u = process.env.ARD_LOGIN_USER ?? "";
  const p = process.env.ARD_LOGIN_PASSWORD ?? "";
  // Compare both even if the first fails, so timing doesn't reveal which one was wrong.
  const okUser = safeEqual(user.trim(), u);
  const okPass = safeEqual(password, p);
  return authEnabled() && okUser && okPass;
}

/** "user.expiresAt.signature" */
export function createSession(user: string): { value: string; maxAge: number } {
  const payload = `${Buffer.from(user).toString("base64url")}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_S };
}

export function readSession(value?: string): { user: string } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [u, exp, sig] = parts;
  if (!safeEqual(sig, sign(`${u}.${exp}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return { user: Buffer.from(u, "base64url").toString() };
}
