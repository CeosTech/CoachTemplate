import { apiFetch, buildQuery } from "./client";
import type { PaginatedResponse } from "./client";
import { useAuthStore } from "../store/auth.store";

export type Payment = {
  id: string;
  memberId: string;
  amountCents: number;
  currency: string;
  method: "STRIPE" | "CASH";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  providerRef?: string | null;
  metadata?: string | null;
  notes?: string | null;
  createdAt: string;
  member?: { fullName?: string | null; user?: { email?: string | null } };
};

export type CheckoutNext =
  | { type: "REDIRECT"; url: string | null }
  | { type: "WALLET"; payload: Record<string, unknown> }
  | { type: "IN_APP"; instructions: string };

export type CheckoutResponse = {
  payment: Payment;
  next: CheckoutNext;
};

export type CoachPaymentReport = {
  totals: Record<string, number>;
  summary: { paid: number; outstanding: number };
  cash: { pending: Payment[]; paid: Payment[] };
};

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const PaymentApi = {
  checkout: (payload: { method: Payment["method"]; productId?: string; amountCents?: number; notes?: string; description?: string }) =>
    apiFetch<CheckoutResponse>("/api/payments/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  memberList: (params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<Payment>>(`/api/payments/member${buildQuery(params)}`, { headers: authHeaders() }),
  coachList: (params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<Payment>>(`/api/payments/coach${buildQuery(params)}`, { headers: authHeaders() }),
  coachReport: () => apiFetch<CoachPaymentReport>("/api/payments/coach/report", { headers: authHeaders() }),
  updateStatus: (id: string, status: Payment["status"], notes?: string) =>
    apiFetch<Payment>(`/api/payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, notes }),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  createCash: (payload: { memberId: string; amountCents: number; description?: string; notes?: string }) =>
    apiFetch<Payment>("/api/payments/coach/cash", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  receiptUrl: (id: string) => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
    return `${base}/api/payments/${id}/receipt`;
  }
};
