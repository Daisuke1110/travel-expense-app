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

const CATEGORY_LABELS: Record<string, string> = {
  food: "食費",
  transport: "交通費",
  hotel: "宿泊費",
  other: "その他",
  shopping: "買い物",
  amusement: "娯楽",
};

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
      setError("金額は正の数で入力してください。");
      return;
    }

    const datetime = toUtcIso(datetimeLocal);
    if (!datetime) {
      setError("日時を入力してください。");
      return;
    }

    if (!paidByUserId) {
      setError("支払者を選択してください。");
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
      setError((err as Error).message ?? "支出の作成に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (tripState.loading) {
    return (
      <div className="page">
        <div className="status">旅行情報を読み込み中...</div>
      </div>
    );
  }

  if (tripState.error || !tripState.data) {
    return (
      <div className="page">
        <div className="status status--error">
          {tripState.error ?? "旅行が見つかりません。"}
        </div>
        <Link className="back-link" to="/">
          旅行一覧へ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="modal">
        <header className="modal__header">
          <div>
            <div className="modal__title">支出を追加</div>
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
            <span>日時</span>
            <input
              type="datetime-local"
              value={datetimeLocal}
              onChange={(event) => setDatetimeLocal(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <span>金額</span>
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
            <span>通貨</span>
            <input type="text" value={currency} disabled />
          </label>

          <label className="field">
            <span>支払者</span>
            <select
              value={paidByUserId}
              onChange={(event) => setPaidByUserId(event.target.value)}
              disabled={memberState.loading || payerOptions.length === 0}
              required
            >
              {payerOptions.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.name ?? member.user_id}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>カテゴリ</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>メモ</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="任意のメモ"
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
            {saving ? "保存中..." : "保存"}
          </button>
        </form>
      </div>

      <div className="modal-backdrop" />
    </div>
  );
}
