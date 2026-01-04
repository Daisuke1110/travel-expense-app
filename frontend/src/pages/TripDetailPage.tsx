import { type FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExpenseItemCard from "../components/ExpenseItem";
import SummaryBox from "../components/SummaryBox";
import { addTripMember, deleteTrip, updateTrip } from "../api/trips";
import { useExpenses } from "../hooks/useExpenses";
import { useMembers } from "../hooks/useMembers";
import { useTrip } from "../hooks/useTrip";

const debugUserId = import.meta.env.VITE_DEBUG_USER_ID ?? "";

export default function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const tripState = useTrip(tripId);
  const expenseState = useExpenses(tripId);
  const memberState = useMembers(tripId);
  const [rateInput, setRateInput] = useState("");
  const [rateError, setRateError] = useState<string | null>(null);
  const [savingRate, setSavingRate] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [tripError, setTripError] = useState<string | null>(null);
  const [savingTrip, setSavingTrip] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);

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
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setRateError("Rate must be a positive number.");
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

  const handleTripSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const title = titleInput.trim();
    const startDate = startDateInput.trim();
    const endDate = endDateInput.trim();
    if (!title || !startDate || !endDate) {
      setTripError("Title and dates are required.");
      return;
    }

    setTripError(null);
    setSavingTrip(true);
    try {
      const updated = await updateTrip(tripState.data.trip_id, {
        title,
        start_date: startDate,
        end_date: endDate,
      });
      tripState.data.title = updated.title;
      tripState.data.start_date = updated.start_date;
      tripState.data.end_date = updated.end_date;
      setTitleInput("");
      setStartDateInput("");
      setEndDateInput("");
    } catch (err) {
      setTripError((err as Error).message ?? "Failed to update trip");
    } finally {
      setSavingTrip(false);
    }
  };

  const handleMemberSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripState.data) return;

    const userId = memberUserId.trim();
    if (!userId) {
      setMemberError("User ID is required.");
      return;
    }

    setMemberError(null);
    setSavingMember(true);
    try {
      await addTripMember(tripState.data.trip_id, { user_id: userId });
      setMemberUserId("");
      await memberState.refresh();
    } catch (err) {
      setMemberError((err as Error).message ?? "Failed to add member");
    } finally {
      setSavingMember(false);
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
          <div className="settings__header">
            <div className="section-title">Trip settings</div>
            <button
              className="settings__toggle"
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
            >
              {settingsOpen ? "Hide" : "Edit"}
            </button>
          </div>
          {!settingsOpen && (
            <div className="settings__summary">
              <div>{trip.title}</div>
              <div>{trip.start_date} - {trip.end_date}</div>
              <div>Base: {trip.base_currency}</div>
              <div>Rate: {trip.rate_to_jpy}</div>
              <div className="settings__members">
                <div className="settings__label">Members</div>
                {memberState.loading && <div className="status">Loading members...</div>}
                {memberState.error && (
                  <div className="status status--error">{memberState.error}</div>
                )}
                {!memberState.loading && memberState.data.length === 0 && (
                  <div className="empty">No members yet.</div>
                )}
                <div className="members-list">
                  {memberState.data.map((member) => (
                    <div key={member.user_id} className="members-list__item">
                      <span className="members-list__user">{member.user_id}</span>
                      <span className="members-list__role">{member.role}</span>
                      {canDelete && member.role !== "owner" && (
                        <button
                          className="members-list__delete"
                          type="button"
                          onClick={() => memberState.remove(member.user_id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {settingsOpen && (
            <form className="settings__form" onSubmit={handleTripSave}>
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  placeholder={trip.title}
                  value={titleInput}
                  onChange={(event) => setTitleInput(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Start date</span>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(event) => setStartDateInput(event.target.value)}
                />
              </label>
              <label className="field">
                <span>End date</span>
                <input
                  type="date"
                  value={endDateInput}
                  onChange={(event) => setEndDateInput(event.target.value)}
                />
              </label>
              {tripError && <div className="status status--error">{tripError}</div>}
              <button className="primary" type="submit" disabled={savingTrip}>
                {savingTrip ? "Saving..." : "Update Trip"}
              </button>
            </form>
          )}

          {settingsOpen && <div className="settings__divider" />}

          {settingsOpen && (
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
          )}

          {settingsOpen && <div className="settings__divider" />}

          {settingsOpen && (
            <form className="settings__form" onSubmit={handleMemberSave}>
              <label className="field">
                <span>Add member</span>
                <input
                  type="text"
                  placeholder="user-abc"
                  value={memberUserId}
                  onChange={(event) => setMemberUserId(event.target.value)}
                />
              </label>
              {memberError && <div className="status status--error">{memberError}</div>}
              <button className="primary" type="submit" disabled={savingMember}>
                {savingMember ? "Saving..." : "Add member"}
              </button>
            </form>
          )}
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
