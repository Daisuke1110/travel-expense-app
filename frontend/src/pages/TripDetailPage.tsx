import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import ExpenseItemCard from "../components/ExpenseItem";
import SummaryBox from "../components/SummaryBox";
import { useExpenses } from "../hooks/useExpenses";
import { useTrip } from "../hooks/useTrip";

export default function TripDetailPage() {
  const { tripId } = useParams();
  const tripState = useTrip(tripId);
  const expenseState = useExpenses(tripId);

  const totals = useMemo(() => {
    const totalAmount = expenseState.data.reduce((sum, item) => sum + item.amount, 0);
    const rate = tripState.data?.rate_to_jpy ?? 0;
    const totalYen = Math.round(totalAmount * rate);
    return { totalAmount, totalYen };
  }, [expenseState.data, tripState.data]);

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
          <span className="chip">{trip.start_date} – {trip.end_date}</span>
          <span className="chip">Owner: {trip.owner_name ?? "owner"}</span>
        </div>
      </header>

      <SummaryBox
        baseCurrency={trip.base_currency}
        totalAmount={totals.totalAmount}
        totalYen={totals.totalYen}
        rateToJpy={trip.rate_to_jpy}
      />

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

      <button className="fab">+ Add Expense</button>
    </div>
  );
}
