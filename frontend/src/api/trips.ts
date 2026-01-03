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

export function deleteTrip(tripId: string) {
  return apiFetch<void>(`/trips/${tripId}`, { method: "DELETE" });
}
