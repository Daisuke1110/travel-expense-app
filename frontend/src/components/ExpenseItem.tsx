import type { ExpenseItem } from "../api/expenses";

type Props = {
  item: ExpenseItem;
  rateToJpy: number;
  onDelete: (expenseId: string) => void;
};

function formatDate(value: string) {
  return value.replace("T", " ").replace("Z", " UTC");
}

export default function ExpenseItemCard({ item, rateToJpy, onDelete }: Props) {
  const yen = Math.round(item.amount * rateToJpy);
  return (
    <div className="expense-card">
      <div className="expense-card__header">
        <div>
          <div className="expense-card__amount">
            {item.amount} {item.currency}
          </div>
          <div className="expense-card__yen">≈ ¥{yen}</div>
        </div>
        <button
          className="expense-card__delete"
          onClick={() => onDelete(item.expense_id)}
        >
          Delete
        </button>
      </div>
      <div className="expense-card__meta">
        <span className="chip">{item.category ?? "other"}</span>
        <span className="muted">{formatDate(item.datetime)}</span>
      </div>
      {item.note && <div className="expense-card__note">{item.note}</div>}
    </div>
  );
}
