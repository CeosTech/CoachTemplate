import { apiFetch, buildQuery } from "./client";
import type { PaginatedResponse } from "./client";
import { useAuthStore } from "../store/auth.store";
import type { Product, SiteContent, SiteResponse } from "./public";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type CoachSiteUpdatePayload = Partial<
  SiteContent & {
    brandName?: string;
    tagline?: string;
    logoUrl?: string;
    primaryColor?: string;
  }
>;

type GoalInput = { title?: string; targetDate?: string; status?: string };
type CheckInInput = { metric: string; value: string; notes?: string };
type VideoNoteInput = { url: string; description?: string };

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ContactMessage = {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "ARCHIVED";
  createdAt: string;
};

export type MemberSummary = {
  id: string;
  fullName?: string | null;
  goal?: string | null;
  level?: string | null;
  isActivated?: boolean;
  user?: { email?: string | null; createdAt?: string | null };
  activePackCount?: number;
  hasActiveCredits?: boolean;
  totalCreditsRemaining?: number;
  lastPackTitle?: string | null;
  lastPackStatus?: string | null;
};

export type Notification = {
  id: string;
  memberId?: string | null;
  title: string;
  body: string;
  status: "UNREAD" | "READ";
  createdAt: string;
  member?: { fullName?: string | null; user?: { email?: string | null } };
};

export type Goal = {
  id: string;
  title: string;
  status: string;
  targetDate?: string | null;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  metric: string;
  value: string;
  notes?: string | null;
  createdAt: string;
};

export type VideoNote = {
  id: string;
  url: string;
  description?: string | null;
  createdAt: string;
};

export type ExerciseVideo = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  videoUrl: string;
  fileKey?: string;
  createdAt: string;
};

export type SessionRecapExercise = {
  name: string;
  sets?: string | null;
  reps?: string | null;
  rest?: string | null;
  tempo?: string | null;
  cues?: string | null;
};

export type SessionRecap = {
  id: string;
  memberId: string;
  sessionDate: string;
  focus?: string | null;
  intensity?: string | null;
  notes?: string | null;
  exercises: SessionRecapExercise[];
  createdAt?: string;
  member?: { fullName?: string | null; user?: { email?: string | null } };
  authorRole?: "COACH" | "MEMBER";
};

export type MemberProgress = {
  member?: {
    id: string;
    fullName?: string | null;
    goal?: string | null;
    level?: string | null;
    planUrl?: string | null;
    programNotes?: string | null;
    followUpNotes?: string | null;
  } | null;
  goals: Goal[];
  checkIns: CheckIn[];
  videoNotes: VideoNote[];
  onboardingSteps?: OnboardingStep[];
};

export type OnboardingStep = {
  id: string;
  memberId?: string;
  title: string;
  description?: string | null;
  status: "PENDING" | "COMPLETED" | "SKIPPED";
  dueDate?: string | null;
  orderIndex: number;
  completedAt?: string | null;
  createdAt?: string | null;
  fullName?: string | null;
};

export type BookingEventMeta = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  status: "PENDING" | "CONFIRMED" | "REFUSED";
  statusLabel: string;
  color: string;
  background?: string | null;
  startAt: string;
  endAt: string;
  memberName?: string | null;
  packTitle?: string | null;
  notes?: string | null;
  tooltip?: string | null;
};

export type CoachBooking = {
  id: string;
  userId: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "REFUSED";
  memberNotes?: string | null;
  coachNotes?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  paymentId?: string | null;
  user?: { email?: string | null; memberProfile?: { id: string; fullName?: string | null } | null };
  pack?: { id: string; product?: { id: string; title?: string | null } };
  event?: BookingEventMeta;
};

export type ProgramExercise = {
  id?: string;
  name: string;
  sets?: string;
  reps?: string;
  tempo?: string;
  rest?: string;
  notes?: string;
};

export type ProgramWorkout = {
  id?: string;
  day: string;
  focus: string;
  notes?: string;
  exercises: ProgramExercise[];
};

