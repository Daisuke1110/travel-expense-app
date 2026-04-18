import { clearTokens, ensureValidSession, getIdToken, login } from "../auth/cognito";
import { appConfig } from "../config";

const baseUrl = appConfig.apiBaseUrl;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  await ensureValidSession();

  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const idToken = getIdToken();
  if (idToken) {
    headers.set("Authorization", `Bearer ${idToken}`);
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearTokens();
    await login();
    throw new Error("Unauthorized");
  }

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
