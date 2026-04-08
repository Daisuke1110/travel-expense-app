import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createExpense } from "../api/expenses";
import { getCurrentUserId } from "../auth/currentUser";
import { useMembers } from "../hooks/useMembers";
import { useTrip } from "../hooks/useTrip";

const CATEGORIES = [
  "food",
  "transport",
  "hotel",
  "other",
  "shopping",
  "amusement",
];

function toUtcIso(datetimeLocal: string) {
  if (!datetimeLocal) return "";
  const date = new Date(datetimeLocal);
  return date.toISOString().replace(".000", "");
}

export default function AddExpensePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const tripState = useTrip(tripId);
  const memberState = useMembers(tripId);
  const currentUserId = getCurrentUserId();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [datetimeLocal, setDatetimeLocal] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = useMemo(
    () => tripState.data?.base_currency ?? "",
    [tripState.data],
  );
  const payerOptions = memberState.data;

  useEffect(() => {
    if (payerOptions.length === 0) return;

    const hasSelectedUser = payerOptions.some(
      (member) => member.user_id === paidByUserId,
    );
    if (hasSelectedUser) return;

    const hasCurrentUser = payerOptions.some(
      (member) => member.user_id === currentUserId,
    );
    setPaidByUserId(hasCurrentUser ? currentUserId : payerOptions[0].user_id);
  }, [currentUserId, paidByUserId, payerOptions]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tripId || !currency) return;

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    const datetime = toUtcIso(datetimeLocal);
    if (!datetime) {
      setError("Datetime is required.");
      return;
    }

    if (!paidByUserId) {
      setError("Paid by is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createExpense(tripId, {
        amount: parsed,
        currency,
        paid_by_user_id: paidByUserId,
        category,
        note: note || undefined,
        datetime,
      });
      navigate(`/trips/${tripId}`);
    } catch (err) {
      setError((err as Error).message ?? "Failed to create expense");
    } finally {
      setSaving(false);
    }
  };

  if (tripState.loading) {
    return (
      <div className="page">
        <div className="status">Loading trip...</div>
      </div>
    );
  }

  if (tripState.error || !tripState.data) {
    return (
      <div className="page">
        <div className="status status--error">
          {tripState.error ?? "Trip not found"}
        </div>
        <Link className="back-link" to="/">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="modal">
        <header className="modal__header">
          <div>
            <div className="modal__title">Add Expense</div>
            <div className="modal__subtitle">{tripState.data.title}</div>
          </div>
          <Link
            className="modal__close"
            to={`/trips/${tripState.data.trip_id}`}
          >
            x
          </Link>
        </header>

        <form className="modal__form" onSubmit={onSubmit}>
          <label className="field">
            <span>Datetime (local)</span>
            <input
              type="datetime-local"
              value={datetimeLocal}
              onChange={(event) => setDatetimeLocal(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Amount</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>Currency</span>
            <input type="text" value={currency} disabled />
          </label>

          <label className="field">
            <span>Paid by</span>
            <select
              value={paidByUserId}
              onChange={(event) => setPaidByUserId(event.target.value)}
              disabled={memberState.loading || payerOptions.length === 0}
              required
            >
              {payerOptions.map((member) => (
                <option key={member.name} value={member.user_id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note"
            />
          </label>

          {memberState.error && (
            <div className="status status--error">{memberState.error}</div>
          )}
          {error && <div className="status status--error">{error}</div>}

          <button
            className="primary"
            type="submit"
            disabled={saving || payerOptions.length === 0}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      </div>

      <div className="modal-backdrop" />
    </div>
  );
}