export type ProgramPlan = {
  id: string;
  title: string;
  goal?: string | null;
  deliveryNotes?: string | null;
  workouts: ProgramWorkout[];
  memberId?: string | null;
  member?: { id: string; fullName?: string | null; user?: { email?: string | null } | null } | null;
  sharePath: string;
  shareUrl: string;
  shareToken: string;
  isArchived?: boolean;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProgramPlanPayload = {
  title: string;
  goal?: string;
  deliveryNotes?: string;
  workouts: ProgramWorkout[];
  memberId?: string;
};

export type ProgramSharePayload = {
  plan: ProgramPlan;
  shareLink: string | null;
  shareText: string;
  mailto: string;
  whatsapp: string;
  qrPayload: string;
};

export type MemberCoachNotes = {
  id: string;
  programNotes?: string | null;
  followUpNotes?: string | null;
  planUrl?: string | null;
};

export const CoachVideoApi = {
  list: (params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<ExerciseVideo>>(`/api/coach/videos${buildQuery(params)}`, {
      headers: authHeaders()
    }),
  upload: (payload: { title: string; description?: string; category: string; file?: File | null; externalUrl?: string }) => {
    const formData = new FormData();
    formData.append("title", payload.title);
    if (payload.description) formData.append("description", payload.description);
    formData.append("category", payload.category || "Général");
    if (payload.externalUrl) formData.append("externalUrl", payload.externalUrl);
    if (payload.file) formData.append("video", payload.file);
    return apiFetch<ExerciseVideo>("/api/coach/videos", {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });
  },
  delete: (id: string) =>
    apiFetch<void>(`/api/coach/videos/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    })
};

export const CoachSiteApi = {
  get: () =>
    apiFetch<SiteResponse>("/api/coach/site", {
      headers: authHeaders()
    }),
  update: (payload: CoachSiteUpdatePayload) =>
    apiFetch<SiteResponse>("/api/coach/site", {
      method: "PUT",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  contactMessages: () => apiFetch<ContactMessage[]>("/api/contact", { headers: authHeaders() }),
  updateContactStatus: (id: string, status: ContactMessage["status"]) =>
    apiFetch<ContactMessage>(`/api/contact/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  members: (params?: { search?: string; level?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.level) qs.set("level", params.level);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiFetch<MemberSummary[]>(`/api/member/all${suffix}`, { headers: authHeaders() });
  },
  memberDetail: (id: string) => apiFetch(`/api/member/${id}`, { headers: authHeaders() }),
  memberProgress: (id: string) => apiFetch<MemberProgress>(`/api/member/${id}/progress`, { headers: authHeaders() }),
  updateMemberNotes: (memberId: string, payload: { programNotes?: string; followUpNotes?: string }) =>
    apiFetch<MemberCoachNotes>(`/api/member/${memberId}/coach-notes`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  memberOnboarding: (id: string) => apiFetch<OnboardingStep[]>(`/api/member/${id}/onboarding`, { headers: authHeaders() }),
  onboardingAlerts: () => apiFetch<OnboardingStep[]>(`/api/member/alerts/onboarding`, { headers: authHeaders() }),
  createGoal: (memberId: string, payload: GoalInput) =>
    apiFetch<Goal>(`/api/member/${memberId}/goals`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  updateGoal: (memberId: string, goalId: string, payload: GoalInput) =>
    apiFetch<Goal>(`/api/member/${memberId}/goals/${goalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  deleteGoal: (memberId: string, goalId: string) =>
    apiFetch<void>(`/api/member/${memberId}/goals/${goalId}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  createCheckIn: (memberId: string, payload: CheckInInput) =>
    apiFetch<CheckIn>(`/api/member/${memberId}/checkins`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  deleteCheckIn: (memberId: string, checkInId: string) =>
    apiFetch<void>(`/api/member/${memberId}/checkins/${checkInId}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  createVideoNote: (memberId: string, payload: VideoNoteInput) =>
    apiFetch<VideoNote>(`/api/member/${memberId}/video-notes`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  deleteVideoNote: (memberId: string, videoNoteId: string) =>
    apiFetch<void>(`/api/member/${memberId}/video-notes/${videoNoteId}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  memberRecapUrl: (memberId: string) => `${API_BASE}/api/member/${memberId}/recap.pdf`,
  createMember: (payload: {
    email: string;
    fullName?: string;
    goal?: string;
    level?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    preferredTraining?: string;
    limitations?: string;
  }) =>
    apiFetch<{ member: MemberSummary; temporaryPassword: string }>("/api/member", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  notifications: () => apiFetch<Notification[]>("/api/notifications/coach", { headers: authHeaders() }),
  sendNotification: (payload: { title: string; body: string; memberId?: string; audience?: "ALL" }) =>
    apiFetch("/api/notifications", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  updateNotificationStatus: (id: string, status: Notification["status"]) =>
    apiFetch<Notification>(`/api/notifications/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  deleteNotification: (id: string) =>
    apiFetch<void>(`/api/notifications/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  memberRecaps: (memberId: string, params?: { page?: number; pageSize?: number }) =>
    apiFetch<PaginatedResponse<SessionRecap>>(`/api/member/${memberId}/recaps${buildQuery(params)}`, {
      headers: authHeaders()
    }),
  createSessionRecap: (
    memberId: string,
    payload: { sessionDate?: string; focus?: string; intensity?: string; notes?: string; exercises: SessionRecapExercise[] }
  ) =>
    apiFetch<SessionRecap>(`/api/member/${memberId}/recaps`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  updateSessionRecap: (
    memberId: string,
    recapId: string,
    payload: { sessionDate?: string; focus?: string; intensity?: string; notes?: string; exercises: SessionRecapExercise[] }
  ) =>
    apiFetch<SessionRecap>(`/api/member/${memberId}/recaps/${recapId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  deleteSessionRecap: (memberId: string, recapId: string) =>
    apiFetch<void>(`/api/member/${memberId}/recaps/${recapId}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  createOnboardingStep: (memberId: string, payload: { title: string; description?: string; dueDate?: string | null; status?: string }) =>
    apiFetch<OnboardingStep>(`/api/member/${memberId}/onboarding`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  updateOnboardingStep: (
    memberId: string,
    stepId: string,
    payload: { title?: string; description?: string | null; dueDate?: string | null; status?: string }
  ) =>
    apiFetch<OnboardingStep>(`/api/member/${memberId}/onboarding/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", ...authHeaders() }
    }),
  deleteOnboardingStep: (memberId: string, stepId: string) =>
    apiFetch<void>(`/api/member/${memberId}/onboarding/${stepId}`, {
      method: "DELETE",
      headers: authHeaders()
    })
};

export type CoachProductPayload = {
  title: string;
  description?: string;
  priceCents: number;
  billingInterval?: string | null;
  checkoutUrl?: string | null;
  isActive?: boolean;
  creditValue?: number | null;
};

export type CoachProductUpdatePayload = Partial<CoachProductPayload>;

export const CoachProductApi = {
  list: () =>
    apiFetch<Product[]>("/api/coach/products", {
      headers: authHeaders()
    }),
  create: (payload: CoachProductPayload) =>
    apiFetch<Product>("/api/coach/products", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  update: (id: string, payload: CoachProductUpdatePayload) =>
    apiFetch<Product>(`/api/coach/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  delete: (id: string) =>
    apiFetch<void>(`/api/coach/products/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    })
};

export type CoachProfileSettings = {
  email: string;
  brandName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
};

export type CoachIntegrationSettings = {
  id?: string;
  coachId?: string;
  stripePublicKey?: string | null;
  stripeSecretKey?: string | null;
  stripeWebhookSecret?: string | null;
};

export const CoachSettingsApi = {
  profile: () =>
    apiFetch<CoachProfileSettings>("/api/coach/settings/profile", {
      headers: authHeaders()
    }),
  updateProfile: (payload: Partial<CoachProfileSettings>) =>
    apiFetch<CoachProfileSettings>("/api/coach/settings/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  integrations: () =>
    apiFetch<CoachIntegrationSettings>("/api/coach/settings/integrations", {
      headers: authHeaders()
    }),
  updateIntegrations: (payload: Partial<CoachIntegrationSettings>) =>
    apiFetch<CoachIntegrationSettings>("/api/coach/settings/integrations", {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    })
};

export type AvailabilitySlot = {
  id: string;
  startAt: string;
  endAt: string;
};

export type AvailabilityRule = {
  id: string;
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export const CoachAvailabilityApi = {
  list: () =>
    apiFetch<AvailabilitySlot[]>("/api/coach/availability", {
      headers: authHeaders()
    }),
  create: (payload: { startAt: string; endAt: string }) =>
    apiFetch<AvailabilitySlot>("/api/coach/availability", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  update: (id: string, payload: { startAt: string; endAt: string }) =>
    apiFetch<AvailabilitySlot>(`/api/coach/availability/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  delete: (id: string) =>
    apiFetch<void>(`/api/coach/availability/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    })
};

export const CoachAvailabilityRuleApi = {
  list: () =>
    apiFetch<AvailabilityRule[]>("/api/coach/availability/rules/all", {
      headers: authHeaders()
    }),
  create: (payload: { weekday: number; startTime: string; endTime: string }) =>
    apiFetch<AvailabilityRule>("/api/coach/availability/rules", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  update: (id: string, payload: { weekday?: number; startTime?: string; endTime?: string }) =>
    apiFetch<AvailabilityRule>(`/api/coach/availability/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/coach/availability/rules/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  apply: (payload?: { days?: number; startDate?: string }) =>
    apiFetch<{ createdCount: number }>("/api/coach/availability/rules/apply", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    })
};

export const CoachBookingApi = {
  list: (params?: { status?: CoachBooking["status"]; productId?: string | null }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.productId) search.set("productId", params.productId);
    const query = search.toString() ? `?${search.toString()}` : "";
    return apiFetch<CoachBooking[]>(`/api/coach/bookings${query}`, {
      headers: authHeaders()
    });
  },
  update: (id: string, payload: { status: CoachBooking["status"]; coachNotes?: string }) =>
    apiFetch<CoachBooking>(`/api/coach/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    })
};

export const CoachProgramApi = {
  list: () =>
    apiFetch<ProgramPlan[]>("/api/coach/programs", {
      headers: authHeaders()
    }),
  create: (payload: ProgramPlanPayload) =>
    apiFetch<ProgramPlan>("/api/coach/programs", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  update: (id: string, payload: Partial<ProgramPlanPayload>) =>
    apiFetch<ProgramPlan>(`/api/coach/programs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/coach/programs/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  assign: (id: string, memberId: string) =>
    apiFetch<ProgramPlan>(`/api/coach/programs/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ memberId }),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  exportShare: (id: string) =>
    apiFetch<ProgramSharePayload>(`/api/coach/programs/${id}/export/share`, {
      headers: authHeaders()
    }),
  exportPdfUrl: (id: string) => `${API_BASE}/api/coach/programs/${id}/export/pdf`
};

export type CoachOnboardingTemplate = {
  id: string;
  title: string;
  description?: string | null;
  steps: Array<{
    id: string;
    title: string;
    description?: string | null;
    dueOffsetDays?: number | null;
    autoEmail?: boolean;
    autoSms?: boolean;
    orderIndex: number;
  }>;
};

type TemplatePayload = {
  title?: string;
  description?: string;
  steps?: Array<{ title: string; description?: string; dueOffsetDays?: number | null; autoEmail?: boolean; autoSms?: boolean }>;
};

export const OnboardingTemplateApi = {
  list: () =>
    apiFetch<CoachOnboardingTemplate[]>("/api/member/onboarding/templates", {
      headers: authHeaders()
    }),
  create: (payload: TemplatePayload) =>
    apiFetch<CoachOnboardingTemplate>("/api/member/onboarding/templates", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  update: (id: string, payload: TemplatePayload) =>
    apiFetch<CoachOnboardingTemplate>(`/api/member/onboarding/templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...authHeaders()
      }
    }),
  remove: (id: string) =>
    apiFetch<void>(`/api/member/onboarding/templates/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    }),
  applyToMember: (memberId: string, templateId: string) =>
    apiFetch(`/api/member/${memberId}/onboarding/apply/${templateId}`, {
      method: "POST",
      headers: authHeaders()
    })
};
