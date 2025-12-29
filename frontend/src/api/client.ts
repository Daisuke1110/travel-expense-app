const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const debugUserId = import.meta.env.VITE_DEBUG_USER_ID ?? "";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (debugUserId) headers.set("X-Debug-User-Id", debugUserId);

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
