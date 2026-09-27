import { cookies } from "next/headers";
import { authEnabled, readSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

// 200 = allowed (nginx auth_request lets the request through), 401 = sign in first.
export async function GET() {
  if (!authEnabled()) return Response.json({ enabled: false });
  const session = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ enabled: true, signedIn: false }, { status: 401 });
  return Response.json({ enabled: true, signedIn: true, user: session.user });
}
