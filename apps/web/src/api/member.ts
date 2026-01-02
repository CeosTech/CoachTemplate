import { apiFetch, buildQuery } from "./client";
import type { PaginatedResponse } from "./client";
import { useAuthStore } from "../store/auth.store";
import type { Notification, MemberProgress, OnboardingStep, SessionRecap, BookingEventMeta, ExerciseVideo } from "./coach";

export type MemberBooking = {
  id: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "REFUSED";
  memberNotes?: string | null;
  coachNotes?: string | null;
  paymentId?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  pack?: { id: string; product?: { id: string; title?: string | null } };
  event?: BookingEventMeta;
};

export type MemberPackSummary = {
  id: string;
  status: "ACTIVE" | "USED" | "PAUSED";
  totalCredits?: number | null;
  creditsRemaining?: number | null;
  activatedAt: string;
  product: { id: string; title: string; description?: string | null; creditValue?: number | null };
};

export type MemberDashboardResponse = {
  quickStats: Array<{ label: string; value: string; helper: string }>;
  focusBlocks: Array<{ title: string; detail: string; tag: string }>;
  timeline: Array<{ day: string; title: string; meta: string }>;
  programTimeline: Array<{ phase: string; weeks: string; focus: string; status: string }>;
  snapshots: Array<{ label: string; image: string; weight: string; metric: string; notes: string }>;
  notifications: Notification[];
};

export type MemberProfileSettings = {
  email: string;
  fullName?: string | null;
  goal?: string | null;
  level?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  preferredTraining?: string | null;
  limitations?: string | null;
};

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type SessionRecapInput = {
  sessionDate?: string;
  focus?: string;
  intensity?: string;
  notes?: string;
  exercises: SessionRecap["exercises"];
};

export const MemberApi = {
  dashboard: () => apiFetch<MemberDashboardResponse>("/api/member/dashboard", { headers: authHeaders() }),
  progress: () => apiFetch<MemberProgress>("/api/member/progress", { headers: authHeaders() }),
  onboarding: () => apiFetch<OnboardingStep[]>("/api/member/onboarding", { headers: authHeaders() }),
  updateOnboardingStatus: (id: string, status: OnboardingStep["status"]) =>
    apiFetch<OnboardingStep>(`/api/member/onboarding/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  recaps: (params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<SessionRecap>>(`/api/member/recaps${buildQuery(params)}`, { headers: authHeaders() }),
  createRecap: (payload: SessionRecapInput) =>
    apiFetch<SessionRecap>("/api/member/recaps", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  updateRecap: (id: string, payload: SessionRecapInput) =>
    apiFetch<SessionRecap>(`/api/member/recaps/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  deleteRecap: (id: string) =>
    apiFetch<void>(`/api/member/recaps/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  notifications: () => apiFetch<Notification[]>("/api/notifications/member", { headers: authHeaders() }),
  updateNotificationStatus: (id: string, status: Notification["status"]) =>
    apiFetch<Notification>(`/api/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  deleteNotification: (id: string) =>
    apiFetch<void>(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  profile: () => apiFetch<MemberProfileSettings>("/api/member/settings/profile", { headers: authHeaders() }),
  updateProfile: (payload: Partial<MemberProfileSettings>) =>
    apiFetch<MemberProfileSettings>("/api/member/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  bookings: (params?: { status?: MemberBooking["status"]; productId?: string | null }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.productId) search.set("productId", params.productId);
    const query = search.toString() ? `?${search.toString()}` : "";
    return apiFetch<MemberBooking[]>(`/api/member/bookings${query}`, { headers: authHeaders() });
  },
  packs: () => apiFetch<MemberPackSummary[]>("/api/member/packs", { headers: authHeaders() }),
  videos: (params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<ExerciseVideo>>(`/api/member/videos${buildQuery(params)}`, { headers: authHeaders() }),
  recapUrl: () => {
    const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";
    return `${base}/api/member/recap.pdf`;
  }
};
