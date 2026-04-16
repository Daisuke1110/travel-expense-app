import { apiFetch } from "./client";

export type TripSummary = {
  trip_id: string;
  title: string;
  country: string;
  start_date: string;
  end_date: string;
  owner_name?: string | null;
};

export type TripsResponse = {
  own_trips: TripSummary[];
  shared_trips: TripSummary[];
};

export type TripDetail = {
  trip_id: string;
  title: string;
  country: string;
  start_date: string;
  end_date: string;
  base_currency: string;
  rate_to_jpy: number;
  owner_id?: string | null;
  owner_name?: string | null;
};

export type TripCreateRequest = {
  title: string;
  country: string;
  start_date: string;
  end_date: string;
  base_currency: string;
  rate_to_jpy: number;
};

export type TripUpdateRequest = {
  title?: string;
  country?: string;
  start_date?: string;
  end_date?: string;
  rate_to_jpy?: number;
  base_currency?: string;
};

export type TripMemberRequest = {
  user_id?: string;
  email?: string;
};

export type TripMemberResponse = {
  user_id: string;
  name?: string | null;
  trip_id: string;
  role: string;
  joined_at: string;
};

export type TripMembersResponse = {
  members: TripMemberResponse[];
};

export function fetchMyTrips() {
  return apiFetch<TripsResponse>("/me/trips");
}

export function fetchTripDetail(tripId: string) {
  return apiFetch<TripDetail>(`/trips/${tripId}`);
}

export function createTrip(payload: TripCreateRequest) {
  return apiFetch<TripDetail>("/trips", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateTrip(tripId: string, payload: TripUpdateRequest) {
  return apiFetch<TripDetail>(`/trips/${tripId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteTrip(tripId: string) {
  return apiFetch<void>(`/trips/${tripId}`, { method: "DELETE" });
}

export function addTripMember(tripId: string, payload: TripMemberRequest) {
  return apiFetch<TripMemberResponse>(`/trips/${tripId}/members`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchTripMembers(tripId: string) {
  return apiFetch<TripMembersResponse>(`/trips/${tripId}/members`);
}

export function deleteTripMember(tripId: string, memberUserId: string) {
  return apiFetch<void>(`/trips/${tripId}/members/${memberUserId}`, {
    method: "DELETE",
  });
}
