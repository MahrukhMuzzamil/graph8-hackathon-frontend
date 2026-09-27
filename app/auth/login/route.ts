import { cookies } from "next/headers";
import { authEnabled, checkCredentials, createSession, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  if (!authEnabled()) return Response.json({ ok: true, enabled: false });
  const body = (await request.json().catch(() => ({}))) as { user?: string; password?: string };
  if (!checkCredentials(body.user ?? "", body.password ?? "")) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.json({ ok: false, error: "Wrong username or password." }, { status: 401 });
  }
  const { value, maxAge } = createSession(body.user!.trim());
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge,
    secure: request.headers.get("x-forwarded-proto") === "https",
  });
  return Response.json({ ok: true });
}
