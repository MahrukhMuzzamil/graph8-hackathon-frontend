// Base URL of the backend (graph8-hackathon-backend). Set NEXT_PUBLIC_API_URL in .env.local.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_URL + path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  return json as T;
}
