import { Link } from "react-router-dom";
import type { TripSummary } from "../api/trips";

type Props = {
  trip: TripSummary;
  showOwner?: boolean;
};

export default function TripCard({ trip, showOwner = false }: Props) {
  return (
    <Link to={`/trips/${trip.trip_id}`} className="trip-card">
      <div className="trip-card__header">
        <div className="trip-card__title">{trip.title}</div>
        <div className="trip-card__country">{trip.country}</div>
      </div>
      <div className="trip-card__dates">
        {trip.start_date} – {trip.end_date}
      </div>
      {showOwner && (
        <div className="trip-card__owner">owner: {trip.owner_name ?? "owner"}</div>
      )}
    </Link>
  );
}


