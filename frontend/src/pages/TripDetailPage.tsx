import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExpenseItemCard from "../components/ExpenseItem";
import SummaryBox from "../components/SummaryBox";
import { deleteTrip, updateTrip } from "../api/trips";
import { useExpenses } from "../hooks/useExpenses";
import { useTrip } from "../hooks/useTrip";

const debugUserId = import.meta.env.VITE_DEBUG_USER_ID ?? "";

export default function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const tripState = useTrip(tripId);
  const expenseState = useExpenses(tripId);
  const [rateInput, setRateInput] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);

  const totals = useMemo(() => {
    const totalAmount = expenseState.data.reduce((sum, item) => sum + item.amount, 0);
    const rate = tripState.data?.rate_to_jpy ?? 0;
    const totalYen = Math.round(totalAmount * rate);
    return { totalAmount, totalYen };
  }, [expenseState.data, tripState.data]);

  const canDelete = tripState.data?.owner_id && tripState.data.owner_id === debugUserId;
  const canEditRate = canDelete;

  const handleDelete = async () => {
    if (!tripState.data) return;
    const ok = window.confirm("Delete this trip? This cannot be undone.");
    if (!ok) return;
    await deleteTrip(tripState.data.trip_id);
    navigate("/");
  };

  const handleRateSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || Number.isInteger(parsed)) {
      setRateError("Rate must be a decimal number.");
      return;
    }

    setRateError(null);
    setSavingRate(true);
    try {
      const updated = await updateTrip(tripState.data.trip_id, {
        rate_to_jpy: parsed,
      });
      tripState.data.rate_to_jpy = updated.rate_to_jpy;
      setRateInput("");
    } catch (err) {
      setRateError((err as Error).message ?? "Failed to update rate");
    } finally {
      setSavingRate(false);
    }
  };

  if (tripState.loading) {
    return <div className="page"><div className="status">Loading trip...</div></div>;
  }

  if (tripState.error || !tripState.data) {
    return (
      <div className="page">
        <div className="status status--error">{tripState.error ?? "Trip not found"}</div>
        <Link className="back-link" to="/">Back to trips</Link>
      </div>
    );
  }

  const trip = tripState.data;

  return (
    <div className="page">
      <header className="detail-header">
        <Link className="back-link" to="/">← Trips</Link>
        <h1 className="detail-title">{trip.title}</h1>
        <div className="detail-meta">
          <span className="chip">{trip.country}</span>
          <span className="chip">{trip.start_date} - {trip.end_date}</span>
          <span className="chip">Owner: {trip.owner_name ?? "owner"}</span>
        </div>
      </header>

      <SummaryBox
        baseCurrency={trip.base_currency}
        totalAmount={totals.totalAmount}
        totalYen={totals.totalYen}
        rateToJpy={trip.rate_to_jpy}
      />

      {canEditRate && (
        <section className="settings">
          <div className="section-title">Rate settings</div>
          <form className="settings__form" onSubmit={handleRateSave}>
            <label className="field">
              <span>Base currency</span>
              <input type="text" value={trip.base_currency} disabled />
            </label>
            <label className="field">
              <span>Rate to JPY</span>
              <input
                type="number"
                step="0.01"
                placeholder={String(trip.rate_to_jpy)}
                value={rateInput}
                onChange={(event) => setRateInput(event.target.value)}
              />
            </label>
            {rateError && <div className="status status--error">{rateError}</div>}
            <button className="primary" type="submit" disabled={savingRate}>
              {savingRate ? "Saving..." : "Update Rate"}
            </button>
          </form>
        </section>
      )}

      {canDelete && (
        <button className="danger" onClick={handleDelete}>Delete Trip</button>
      )}

      <section className="expenses-section">
        <div className="section-title">Expenses</div>
        {expenseState.loading && <div className="status">Loading expenses...</div>}
        {expenseState.error && (
          <div className="status status--error">{expenseState.error}</div>
        )}
        {!expenseState.loading && expenseState.data.length === 0 && (
          <div className="empty">No expenses yet.</div>
        )}
        <div className="expense-list">
          {expenseState.data.map((item) => (
            <ExpenseItemCard
              key={item.expense_id}
              item={item}
              rateToJpy={trip.rate_to_jpy}
              onDelete={expenseState.remove}
            />
          ))}
        </div>
      </section>

      <Link className="fab" to={`/trips/${trip.trip_id}/add`}>+ Add Expense</Link>
    </div>
  );
}
