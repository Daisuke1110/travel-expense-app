import TripCard from "../components/TripCard";
import { useTrips } from "../hooks/useTrips";

export default function HomePage() {
  const { data, loading, error } = useTrips();

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__pill">Travel Expense</div>
        <h1 className="hero__title">Your Trips</h1>
        <p className="hero__sub">
          Track spending, split costs, and keep receipts tidy.
        </p>
      </header>

      {loading && <div className="status">Loading trips...</div>}
      {error && <div className="status status--error">{error}</div>}

      {data && (
        <div className="trip-sections">
          <section>
            <h2 className="section-title">Owned Trips</h2>
            <div className="card-grid">
              {data.own_trips.length === 0 && (
                <div className="empty">No owned trips yet.</div>
              )}
              {data.own_trips.map((trip) => (
                <TripCard key={trip.trip_id} trip={trip} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="section-title">Shared Trips</h2>
            <div className="card-grid">
              {data.shared_trips.length === 0 && (
                <div className="empty">No shared trips yet.</div>
              )}
              {data.shared_trips.map((trip) => (
                <TripCard key={trip.trip_id} trip={trip} showOwner />
              ))}
            </div>
          </section>
        </div>
      )}

      <button className="fab">+ New Trip</button>
    </div>
  );
}
