import { useCallback, useEffect, useState } from "react";
import { deleteExpense, fetchTripExpenses } from "../api/expenses";
import type { ExpenseItem } from "../api/expenses";

export function useExpenses(tripId: string | undefined) {
  const [data, setData] = useState<ExpenseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!tripId) return Promise.resolve();
    return fetchTripExpenses(tripId)
      .then((res) => setData(res.expenses))
      .catch((err) => setError(err.message ?? "Failed to load expenses"));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setError("Missing trip id");
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchTripExpenses(tripId)
      .then((res) => {
        if (mounted) setData(res.expenses);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "Failed to load expenses");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [tripId]);

  const remove = useCallback(
    async (expenseId: string) => {
      if (!tripId) return;
      setData((prev) => prev.filter((item) => item.expense_id !== expenseId));
      try {
        await deleteExpense(tripId, expenseId);
      } catch (err) {
        setError((err as Error).message ?? "Failed to delete expense");
        await refresh();
      }
    },
    [tripId, refresh]
  );

  return { data, error, loading, refresh, remove };
}
