import { type FormEvent, useState } from "react";
import type { ExpenseItem, ExpenseUpdateRequest } from "../api/expenses";
import type { TripMemberResponse } from "../api/trips";

type Props = {
  item: ExpenseItem;
  members: TripMemberResponse[];
  rateToJpy: number;
  onDelete: (expenseId: string) => void;
  onUpdate: (
    expenseId: string,
    payload: ExpenseUpdateRequest,
  ) => Promise<void> | void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function toLocalInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toUtcIso(datetimeLocal: string) {
  if (!datetimeLocal) return "";
  const date = new Date(datetimeLocal);
  return date.toISOString().replace(".000", "");
}

const CATEGORIES = [
  "food",
  "transport",
  "hotel",
  "other",
  "shopping",
  "amusement",
];

export default function ExpenseItemCard({
  item,
  members,
  rateToJpy,
  onDelete,
  onUpdate,
}: Props) {
  const yen = item.amount * rateToJpy;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.amount));
  const [paidByUserId, setPaidByUserId] = useState(item.paid_by_user_id);
  const [category, setCategory] = useState(item.category ?? "other");
  const [note, setNote] = useState(item.note ?? "");
  const [datetimeLocal, setDatetimeLocal] = useState(() =>
    toLocalInput(item.datetime),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setAmount(String(item.amount));
    setPaidByUserId(item.paid_by_user_id);
    setCategory(item.category ?? "other");
    setNote(item.note ?? "");
    setDatetimeLocal(toLocalInput(item.datetime));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
      await onUpdate(item.expense_id, {
        amount: parsed,
        paid_by_user_id: paidByUserId,
        category,
        note: note || undefined,
        datetime,
      });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message ?? "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="expense-card">
      <div className="expense-card__header">
        <div>
          <div className="expense-card__amount">
            {item.amount} {item.currency}
          </div>
          <div className="expense-card__yen">{yen}</div>
        </div>
        <div className="expense-card__actions">
          <button
            className="expense-card__edit"
            onClick={() => {
              if (!editing) resetForm();
              setEditing((prev) => !prev);
            }}
            type="button"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            className="expense-card__delete"
            onClick={() => onDelete(item.expense_id)}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="expense-card__meta">
        <span className="chip">Paid by {item.paid_by_user_id}</span>
        <span className="chip">{item.category ?? "other"}</span>
        <span className="muted">{formatDate(item.datetime)}</span>
      </div>
      {item.note && <div className="expense-card__note">{item.note}</div>}

      {editing && (
        <form className="expense-card__form" onSubmit={onSubmit}>
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
            <span>Paid by</span>
            <select
              value={paidByUserId}
              onChange={(event) => setPaidByUserId(event.target.value)}
              required
            >
              {members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.user_id}
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
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {value}
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
          {error && <div className="status status--error">{error}</div>}
          <div className="expense-card__buttons">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
