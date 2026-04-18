import { useCallback, useEffect, useState } from "react";
import { deleteExpense, fetchTripExpenses, updateExpense, type ExpenseUpdateRequest } from "../api/expenses";
import type { ExpenseItem } from "../api/expenses";

export function useExpenses(tripId: string | undefined) {
  const [data, setData] = useState<ExpenseItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!tripId) return Promise.resolve();
    return fetchTripExpenses(tripId)
      .then((res) => setData(res.expenses))
      .catch((err) => setError(err.message ?? "支出の読み込みに失敗しました。"));
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setError("旅行 ID がありません。");
      setLoading(false);
      return;
    }

    let mounted = true;
    fetchTripExpenses(tripId)
      .then((res) => {
        if (mounted) setData(res.expenses);
      })
      .catch((err) => {
        if (mounted) setError(err.message ?? "支出の読み込みに失敗しました。");
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
        setError((err as Error).message ?? "支出の削除に失敗しました。");
        await refresh();
      }
    },
    [tripId, refresh]
  );

  const update = useCallback(
    async (expenseId: string, payload: ExpenseUpdateRequest) => {
      if (!tripId) return;
      const updated = await updateExpense(tripId, expenseId, payload);
      setData((prev) => {
        const next = prev.map((item) =>
          item.expense_id === expenseId ? updated : item
        );
        next.sort((a, b) => a.datetime.localeCompare(b.datetime));
        return next;
      });
    },
    [tripId]
  );

  return { data, error, loading, refresh, remove, update };
}
