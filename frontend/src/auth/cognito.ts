import { appConfig } from "../config";

const COGNITO_DOMAIN = appConfig.cognitoDomain;
const CLIENT_ID = appConfig.cognitoClientId;
const REDIRECT_URI = appConfig.cognitoRedirectUri;
const LOGOUT_URI = appConfig.cognitoLogoutUri || REDIRECT_URI;

const ID_TOKEN_KEY = "id_token";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const LOGIN_IN_PROGRESS_KEY = "auth_login_in_progress";
const PKCE_STATE_MAP_KEY = "oauth_pkce_state_map";

function assertConfig() {
  if (!COGNITO_DOMAIN || !CLIENT_ID || !REDIRECT_URI) {
    throw new Error("Missing Cognito env vars");
  }
}

function base64UrlEncode(input: Uint8Array): string {
  let s = "";
  for (const b of input) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 64): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

async function createPkcePair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = randomString(64);
  const digest = await sha256(verifier);
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

export function getIdToken(): string {
  return localStorage.getItem(ID_TOKEN_KEY) ?? "";
}

function loadPkceStateMap(): Record<string, string> {
  const raw = sessionStorage.getItem(PKCE_STATE_MAP_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function savePkceStateMap(map: Record<string, string>): void {
  if (Object.keys(map).length === 0) {
    sessionStorage.removeItem(PKCE_STATE_MAP_KEY);
    return;
  }

  sessionStorage.setItem(PKCE_STATE_MAP_KEY, JSON.stringify(map));
}

function setVerifierForState(state: string, verifier: string): void {
  const map = loadPkceStateMap();
  map[state] = verifier;
  savePkceStateMap(map);
}

function popVerifierForState(state: string): string | null {
  const map = loadPkceStateMap();
  const verifier = map[state] ?? null;
  delete map[state];
  savePkceStateMap(map);
  return verifier;
}

function clearAuthFlowState(): void {
  sessionStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
  sessionStorage.removeItem(PKCE_STATE_MAP_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ID_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearAuthFlowState();
}

export async function login(): Promise<void> {
  assertConfig();

  if (sessionStorage.getItem(LOGIN_IN_PROGRESS_KEY) === "true") {
    return;
  }

  const { verifier, challenge } = await createPkcePair();
  const state = randomString(32);
  setVerifierForState(state, verifier);
  sessionStorage.setItem(LOGIN_IN_PROGRESS_KEY, "true");

  const url = new URL(`https://${COGNITO_DOMAIN}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("state", state);

  window.location.assign(url.toString());
}

export async function handleCallbackIfNeeded(): Promise<boolean> {
  assertConfig();

  const current = new URL(window.location.href);
  const code = current.searchParams.get("code");
  const state = current.searchParams.get("state");

  if (!code) return false;

  const verifier = state ? popVerifierForState(state) : null;

  current.searchParams.delete("code");
  current.searchParams.delete("state");
  current.searchParams.delete("session_state");
  window.history.replaceState(
    {},
    "",
    current.pathname + current.search + current.hash,
  );

  if (!state || !verifier) {
    sessionStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
    throw new Error("Invalid OAuth state");
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", CLIENT_ID);
  body.set("code", code);
  body.set("redirect_uri", REDIRECT_URI);
  body.set("code_verifier", verifier);

  const res = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    sessionStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
    const text = await res.text();
    throw new Error(text || "Token exchange failed");
  }

  const data = (await res.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  };

  if (!data.id_token) {
    sessionStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
    throw new Error("id_token not found");
  }

  localStorage.setItem(ID_TOKEN_KEY, data.id_token);
  if (data.access_token)
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  if (data.refresh_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);

  sessionStorage.removeItem(LOGIN_IN_PROGRESS_KEY);
  return true;
}

export function logout(): void {
  assertConfig();
  clearTokens();

  const url = new URL(`https://${COGNITO_DOMAIN}/logout`);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("logout_uri", LOGOUT_URI);

  window.location.assign(url.toString());
}
