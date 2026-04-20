import { type FormEvent, useEffect, useState } from "react";
import type { ExpenseItem, ExpenseUpdateRequest } from "../api/expenses";
import type { TripMemberResponse } from "../api/trips";
import {
  classifyExpense,
  getExpenseKindLabel,
} from "../utils/expenseClassification";
import {
  calculateExpenseShareSummary,
  formatAmount,
} from "../utils/expenseShare";

type Props = {
  currentUserId: string;
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

const CATEGORY_LABELS: Record<string, string> = {
  food: "食費",
  transport: "交通費",
  hotel: "宿泊費",
  other: "その他",
  shopping: "買い物",
  amusement: "娯楽",
};

export default function ExpenseItemCard({
  currentUserId,
  item,
  members,
  rateToJpy,
  onDelete,
  onUpdate,
}: Props) {
  const yen = item.amount * rateToJpy;
  const expenseKind = classifyExpense(
    currentUserId,
    item.paid_by_user_id,
    item.participant_user_ids,
  );
  const expenseKindLabel = getExpenseKindLabel(expenseKind);
  const shareSummary = calculateExpenseShareSummary(
    currentUserId,
    item.amount,
    item.paid_by_user_id,
    item.participant_user_ids,
  );
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(item.amount));
  const [paidByUserId, setPaidByUserId] = useState(item.paid_by_user_id);
  const [participantUserIds, setParticipantUserIds] = useState(
    item.participant_user_ids,
  );
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
    setParticipantUserIds(item.participant_user_ids);
    setCategory(item.category ?? "other");
    setNote(item.note ?? "");
    setDatetimeLocal(toLocalInput(item.datetime));
  };

  useEffect(() => {
    if (editing) return;
    resetForm();
  }, [editing, item]);

  const toggleParticipant = (memberUserId: string) => {
    setParticipantUserIds((prev) =>
      prev.includes(memberUserId)
        ? prev.filter((userId) => userId !== memberUserId)
        : [...prev, memberUserId],
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
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

    if (participantUserIds.length === 0) {
      setError("対象者を1人以上選択してください。");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onUpdate(item.expense_id, {
        amount: parsed,
        paid_by_user_id: paidByUserId,
        participant_user_ids: participantUserIds,
        category,
        note: note || undefined,
        datetime,
      });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message ?? "支出の更新に失敗しました。");
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
          <div className="expense-card__yen">{yen} 円</div>
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
            {editing ? "キャンセル" : "編集"}
          </button>
          <button
            className="expense-card__delete"
            onClick={() => onDelete(item.expense_id)}
            type="button"
          >
            削除
          </button>
        </div>
      </div>
      <div className="expense-card__meta">
        <span className="chip">
          支払者: {item.paid_by_name ?? item.paid_by_user_id}
        </span>
        <span className="chip">
          {CATEGORY_LABELS[item.category ?? "other"] ?? (item.category ?? "other")}
        </span>
        <span className="chip">{expenseKindLabel}</span>
        <span className="muted">{formatDate(item.datetime)}</span>
      </div>
      <div className="expense-card__share">
        <span className="expense-card__share-item">
          対象者 {shareSummary.participantCount} 人
        </span>
        <span className="expense-card__share-item">
          1人あたり {formatAmount(shareSummary.perPersonAmount)} {item.currency}
        </span>
        {shareSummary.myShareAmount > 0 && (
          <span className="expense-card__share-item">
            自分負担 {formatAmount(shareSummary.myShareAmount)} {item.currency}
          </span>
        )}
        {shareSummary.myAdvanceAmount > 0 && (
          <span className="expense-card__share-item">
            立替中 {formatAmount(shareSummary.myAdvanceAmount)} {item.currency}
          </span>
        )}
        {shareSummary.coveredByOthersAmount > 0 && (
          <span className="expense-card__share-item">
            立て替えてもらい中{" "}
            {formatAmount(shareSummary.coveredByOthersAmount)} {item.currency}
          </span>
        )}
      </div>
      {item.note && <div className="expense-card__note">{item.note}</div>}

      {editing && (
        <form className="expense-card__form" onSubmit={onSubmit}>
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
            <span>支払者</span>
            <select
              value={paidByUserId}
              onChange={(event) => setPaidByUserId(event.target.value)}
              required
            >
              {members.map((member) => (
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
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field">
            <span>対象者</span>
            <div className="participant-list">
              {members.map((member) => (
                <label key={member.user_id} className="participant-list__item">
                  <input
                    type="checkbox"
                    checked={participantUserIds.includes(member.user_id)}
                    onChange={() => toggleParticipant(member.user_id)}
                  />
                  <span>{member.name ?? member.user_id}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>メモ</span>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="任意のメモ"
            />
          </label>
          {error && <div className="status status--error">{error}</div>}
          <div className="expense-card__buttons">
            <button className="primary" type="submit" disabled={saving}>
              {saving ? "保存中..." : "変更を保存"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
