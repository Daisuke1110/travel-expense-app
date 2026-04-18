import { Link } from "react-router-dom";
import TripCard from "../components/TripCard";
import { logout } from "../auth/cognito";
import { useTrips } from "../hooks/useTrips";

export default function HomePage() {
  const { data, loading, error } = useTrips();

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__top">
          <div className="hero__pill">旅行費用アプリ</div>
          <button
            className="hero__logout"
            type="button"
            onClick={() => logout()}
          >
            ログアウト
          </button>
        </div>
        <h1 className="hero__title">旅行一覧</h1>
        <p className="hero__sub">
          支出を記録して、旅の費用を見やすく管理します。
        </p>
      </header>

      {loading && <div className="status">旅行を読み込み中...</div>}
      {error && <div className="status status--error">{error}</div>}

      {data && (
        <div className="trip-sections">
          <section>
            <h2 className="section-title">自分の旅行</h2>
            <div className="card-grid">
              {data.own_trips.length === 0 && (
                <div className="empty">まだ旅行がありません。</div>
              )}
              {data.own_trips.map((trip) => (
                <TripCard key={trip.trip_id} trip={trip} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="section-title">共有された旅行</h2>
            <div className="card-grid">
              {data.shared_trips.length === 0 && (
                <div className="empty">共有された旅行はまだありません。</div>
              )}
              {data.shared_trips.map((trip) => (
                <TripCard key={trip.trip_id} trip={trip} showOwner />
              ))}
            </div>
          </section>
        </div>
      )}

      <Link className="fab" to="/trips/new">
        + 旅行を追加
      </Link>
    </div>
  );
}
