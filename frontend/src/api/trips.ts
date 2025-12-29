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

export function fetchMyTrips() {
  return apiFetch<TripsResponse>("/me/trips");
}
