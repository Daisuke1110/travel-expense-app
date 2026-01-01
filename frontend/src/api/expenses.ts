import { apiFetch } from "./client";

export type ExpenseItem = {
  expense_id: string;
  trip_id: string;
  user_id: string;
  amount: number;
  currency: string;
  category?: string | null;
  note?: string | null;
  datetime: string;
  datetime_expense_id: string;
  created_at?: string | null;
};

export type ExpensesResponse = {
  expenses: ExpenseItem[];
};

export function fetchTripExpenses(tripId: string) {
  return apiFetch<ExpensesResponse>(`/trips/${tripId}/expenses`);
}

export function deleteExpense(tripId: string, expenseId: string) {
  return apiFetch<void>(`/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}
