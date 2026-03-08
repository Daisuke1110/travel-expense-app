const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const useDebugUser = (import.meta.env.VITE_USE_DEBUG_USER ?? "false") == "true";
const debugUserId = import.meta.env.VITE_DEBUG_USER_ID ?? "";

//一旦はlocalStorageから取得（後でCognito実装時に置換）
function getIdToken(): string {
  return localStorage.getItem('id_token') ?? "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
 
  if(init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const idToken = getIdToken();
  if(idToken) {
    headers.set("Authorization", `Bearer ${idToken}`)
  } else if(useDebugUser && debugUserId) {
     headers.set("X-Debug-User-Id", debugUserId)
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
