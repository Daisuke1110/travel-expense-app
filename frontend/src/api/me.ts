import { apiFetch } from "./client";

export type MeResponse = {
  user_id: string;
  email?: string | null;
  name?: string | null;
};

export type MeUpdateRequest = {
  name: string;
};

export function fetchMe() {
  return apiFetch<MeResponse>("/me");
}

export function updateMe(payload: MeUpdateRequest) {
  return apiFetch<MeResponse>("/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
