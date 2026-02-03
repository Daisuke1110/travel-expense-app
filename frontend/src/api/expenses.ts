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

export type ExpenseCreateRequest = {
  amount: number;
  currency: string;
  category?: string;
  note?: string;
  datetime: string;
};

export type ExpenseUpdateRequest = {
  amount?: number;
  category?: string;
  note?: string;
  datetime?: string;
};

export function fetchTripExpenses(tripId: string) {
  return apiFetch<ExpensesResponse>(`/trips/${tripId}/expenses`);
}

export function createExpense(tripId: string, payload: ExpenseCreateRequest) {
  return apiFetch<ExpenseItem>(`/trips/${tripId}/expenses`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteExpense(tripId: string, expenseId: string) {
  return apiFetch<void>(`/trips/${tripId}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}

export function updateExpense(tripId: string, expenseId: string, payload: ExpenseUpdateRequest) {
  return apiFetch<ExpenseItem>(`/trips/${tripId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
