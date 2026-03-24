export function getCurrentUserId(): string {
  const token = localStorage.getItem("id_token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub ?? "";
    } catch {
      return "";
    }
  }

  return import.meta.env.VITE_DEBUG_USER_ID ?? "";
}
