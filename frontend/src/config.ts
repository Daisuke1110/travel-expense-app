type AppConfig = {
  apiBaseUrl?: string;
  cognitoDomain?: string;
  cognitoClientId?: string;
  cognitoRedirectUri?: string;
  cognitoLogoutUri?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

const runtimeConfig = window.__APP_CONFIG__ ?? {};

function readConfig(
  runtimeValue: string | undefined,
  envValue: string | undefined,
): string {
  return runtimeValue?.trim() || envValue?.trim() || "";
}

export const appConfig = {
  apiBaseUrl: readConfig(
    runtimeConfig.apiBaseUrl,
    import.meta.env.VITE_API_BASE_URL,
  ),
  cognitoDomain: readConfig(
    runtimeConfig.cognitoDomain,
    import.meta.env.VITE_COGNITO_DOMAIN,
  ),
  cognitoClientId: readConfig(
    runtimeConfig.cognitoClientId,
    import.meta.env.VITE_COGNITO_CLIENT_ID,
  ),
  cognitoRedirectUri: readConfig(
    runtimeConfig.cognitoRedirectUri,
    import.meta.env.VITE_COGNITO_REDIRECT_URI,
  ),
  cognitoLogoutUri: readConfig(
    runtimeConfig.cognitoLogoutUri,
    import.meta.env.VITE_COGNITO_LOGOUT_URI,
  ),
};
