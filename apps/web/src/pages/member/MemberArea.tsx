import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Outlet, useOutletContext, useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { DashboardNav } from "../../components/DashboardNav";
import { CalendarGrid, type CalendarGridEvent } from "../../components/CalendarGrid";
import { useAuthStore, type AuthState } from "../../store/auth.store";
import { PublicApi, type Product, type Slot } from "../../api/public";
import { MemberApi, type MemberDashboardResponse, type MemberBooking, type MemberPackSummary } from "../../api/member";
import type { Notification, MemberProgress, OnboardingStep, SessionRecap, ExerciseVideo } from "../../api/coach";
import { PaymentApi, type Payment } from "../../api/payment";
import { BookingForm } from "../BookingPage";
import type { PaginationMeta, PaginatedResponse } from "../../api/client";
import { PaginationControls } from "../../components/Pagination";
import { usePushNotifications } from "../../hooks/usePushNotifications";

const quickStatsFallback = [
  { label: "Séances ce mois", value: "8/12", helper: "+2 vs dernier mois" },
  { label: "Charge moyenne", value: "7.1", helper: "Zone optimale" },
  { label: "Sommeil", value: "7h32", helper: "+24 min" }
];

const focusBlocksFallback = [
  { title: "Bloc Force", detail: "Semaine 3/4 • 85% - 92%", tag: "Actif" },
  { title: "Conditioning", detail: "2 x EMOM 18' / zone 3", tag: "Cardio" }
];

const timelineFallback = [
  { day: "Mercredi", title: "Lower - Force", meta: "Back Squat + Front Foot Elevated Split Squat" },
  { day: "Vendredi", title: "Upper - Volume", meta: "Bench tempo + accessoires push/pull" },
  { day: "Samedi", title: "Conditioning", meta: "Partner WOD + core finisher" }
];

const programTimelineFallback = [
  { phase: "Bloc intensif", weeks: "Sem. 1-4", focus: "Progressions force + volume", status: "En cours" },
  { phase: "Deload", weeks: "Sem. 5", focus: "Volume -40% + mobilité", status: "À venir" },
  { phase: "Nouveau cycle", weeks: "Sem. 6-9", focus: "Hybrid conditioning + PR test", status: "Planifié" }
];

const snapshotFallback = [
  {
    label: "Semaine 1",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=60",
    weight: "78 kg",
    metric: "-",
    notes: "Kickoff + tests initiaux"
  },
  {
    label: "Semaine 8",
    image: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=60",
    weight: "73 kg",
    metric: "-5 kg / +10% force",
    notes: "Photos + mesures envoyées"
  }
];

const sessionRecapFallback: SessionRecap[] = [
  {
    id: "recap-fallback-1",
    memberId: "demo",
    sessionDate: new Date().toISOString(),
    focus: "Force — Lower body",
    intensity: "RPE 8",
    notes: "Tempo contrôlé + focus sur la stabilité.",
    exercises: [
      { name: "Back Squat", sets: "5", reps: "5", tempo: "31X1", rest: "150s" },
      { name: "Hip Thrust", sets: "4", reps: "10", rest: "90s" },
      { name: "Farmer Carry", sets: "3", reps: "40m", rest: "60s" }
    ],
    createdAt: new Date().toISOString()
  }
];

const memberCalendarStatusStyles = {
  PENDING: { label: "En attente", color: "#f97316", background: "rgba(249,115,22,0.15)" },
  CONFIRMED: { label: "Confirmée", color: "#16a34a", background: "rgba(22,163,74,0.15)" },
  REFUSED: { label: "Refusée", color: "#dc2626", background: "rgba(220,38,38,0.15)" },
  AVAILABLE: { label: "Disponible", color: "#0f172a", background: "rgba(15,23,42,0.08)" }
} as const;

type MemberOutletContext = {
  user: AuthState["user"];
  quickStats: typeof quickStatsFallback;
  focusBlocks: typeof focusBlocksFallback;
  timeline: typeof timelineFallback;
  programTimeline: typeof programTimelineFallback;
  snapshotData: typeof snapshotFallback;
  sessionRecaps: SessionRecap[];
  upsells: Product[];
  monthly: Product[];
  featuredUpsell?: Product;
  goToCheckout: (url?: string | null) => void;
  notifications: Notification[];
  markNotification: (id: string, status: Notification["status"]) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  payments: Payment[];
  progress: MemberProgress | null;
  onboarding: OnboardingStep[];
  onboardingProgress: number;
  updateOnboarding: (id: string, status: OnboardingStep["status"]) => Promise<void>;
  bookings: MemberBooking[];
  refreshRecaps: (params?: { page?: number; pageSize?: number }) => Promise<void>;
  packs: MemberPackSummary[];
  refreshPacks: () => Promise<void>;
  videos: ExerciseVideo[];
  refreshVideos: (params?: { page?: number; pageSize?: number }) => Promise<void>;
  recapsPagination: PaginationMeta | null;
  goToRecapPage: (page: number) => Promise<void>;
  videosPagination: PaginationMeta | null;
  goToVideoPage: (page: number) => Promise<void>;
  paymentsPagination: PaginationMeta | null;
  goToPaymentPage: (page: number) => Promise<void>;
  refreshMemberPayments: (params?: { page?: number; pageSize?: number }) => Promise<void>;
};

export function MemberLayout() {
  const user = useAuthStore((s) => s.user);
  const [products, setProducts] = useState<Product[]>([]);
  const [dashboard, setDashboard] = useState<MemberDashboardResponse | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [memberPayments, setMemberPayments] = useState<PaginatedResponse<Payment> | null>(null);
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStep[]>([]);
  const [recapsData, setRecapsData] = useState<PaginatedResponse<SessionRecap> | null>(null);
  const [bookings, setBookings] = useState<MemberBooking[]>([]);
  const [packs, setPacks] = useState<MemberPackSummary[]>([]);
  const [videosData, setVideosData] = useState<PaginatedResponse<ExerciseVideo> | null>(null);
  const [accessGate, setAccessGate] = useState<{ required: boolean; message?: string }>({ required: false });
  const recapParamsRef = useRef({ page: 1, pageSize: 5 });
  const videoParamsRef = useRef({ page: 1, pageSize: 9 });
  const paymentParamsRef = useRef({ page: 1, pageSize: 8 });

  const handleAccessError = useCallback((err: any) => {
    if (err?.status === 402) {
      setAccessGate({ required: true, message: err?.message ?? "Paiement requis pour accéder au dashboard." });
    }
  }, []);

  const refreshRecaps = useCallback(
    async (params?: { page?: number; pageSize?: number }) => {
      try {
        const nextParams = {
          page: params?.page ?? recapParamsRef.current.page,
          pageSize: params?.pageSize ?? recapParamsRef.current.pageSize
        };
        const list = await MemberApi.recaps(nextParams);
        setRecapsData(list);
        recapParamsRef.current = { page: list.pagination.page, pageSize: list.pagination.pageSize };
      } catch (err) {
        handleAccessError(err);
      }
    },
    [handleAccessError]
  );

  const refreshPacks = useCallback(async () => {
    try {
      const list = await MemberApi.packs();
      setPacks(list);
    } catch (err) {
      handleAccessError(err);
    }
  }, [handleAccessError]);

  const refreshVideos = useCallback(
    async (params?: { page?: number; pageSize?: number }) => {
      try {
        const nextParams = {
          page: params?.page ?? videoParamsRef.current.page,
          pageSize: params?.pageSize ?? videoParamsRef.current.pageSize
        };
        const list = await MemberApi.videos(nextParams);
        setVideosData(list);
        videoParamsRef.current = { page: list.pagination.page, pageSize: list.pagination.pageSize };
      } catch (err) {
        handleAccessError(err);
      }
    },
    [handleAccessError]
  );

  const refreshMemberPayments = useCallback(
    async (params?: { page?: number; pageSize?: number }) => {
      try {
        const nextParams = {
          page: params?.page ?? paymentParamsRef.current.page,
          pageSize: params?.pageSize ?? paymentParamsRef.current.pageSize
        };
        const list = await PaymentApi.memberList(nextParams);
        setMemberPayments(list);
        paymentParamsRef.current = { page: list.pagination.page, pageSize: list.pagination.pageSize };
      } catch {
        // ignore errors, UI has empty state
      }
    },
    []
  );

  useEffect(() => {
    if (accessGate.required) return;
    PublicApi.products().then(setProducts).catch(() => {});
    MemberApi.dashboard()
      .then((data) => {
        setDashboard(data);
        setNotifications(data.notifications ?? []);
      })
      .catch(handleAccessError);
    refreshMemberPayments();
    MemberApi.progress().then(setProgress).catch(handleAccessError);
    MemberApi.onboarding().then(setOnboarding).catch(handleAccessError);
    refreshRecaps();
    MemberApi.bookings().then(setBookings).catch(handleAccessError);
    refreshPacks();
    refreshVideos();
  }, [accessGate.required, handleAccessError, refreshMemberPayments, refreshRecaps, refreshPacks, refreshVideos]);

  const quickStats = dashboard?.quickStats ?? quickStatsFallback;
  const focusBlocks = dashboard?.focusBlocks ?? focusBlocksFallback;
  const timeline = dashboard?.timeline ?? timelineFallback;
  const programTimeline = dashboard?.programTimeline ?? programTimelineFallback;
  const snapshotData = dashboard?.snapshots ?? snapshotFallback;
  const sessionRecaps = recapsData ? recapsData.items : sessionRecapFallback;
  const recapsPagination = recapsData?.pagination ?? null;
  const videos = videosData?.items ?? [];
  const videosPagination = videosData?.pagination ?? null;
  const payments = memberPayments?.items ?? [];
  const paymentsPagination = memberPayments?.pagination ?? null;
  const upsells = useMemo(() => products.filter((p) => p.billingInterval !== "MONTHLY"), [products]);
  const monthly = useMemo(() => products.filter((p) => p.billingInterval === "MONTHLY"), [products]);
  const featuredUpsell = upsells[0];
  const onboardingProgress = onboarding.length ? Math.round((onboarding.filter((step) => step.status === "COMPLETED").length / onboarding.length) * 100) : 0;

  function goToCheckout(url?: string | null) {
    if (!url) return alert("Lien de paiement indisponible pour le moment.");
    window.open(url, "_blank", "noopener");
  }

  async function markNotification(id: string, status: Notification["status"]) {
    const updated = await MemberApi.updateNotificationStatus(id, status);
    setNotifications((prev) => prev.map((notif) => (notif.id === updated.id ? updated : notif)));
  }

  async function deleteNotification(id: string) {
    await MemberApi.deleteNotification(id);
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  }

  async function updateOnboarding(stepId: string, status: OnboardingStep["status"]) {
    const updated = await MemberApi.updateOnboardingStatus(stepId, status);
    setOnboarding((prev) => prev.map((step) => (step.id === updated.id ? updated : step)));
  }

  const goToRecapPage = useCallback(
    async (page: number) => {
      await refreshRecaps({ page });
    },
    [refreshRecaps]
  );

  const goToVideoPage = useCallback(
    async (page: number) => {
      await refreshVideos({ page });
    },
    [refreshVideos]
  );

  const goToPaymentPage = useCallback(
    async (page: number) => {
      await refreshMemberPayments({ page });
    },
    [refreshMemberPayments]
  );

  const contextValue: MemberOutletContext = {
    user,
    quickStats,
    focusBlocks,
    timeline,
    programTimeline,
    snapshotData,
    sessionRecaps,
    upsells,
    monthly,
    featuredUpsell,
    goToCheckout,
    notifications,
    markNotification,
    deleteNotification,
    payments,
    progress,
    onboarding,
    onboardingProgress,
    updateOnboarding,
    bookings,
    refreshRecaps,
    packs,
    refreshPacks,
    videos,
    refreshVideos,
    recapsPagination,
    goToRecapPage,
    videosPagination,
    goToVideoPage,
    paymentsPagination,
    goToPaymentPage,
    refreshMemberPayments
  };

  const sections = [
    { label: "Vue d'ensemble", to: "/member/overview", group: "Accueil" },
    { label: "Onboarding", to: "/member/onboarding", group: "Parcours" },
    { label: "Réservations", to: "/member/booking", group: "Parcours" },
    { label: "Agenda", to: "/member/calendar", group: "Parcours" },
    { label: "Programmation", to: "/member/timeline", group: "Training" },
    { label: "Recaps séances", to: "/member/recaps", group: "Training" },
    { label: "Vidéothèque", to: "/member/videos", group: "Training" },
    { label: "Objectifs & check-ins", to: "/member/progress", group: "Suivi" },
    { label: "Notifications", to: "/member/notifications", group: "Suivi" },
    { label: "Paiements", to: "/member/payments", group: "Admin" },
    { label: "Offres", to: "/member/offers", group: "Admin" },
    { label: "Paramètres", to: "/member/settings", group: "Admin" }
  ];

  const memberNavLinks: Array<{ label: string; to: string; variant?: "primary" | "menu" }> = [
    { label: "Vue d'ensemble", to: "/member/overview", variant: "menu" },
    { label: "Agenda", to: "/member/calendar", variant: "menu" },
    { label: "Timeline", to: "/member/timeline", variant: "menu" },
    { label: "Vidéos", to: "/member/videos", variant: "menu" },
    { label: "Réserver", to: "/member/booking", variant: "menu" },
    { label: "Paramètres", to: "/member/settings" }
  ];

  if (accessGate.required) {
    return (
      <>
        <DashboardNav title="Espace adhérent" subtitle="Paiement requis" links={memberNavLinks} />
        <div className="site-shell site-shell--plain">
          <div className="dashboard">
            <section className="dashboard-card">
              <div className="dashboard-card__title">Active ton espace</div>
              <p>
                {accessGate.message ??
                  "Choisis un pack sur la landing ou finalise ton règlement pour rejoindre le dashboard."}
              </p>
              <div className="hero-ctas" style={{ marginTop: 12 }}>
                <Link to="/" className="btn">
                  Voir les packs
                </Link>
                <Link to="/member/booking" className="btn btn--ghost">
                  J'ai déjà payé
                </Link>
              </div>
            </section>
          </div>
        </div>
      </>
    );
  }

  const memberMobileActions = useMemo(
    () => [
      { label: "Réserver", helper: "Choisis un créneau", href: "/member/booking" },
      { label: "Notifications", helper: "Alertes coach", href: "/member/notifications" }
    ],
    []
  );

  return (
    <>
      <DashboardNav title="Espace adhérent" subtitle="Suivi personnalisé" links={memberNavLinks} />
      <DashboardLayout
        sidebarTitle="Espace adhérent"
        action={{ label: "Voir le calendrier", href: "/member/calendar" }}
        sections={sections}
        mobileActions={memberMobileActions}
      >
        <Outlet context={contextValue} />
      </DashboardLayout>
    </>
  );
}

function useMemberDashboardContext() {
  return useOutletContext<MemberOutletContext>();
}

function bookingStatusLabel(status: MemberBooking["status"]) {
  if (status === "CONFIRMED") return { label: "Confirmée", color: "#16a34a" };
  if (status === "REFUSED") return { label: "Refusée", color: "#dc2626" };
  return { label: "En attente coach", color: "#f97316" };
}

function slotsOverlap(a: Slot, b: Slot) {
  return new Date(a.startAt) < new Date(b.endAt) && new Date(b.startAt) < new Date(a.endAt);
}

function buildAvailableSlots(availabilities: Slot[], bookedSlots: Slot[]) {
  const open: Slot[] = [];
  const now = Date.now();
  const booked = bookedSlots ?? [];
  for (const availability of availabilities) {
    let pointer = new Date(availability.startAt);
    const end = new Date(availability.endAt);
    while (pointer.getTime() + 60 * 60 * 1000 <= end.getTime()) {
      const slotStart = new Date(pointer);
      const slotEnd = new Date(pointer.getTime() + 60 * 60 * 1000);
      if (slotStart.getTime() < now) {
        pointer = new Date(pointer.getTime() + 60 * 60 * 1000);
        continue;
      }
      const slot = { startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() };
      const isTaken = booked.some((bookedSlot) => slotsOverlap(slot, bookedSlot));
      if (!isTaken) {
        open.push(slot);
      }
      pointer = new Date(pointer.getTime() + 60 * 60 * 1000);
    }
  }
  return open;
}

function packCounters(pack: MemberPackSummary) {
  const total = typeof pack.totalCredits === "number" ? pack.totalCredits : pack.product.creditValue ?? 0;
  const remaining = typeof pack.creditsRemaining === "number" ? pack.creditsRemaining : total;
  return { total, remaining };
}

export function MemberOverviewPage() {
  const { user, featuredUpsell, goToCheckout, quickStats, bookings, packs } = useMemberDashboardContext();
  const upcoming = useMemo(
    () => [...bookings].filter((booking) => new Date(booking.endAt) >= new Date()).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [bookings]
  );
  const activePacks = useMemo(() => packs.filter((pack) => pack.status === "ACTIVE"), [packs]);
  const totalRemainingCredits = useMemo(
    () =>
      activePacks.reduce((total, pack) => {
        const { remaining } = packCounters(pack);
        return total + remaining;
      }, 0),
    [activePacks]
  );
  const shouldRefill = totalRemainingCredits <= 1;
  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Vue d'ensemble</p>
          <h2>Prêt pour ta prochaine performance, {user?.email?.split("@")[0]} ?</h2>
          <p>Synchronise tes séances, suis tes métriques et garde ta motivation au max.</p>
        </div>
        <div className="hero-ctas">
                <Link to="/member/booking" className="btn btn--ghost">
                  Book une séance
                </Link>
          {featuredUpsell && (
            <button className="btn" onClick={() => goToCheckout(featuredUpsell.checkoutUrl)}>
              {featuredUpsell.title}
            </button>
          )}
        </div>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Stats express</div>
        <div className="stat-grid">
          {quickStats.slice(0, 3).map((stat) => (
            <div key={stat.label} className="stat-chip">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
              <p>{stat.helper}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Prochains rendez-vous</div>
        {upcoming.length === 0 && <div style={{ opacity: 0.65 }}>Aucun créneau planifié. Réserve ta prochaine séance pour remplir cette section.</div>}
        <div className="pipeline-list">
          {upcoming.slice(0, 3).map((booking) => {
            const status = bookingStatusLabel(booking.status);
            return (
              <div key={booking.id} className="pipeline-item">
                <div>
                  <strong>{new Date(booking.startAt).toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong>
                  <p>{new Date(booking.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {booking.memberNotes && <p style={{ opacity: 0.75 }}>{booking.memberNotes}</p>}
                </div>
                <span className="focus-tag" style={{ background: status.color, color: "#fff" }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="hero-ctas" style={{ marginTop: 12 }}>
            <Link to="/member/booking" className="btn btn--ghost btn--small">
              Réserver un créneau
            </Link>
          <Link to="/member/calendar" className="btn btn--ghost btn--small">
            Ouvrir le calendrier
          </Link>
        </div>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Mes packs actifs</div>
        {activePacks.length === 0 && (
          <div style={{ opacity: 0.65 }}>
            Aucun pack actif. <Link to="/shop">Visite la boutique</Link> pour activer des heures.
          </div>
        )}
        {activePacks.length > 0 && (
          <div className="pack-grid">
            {activePacks.map((pack) => {
              const { total, remaining } = packCounters(pack);
              return (
                <div key={pack.id} className="pack-card">
                  <div className="pack-card__title">{pack.product.title}</div>
                  <div className="pack-card__hours">
                    <strong>{remaining}</strong>
                    <span>heures restantes</span>
                  </div>
                  <div className="pack-card__meta">{total ? `${total}h au total` : "Crédits illimités"}</div>
                </div>
              );
            })}
          </div>
        )}
        {shouldRefill && (
          <div className="hero-ctas" style={{ marginTop: 16 }}>
            <Link to="/member/offers" className="btn btn--ghost btn--small">
              Recharger via le portail
            </Link>
            <small style={{ fontSize: 12, opacity: 0.75 }}>Plus que {totalRemainingCredits} crédit(s) restant.</small>
          </div>
        )}
      </section>
    </div>
  );
}

export function MemberBookingPage() {
  const { bookings, packs, refreshPacks } = useMemberDashboardContext();
  const upcoming = useMemo(
    () =>
      [...bookings]
        .filter((booking) => new Date(booking.endAt) >= new Date())
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
        .slice(0, 4),
    [bookings]
  );
  const activePacks = useMemo(() => packs.filter((pack) => pack.status === "ACTIVE"), [packs]);
  const totalRemainingCredits = useMemo(
    () => activePacks.reduce((sum, pack) => sum + packCounters(pack).remaining, 0),
    [activePacks]
  );

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Réserver une séance</p>
          <h2>Garde une longueur d'avance sur ton planning</h2>
          <p>Choisis ton créneau, débite le pack adéquat et suis la confirmation du coach directement depuis l'app.</p>
        </div>
        <div className="hero-ctas">
          <Link to="/member/calendar" className="btn btn--ghost btn--small">
            Voir le calendrier complet
          </Link>
          <Link to="/member/offers" className="btn btn--ghost btn--small">
            Recharger mes packs
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Créneaux à venir</div>
        {upcoming.length === 0 && <p style={{ opacity: 0.7 }}>Aucune séance planifiée. Sélectionne un créneau pour lancer une demande.</p>}
        <div className="pipeline-list">
          {upcoming.map((booking) => {
            const status = bookingStatusLabel(booking.status);
            return (
              <div key={booking.id} className="pipeline-item">
                <div>
                  <strong>{formatDateTime(booking.startAt)}</strong>
                  <p>{new Date(booking.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  {booking.memberNotes && <p style={{ opacity: 0.7 }}>{booking.memberNotes}</p>}
                </div>
                <span className="focus-tag" style={{ background: status.color, color: "#fff" }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="hero-ctas" style={{ marginTop: 16 }}>
          <Link to="/member/calendar" className="btn btn--ghost btn--small">
            Ouvrir le calendrier
          </Link>
          <Link to="/member/recaps" className="btn btn--ghost btn--small">
            Voir l'historique
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Packs disponibles</div>
        {activePacks.length === 0 ? (
          <p>
            Aucun pack actif pour le moment. <Link to="/member/offers">Active un pack</Link> pour débloquer la réservation.
          </p>
        ) : (
          <>
            <p style={{ opacity: 0.8 }}>
              <strong>{totalRemainingCredits}</strong> crédit(s) restant(s) sur {activePacks.length} pack(s) actif(s).
            </p>
            <div className="pack-grid">
              {activePacks.slice(0, 3).map((pack) => {
                const { remaining, total } = packCounters(pack);
                return (
                  <div key={pack.id} className="pack-card">
                    <div className="pack-card__title">{pack.product.title}</div>
                    <div className="pack-card__hours">
                      <strong>{remaining}</strong>
                      <span>heures restantes</span>
                    </div>
                    <div className="pack-card__meta">{total ? `${total}h au total` : "Crédits illimités"}</div>
                  </div>
                );
              })}
            </div>
            {activePacks.length > 3 && <small style={{ opacity: 0.7 }}>Liste tronquée. Consulte la page Packs pour le détail complet.</small>}
          </>
        )}
      </section>

      <BookingForm embed packs={packs} refreshPacks={refreshPacks} />
    </div>
  );
}

export function MemberOnboardingPage() {
  const { onboarding, onboardingProgress, updateOnboarding } = useMemberDashboardContext();
  return (
    <div className="dashboard">
      <section className="dashboard-card dashboard-card--accent">
        <div className="dashboard-card__title">Checklist onboarding — {onboardingProgress}%</div>
        {onboarding.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Ton coach prépare ton onboarding personnalisé.</p>
        ) : (
          <div className="pipeline-list">
            {onboarding.map((step) => (
              <div key={step.id} className="pipeline-item">
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                  {step.dueDate && <span style={{ fontSize: 12, opacity: 0.7 }}>Due {new Date(step.dueDate).toLocaleDateString("fr-FR")}</span>}
                </div>
                <div className="pipeline-item__actions">
                  <select value={step.status} onChange={(e) => updateOnboarding(step.id, e.target.value as OnboardingStep["status"])}>
                    <option value="PENDING">À faire</option>
                    <option value="COMPLETED">Terminé</option>
                    <option value="SKIPPED">À replanifier</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function MemberStatsPage() {
  const { quickStats, focusBlocks, timeline } = useMemberDashboardContext();
  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Stats express</div>
        <div className="stat-grid">
          {quickStats.map((stat) => (
            <div key={stat.label} className="stat-chip">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
              <p>{stat.helper}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Focales en cours</div>
        <div className="focus-list">
          {focusBlocks.map((block) => (
            <div key={block.title} className="focus-item">
              <div>
                <strong>{block.title}</strong>
                <p>{block.detail}</p>
              </div>
              <span className="focus-tag">{block.tag}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="dashboard-card dashboard-card--accent">
        <div className="dashboard-card__title">Timeline de la semaine</div>
        <div className="timeline">
          {timeline.map((item) => (
            <div key={item.day} className="timeline-item">
              <div className="timeline-dot" />
              <div>
                <div className="timeline-day">{item.day}</div>
                <strong>{item.title}</strong>
                <p>{item.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function MemberOffersPage() {
  const { upsells, monthly, goToCheckout, packs } = useMemberDashboardContext();
  const [portalOpen, setPortalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<Payment["method"]>("STRIPE");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);
  const offersList = useMemo(() => [...monthly, ...upsells], [monthly, upsells]);
  const totalCredits = useMemo(
    () =>
      packs.reduce((total, pack) => {
        const { remaining } = packCounters(pack);
        return total + remaining;
      }, 0),
    [packs]
  );

  useEffect(() => {
    if (offersList.length === 0) {
      setSelectedProductId("");
      return;
    }
    if (!selectedProductId || !offersList.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(offersList[0].id);
    }
  }, [offersList, selectedProductId]);

  function openPortal(preselectedProductId?: string) {
    if (offersList.length === 0) return;
    setPortalOpen(true);
    setCheckoutError(null);
    setCheckoutStatus(null);
    setPaymentMethod("STRIPE");
    if (preselectedProductId && offersList.some((p) => p.id === preselectedProductId)) {
      setSelectedProductId(preselectedProductId);
    } else if (!selectedProductId) {
      setSelectedProductId(offersList[0].id);
    }
  }

  function closePortal() {
    setPortalOpen(false);
    setCheckoutError(null);
    setCheckoutStatus(null);
    setPaymentMethod("STRIPE");
  }

  async function startCheckout(e: FormEvent) {
    e.preventDefault();
    if (!selectedProductId) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    setCheckoutStatus(null);
    try {
      const checkout = await PaymentApi.checkout({ method: paymentMethod, productId: selectedProductId });
      if (checkout.next?.type === "REDIRECT" && checkout.next.url) {
        setCheckoutStatus("Redirection vers Stripe…");
        window.location.href = checkout.next.url;
      } else if (checkout.next?.type === "IN_APP") {
        setCheckoutStatus(checkout.next.instructions ?? "Paiement enregistré.");
      } else {
        setCheckoutStatus("Paiement enregistré. Recharge en cours…");
      }
    } catch (err: any) {
      setCheckoutError(err?.message ?? "Impossible de démarrer le paiement Stripe.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  const selectedProduct = offersList.find((product) => product.id === selectedProductId) ?? null;

  const activePackCount = useMemo(() => packs.filter((pack) => pack.status === "ACTIVE").length, [packs]);

  return (
    <div className="dashboard">
      <section className="dashboard-card dashboard-card--accent">
        <div className="dashboard-card__title">Portail auto-serve</div>
        <p>Recharge tes packs ici : paye via Stripe ou enregistre un règlement cash que ton coach validera ensuite.</p>
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="stat-chip">
            <div className="stat-value">{totalCredits}</div>
            <div className="stat-label">Crédits disponibles</div>
            <p>{activePackCount > 0 ? `${activePackCount} pack(s) actifs` : "Aucun pack actif"}</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{offersList.length}</div>
            <div className="stat-label">Offres proposées</div>
            <p>{monthly.length ? `${monthly.length} abonnement(s)` : "Packs ponctuels uniquement"}</p>
          </div>
        </div>
        <div className="hero-ctas" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={() => openPortal()} disabled={offersList.length === 0}>
            {offersList.length === 0 ? "Aucune offre disponible" : "Créer un paiement"}
          </button>
          <button className="btn btn--ghost" type="button" onClick={() => openPortal(selectedProductId)} disabled={offersList.length === 0}>
            Choisir un pack
          </button>
        </div>
        {offersList.length === 0 && <small style={{ opacity: 0.7 }}>Demande à ton coach d'activer une offre pour utiliser le portail.</small>}
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Offres disponibles</div>
        {offersList.length === 0 && <div style={{ opacity: 0.6 }}>Aucune offre n'est publiée pour l'instant.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {offersList.map((product) => {
            const isSubscription = product.billingInterval === "MONTHLY";
            return (
              <article
                key={product.id}
                style={{
                  border: "1px solid #f0e7e2",
                  borderRadius: 16,
                  padding: 18,
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)"
                }}
              >
                <div>
                  <span className={`focus-tag ${isSubscription ? "focus-tag--primary" : "focus-tag--ghost"}`} style={{ marginBottom: 8 }}>
                    {isSubscription ? "Abonnement" : "Pack ponctuel"}
                  </span>
                  <h3 style={{ margin: "4px 0" }}>{product.title}</h3>
                  {product.description && <p style={{ opacity: 0.75, margin: 0 }}>{product.description}</p>}
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>
                    {(product.priceCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                  </div>
                  <small style={{ opacity: 0.7 }}>{isSubscription ? "Facturation mensuelle" : "Paiement unique"}</small>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn--ghost btn--small" type="button" disabled={!product.checkoutUrl} onClick={() => goToCheckout(product.checkoutUrl)}>
                    {product.checkoutUrl ? "Payer en ligne" : "Lien absent"}
                  </button>
                  <button className="btn btn--outline btn--small" type="button" onClick={() => openPortal(product.id)}>
                    Enregistrer via le coach
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {portalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="dashboard-card__title">Acheter un pack</div>
            <p>Choisis une offre puis ton mode de règlement (Stripe ou cash auprès du coach).</p>
            {checkoutError && <div style={{ color: "crimson" }}>{checkoutError}</div>}
            {checkoutStatus && <div style={{ color: "#0f9d58" }}>{checkoutStatus}</div>}
            <form className="cms-form" onSubmit={startCheckout}>
              <div className="workout-grid">
                {offersList.map((product) => (
                  <label key={product.id} className={`pack-card pack-card--selectable${selectedProductId === product.id ? " pack-card--active" : ""}`}>
                    <input type="radio" name="product" value={product.id} checked={selectedProductId === product.id} onChange={() => setSelectedProductId(product.id)} />
                    <div>
                      <div className="pack-card__title">{product.title}</div>
                      <div className="pack-card__meta" style={{ opacity: 0.8 }}>
                        {(product.priceCents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                      </div>
                      {product.description && <p style={{ opacity: 0.75 }}>{product.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
              {selectedProduct && (
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  Offre sélectionnée : <strong>{selectedProduct.title}</strong>
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Mode de règlement</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <label className={`pack-card pack-card--selectable${paymentMethod === "STRIPE" ? " pack-card--active" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="radio" name="payment-method" value="STRIPE" checked={paymentMethod === "STRIPE"} onChange={() => setPaymentMethod("STRIPE")} />
                    <div>
                      <div className="pack-card__title">Carte bancaire (Stripe)</div>
                      <p style={{ opacity: 0.7, marginTop: 4 }}>Redirection immédiate vers Stripe pour confirmer ton paiement en ligne.</p>
                    </div>
                  </label>
                  <label className={`pack-card pack-card--selectable${paymentMethod === "CASH" ? " pack-card--active" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="radio" name="payment-method" value="CASH" checked={paymentMethod === "CASH"} onChange={() => setPaymentMethod("CASH")} />
                    <div>
                      <div className="pack-card__title">Paiement cash avec le coach</div>
                      <p style={{ opacity: 0.7, marginTop: 4 }}>Ton coach sera notifié et validera le paiement une fois l'espèce remise.</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="modal-card__actions">
                <button className="btn" type="submit" disabled={checkoutLoading || !selectedProductId}>
                  {paymentMethod === "STRIPE" ? (checkoutLoading ? "Redirection Stripe…" : "Payer via Stripe") : checkoutLoading ? "Enregistrement..." : "Demander un paiement cash"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={closePortal}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberPaymentStatusPage() {
  const { refreshPacks, refreshMemberPayments } = useMemberDashboardContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [syncState, setSyncState] = useState<"loading" | "done" | "error">("loading");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const statusParam = (searchParams.get("status") ?? "").toLowerCase();
  const sessionId = searchParams.get("session_id");
  const isSuccess = statusParam === "success";
  const isCanceled = statusParam === "cancel";
  const statusLabel = isSuccess ? "Succès" : isCanceled ? "Annulé" : "Statut en cours";

  const refreshData = useCallback(async () => {
    setSyncState("loading");
    setSyncError(null);
    try {
      await Promise.all([refreshPacks(), refreshMemberPayments()]);
      if (!mountedRef.current) return;
      setSyncState("done");
      setLastSync(new Date());
    } catch (err: any) {
      if (!mountedRef.current) return;
      setSyncState("error");
      setSyncError(err?.message ?? "Impossible de synchroniser les informations de paiement.");
    }
  }, [refreshMemberPayments, refreshPacks]);

  useEffect(() => {
    mountedRef.current = true;
    refreshData();
    return () => {
      mountedRef.current = false;
    };
  }, [refreshData]);

  const title = isSuccess ? "Paiement confirmé 🎉" : isCanceled ? "Paiement interrompu" : "Retour du checkout Stripe";
  const description = isSuccess
    ? "Nous venons d'être notifiés par Stripe. Tes packs et ton historique seront rafraîchis automatiquement dans quelques secondes."
    : isCanceled
      ? "Tu as quitté le checkout avant de finaliser ton règlement. Tu peux relancer un paiement en toute autonomie depuis le portail d'offres."
      : "Nous vérifions le statut de ton paiement. Si tu viens d'être redirigé depuis Stripe, patiente pendant la synchronisation.";

  function goToDashboard() {
    navigate("/member/overview");
  }

  function goToOffers() {
    navigate("/member/offers");
  }

  function goToPayments() {
    navigate("/member/payments");
  }

  const pillColor = isSuccess ? "rgba(22,163,74,0.15)" : isCanceled ? "rgba(220,38,38,0.15)" : "rgba(15,23,42,0.1)";
  const pillTextColor = isSuccess ? "#16a34a" : isCanceled ? "#dc2626" : "#0f172a";

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">
          {title}
          <span style={{ marginLeft: 12, padding: "4px 10px", borderRadius: 999, background: pillColor, color: pillTextColor, fontSize: 12 }}>{statusLabel}</span>
        </div>
        <p>{description}</p>
        {sessionId && <p style={{ opacity: 0.7, fontSize: 13 }}>Référence Stripe : {sessionId}</p>}
        <div className="hero-ctas" style={{ flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <button className="btn" type="button" onClick={goToDashboard}>
            Retour au dashboard
          </button>
          <button className="btn btn--ghost" type="button" onClick={goToOffers}>
            Voir les offres
          </button>
          <button className="btn btn--ghost" type="button" onClick={goToPayments}>
            Historique paiements
          </button>
        </div>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Synchronisation automatique</div>
        {syncState === "loading" && <p>Mise à jour de tes packs et paiements en cours…</p>}
        {syncState === "done" && (
          <p>
            Données actualisées {lastSync ? `à ${lastSync.toLocaleTimeString("fr-FR")}` : ""}. Si les crédits n&apos;apparaissent pas encore,
            rafraîchis la page ou contacte ton coach.
          </p>
        )}
        {syncState === "error" && <p style={{ color: "crimson" }}>{syncError ?? "Impossible de récupérer les informations mises à jour."}</p>}
        <div className="form-actions">
          <button className="btn btn--ghost" type="button" onClick={refreshData} disabled={syncState === "loading"}>
            {syncState === "loading" ? "Synchronisation..." : "Relancer la synchronisation"}
          </button>
        </div>
      </section>
    </div>
  );
}

export function MemberTimelinePage() {
  const { programTimeline, snapshotData } = useMemberDashboardContext();
  const [phaseDetail, setPhaseDetail] = useState<(typeof programTimeline)[number] | null>(null);
  const [snapshotDetail, setSnapshotDetail] = useState<(typeof snapshotData)[number] | null>(null);

  return (
    <>
      <div className="dashboard">
        <section className="dashboard-card">
          <div className="dashboard-card__title">Timeline programmation</div>
          <div className="timeline-calendar">
            {programTimeline.map((item) => (
              <button
                key={item.phase}
                type="button"
                className="timeline-calendar__item"
                onClick={() => setPhaseDetail(item)}
                style={{ textAlign: "left", cursor: "pointer" }}
              >
                <div className="timeline-calendar__phase">{item.phase}</div>
                <div className="timeline-calendar__weeks">{item.weeks}</div>
                <p>{item.focus}</p>
                <span className="timeline-calendar__status">{item.status}</span>
              </button>
            ))}
          </div>
          <small style={{ display: "block", marginTop: 8, opacity: 0.7 }}>Clique sur un bloc pour voir les objectifs détaillés.</small>
        </section>
        <section className="dashboard-card">
          <div className="dashboard-card__title">Snapshots / benchmarks</div>
          <div className="snapshot-grid">
            {snapshotData.map((snap) => (
              <button key={snap.label} type="button" className="snapshot-card" onClick={() => setSnapshotDetail(snap)} style={{ textAlign: "left" }}>
                <img src={snap.image} alt={snap.label} />
                <div>
                  <strong>{snap.label}</strong>
                  <p style={{ opacity: 0.7, margin: "4px 0" }}>{snap.notes}</p>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Poids: {snap.weight}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Progression: {snap.metric}</div>
                </div>
              </button>
            ))}
          </div>
          <small style={{ display: "block", marginTop: 8, opacity: 0.7 }}>Snapshots, photos et stats détaillées disponibles via le pop-up.</small>
        </section>
      </div>

      {phaseDetail && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--wide">
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Bloc programmation</p>
                <h3>{phaseDetail.phase}</h3>
              </div>
              <button className="modal-close" onClick={() => setPhaseDetail(null)} aria-label="Fermer">
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div className="stat-chip">
                  <div className="stat-value">{phaseDetail.weeks}</div>
                  <div className="stat-label">Période</div>
                  <p>{phaseDetail.status}</p>
                </div>
                <div className="stat-chip">
                  <div className="stat-value">Focus</div>
                  <div className="stat-label">Objectifs clés</div>
                  <p>{phaseDetail.focus}</p>
                </div>
              </div>
              <p style={{ marginTop: 16, opacity: 0.85 }}>
                Utilise ce bloc pour caler tes sessions prioritaires, noter les remontées terrain et ajuster la charge si besoin. Préviens ton coach si tu veux
                modifier l'ordre ou ajouter des séances bonus.
              </p>
            </div>
          </div>
        </div>
      )}

      {snapshotDetail && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--wide">
            <div className="modal-card__header">
              <div>
                <p className="eyebrow">Snapshot</p>
                <h3>{snapshotDetail.label}</h3>
              </div>
              <button className="modal-close" onClick={() => setSnapshotDetail(null)} aria-label="Fermer">
                ×
              </button>
            </div>
            <div className="modal-card__body" style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 2fr", gap: 16 }}>
              <img src={snapshotDetail.image} alt={snapshotDetail.label} style={{ width: "100%", borderRadius: 16, objectFit: "cover" }} />
              <div>
                <p style={{ opacity: 0.8 }}>{snapshotDetail.notes}</p>
                <ul style={{ paddingLeft: 16, lineHeight: 1.6 }}>
                  <li>
                    <strong>Poids :</strong> {snapshotDetail.weight}
                  </li>
                  <li>
                    <strong>Progression :</strong> {snapshotDetail.metric}
                  </li>
                  <li>Ajoute tes sensations ou métriques supplémentaires dans les notes de suivi pour garder une trace.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MemberVideosPage() {
  const { videos, refreshVideos, videosPagination, goToVideoPage } = useMemberDashboardContext();
  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseVideo[]>();
    videos.forEach((video) => {
      const key = video.category || "Autres";
      map.set(key, [...(map.get(key) ?? []), video]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [videos]);

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Bibliothèque vidéo</p>
          <h2>Tutoriels & mouvements clés</h2>
          <p>Accède aux démonstrations envoyées par ton coach, classées par catégorie.</p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={() => refreshVideos()}>
          Actualiser
        </button>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Tes vidéos</div>
        {videos.length === 0 && <div style={{ opacity: 0.65 }}>Ton coach ajoutera bientôt des vidéos d&apos;exercice ici.</div>}
        {grouped.map(([category, entries]) => (
          <div key={category} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>{category}</h4>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{entries.length} vidéo(s)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
              {entries.map((video) => (
                <div key={video.id} className="workout-card" style={{ padding: 0 }}>
                  <VideoPreview url={video.videoUrl} />
                  <div style={{ padding: 16 }}>
                    <strong>{video.title}</strong>
                    {video.description && <p style={{ marginTop: 4, opacity: 0.75 }}>{video.description}</p>}
                    <small style={{ opacity: 0.6 }}>
                      {new Date(video.createdAt).toLocaleDateString("fr-FR")} · {getVideoSourceLabel(video.videoUrl, !!video.fileKey)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {videosPagination && (
          <PaginationControls
            page={videosPagination.page}
            totalPages={videosPagination.totalPages}
            total={videosPagination.total}
            pageSize={videosPagination.pageSize}
            onPageChange={(page) => {
              goToVideoPage(page);
            }}
          />
        )}
      </section>
    </div>
  );
}

function VideoPreview({ url }: { url: string }) {
  const embedUrl = getEmbedUrl(url);
  if (embedUrl) {
    return (
      <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", borderRadius: "12px 12px 0 0", overflow: "hidden" }}>
        <iframe
          src={embedUrl}
          title="Vidéo"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video src={url} controls style={{ width: "100%", borderRadius: "12px 12px 0 0" }}>
      Votre navigateur ne supporte pas la lecture vidéo.
    </video>
  );
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host.includes("youtube") || host.includes("youtu.be")) {
      let videoId = parsed.searchParams.get("v") ?? "";
      if (!videoId && parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1] ?? "";
      }
      if (!videoId && host === "youtu.be") {
        videoId = parsed.pathname.replace("/", "");
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    if (host.includes("vimeo.com")) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        return `https://player.vimeo.com/video/${segments[0]}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function getVideoSourceLabel(url: string, hasFile: boolean) {
  if (hasFile) return "Fichier hébergé";
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return `Lien externe · ${host}`;
  } catch {
    return "Lien externe";
  }
}

type RecapFormState = {
  id?: string;
  sessionDate: string;
  focus: string;
  intensity: string;
  notes: string;
  exercises: Array<
    SessionRecap["exercises"][number] & {
      _id: string;
    }
  >;
};

function makeRecapId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function defaultRecapForm(): RecapFormState {
  return {
    sessionDate: new Date().toISOString().slice(0, 10),
    focus: "Séance perso",
    intensity: "RPE 7",
    notes: "",
    exercises: [{ _id: makeRecapId(), name: "", sets: "3", reps: "10", rest: "", tempo: "", cues: "" }]
  };
}

function recapToFormState(recap: SessionRecap): RecapFormState {
  return {
    id: recap.id,
    sessionDate: recap.sessionDate.slice(0, 10),
    focus: recap.focus ?? "",
    intensity: recap.intensity ?? "",
    notes: recap.notes ?? "",
    exercises: recap.exercises.map((exercise) => ({ ...exercise, _id: makeRecapId() }))
  };
}

function buildRecapShareText(recap: SessionRecap) {
  const header = `Séance du ${new Date(recap.sessionDate).toLocaleDateString("fr-FR")} • ${recap.focus ?? "Focus perso"}`;
  const intensity = recap.intensity ? `Intensité: ${recap.intensity}` : "";
  const notes = recap.notes ? `Notes: ${recap.notes}` : "";
  const exercises = recap.exercises
    .map((exercise, index) => {
      const chunks = [`${index + 1}. ${exercise.name || "Exercice"}`, `${exercise.sets ?? "?"} x ${exercise.reps ?? "?"}`];
      if (exercise.tempo) chunks.push(`tempo ${exercise.tempo}`);
      if (exercise.rest) chunks.push(`repos ${exercise.rest}`);
      if (exercise.cues) chunks.push(exercise.cues);
      return chunks.join(" • ");
    })
    .join("\n");
  return [header, intensity, notes, exercises].filter(Boolean).join("\n");
}

export function MemberRecapsPage() {
  const { sessionRecaps, refreshRecaps, recapsPagination, goToRecapPage } = useMemberDashboardContext();
  const [activeRecap, setActiveRecap] = useState<SessionRecap | null>(null);
  const [formState, setFormState] = useState<RecapFormState>(defaultRecapForm);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const shareText = useMemo(() => (activeRecap ? buildRecapShareText(activeRecap) : ""), [activeRecap]);
  const shareQr = activeRecap ? `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(shareText)}` : null;

  function openCreateForm() {
    setFormState(defaultRecapForm());
    setFormError(null);
    setFormOpen(true);
  }

  function openEditForm(recap: SessionRecap) {
    setFormState(recapToFormState(recap));
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setFormState(defaultRecapForm());
  }

  function updateExerciseField(exerciseId: string, field: keyof SessionRecap["exercises"][number], value: string) {
    setFormState((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => (exercise._id === exerciseId ? { ...exercise, [field]: value } : exercise))
    }));
  }

  function addExerciseRow() {
    setFormState((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { _id: makeRecapId(), name: "", sets: "3", reps: "10", rest: "", tempo: "", cues: "" }]
    }));
  }

  function removeExerciseRow(id: string) {
    setFormState((prev) => ({
      ...prev,
      exercises: prev.exercises.length === 1 ? prev.exercises : prev.exercises.filter((exercise) => exercise._id !== id)
    }));
  }

  async function submitRecap(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      sessionDate: formState.sessionDate,
      focus: formState.focus,
      intensity: formState.intensity,
      notes: formState.notes,
      exercises: formState.exercises.map(({ name, sets, reps, rest, tempo, cues }) => ({
        name,
        sets,
        reps,
        rest,
        tempo,
        cues
      }))
    };
    setSaving(true);
    try {
      if (formState.id) {
        await MemberApi.updateRecap(formState.id, payload);
      } else {
        await MemberApi.createRecap(payload);
      }
      await refreshRecaps();
      closeForm();
    } catch (err: any) {
      setFormError(err?.message ?? "Impossible d'enregistrer le recap.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecap(id: string) {
    if (!window.confirm("Supprimer ce recap personnel ?")) return;
    try {
      await MemberApi.deleteRecap(id);
      await refreshRecaps();
    } catch (err) {
      console.error(err);
    }
  }

  function openShareModal(recap: SessionRecap) {
    setActiveRecap(recap);
  }

  function closeShareModal() {
    setActiveRecap(null);
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Recaps de séance</div>
        <div className="hero-ctas" style={{ marginBottom: 12 }}>
          <button className="btn btn--ghost" type="button" onClick={openCreateForm}>
            + Ajouter un recap perso
          </button>
        </div>
        <div className="pipeline-list">
          {sessionRecaps.map((recap) => (
            <div key={recap.id} className="pipeline-item">
              <div>
                <strong>
                  {recap.focus ?? "Session"} — {new Date(recap.sessionDate).toLocaleDateString("fr-FR")}
                </strong>
                <p style={{ opacity: 0.75 }}>
                  {recap.intensity ?? "RPE ?"}
                  {recap.notes ? ` • ${recap.notes}` : ""}
                </p>
                <ul style={{ margin: "8px 0 0 16px", padding: 0, listStyle: "disc" }}>
                  {recap.exercises.map((exercise, index) => (
                    <li key={`${recap.id}-${index}`} style={{ marginBottom: 4 }}>
                      <strong>{exercise.name}</strong> — {exercise.sets ?? "?"} x {exercise.reps ?? "?"}
                      {exercise.tempo ? ` @${exercise.tempo}` : ""} {exercise.rest ? `• repos ${exercise.rest}` : ""}
                      {exercise.cues ? ` (${exercise.cues})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pipeline-item__actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => openShareModal(recap)}>
                  Détails / partager
                </button>
                {recap.authorRole === "MEMBER" && (
                  <>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => openEditForm(recap)}>
                      Modifier
                    </button>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => deleteRecap(recap.id)}>
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {sessionRecaps.length === 0 && <div style={{ opacity: 0.6 }}>Ton coach partagera les recaps ici après chaque séance.</div>}
        </div>
        {recapsPagination && (
          <PaginationControls
            page={recapsPagination.page}
            totalPages={recapsPagination.totalPages}
            total={recapsPagination.total}
            pageSize={recapsPagination.pageSize}
            onPageChange={(page) => {
              goToRecapPage(page);
            }}
          />
        )}
      </section>

      {formOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="dashboard-card__title">{formState.id ? "Modifier mon recap" : "Nouveau recap personnel"}</div>
            {formError && <div style={{ color: "crimson" }}>{formError}</div>}
            <form className="cms-form" onSubmit={submitRecap}>
              <div className="cms-grid">
                <div>
                  <label>Date</label>
                  <input type="date" value={formState.sessionDate} onChange={(e) => setFormState((prev) => ({ ...prev, sessionDate: e.target.value }))} required />
                </div>
                <div>
                  <label>Focus</label>
                  <input value={formState.focus} onChange={(e) => setFormState((prev) => ({ ...prev, focus: e.target.value }))} placeholder="Force, conditioning..." required />
                </div>
                <div>
                  <label>Intensité</label>
                  <input value={formState.intensity} onChange={(e) => setFormState((prev) => ({ ...prev, intensity: e.target.value }))} placeholder="RPE 8..." />
                </div>
              </div>
              <div>
                <label>Notes</label>
                <textarea value={formState.notes} onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Ressenti, points clés" />
              </div>
              <div className="exercise-list" style={{ marginTop: 12 }}>
                {formState.exercises.map((exercise) => (
                  <div key={exercise._id} className="exercise-row">
                    <input value={exercise.name} onChange={(e) => updateExerciseField(exercise._id, "name", e.target.value)} placeholder="Exercice" required />
                    <input value={exercise.sets ?? ""} onChange={(e) => updateExerciseField(exercise._id, "sets", e.target.value)} placeholder="Séries" />
                    <input value={exercise.reps ?? ""} onChange={(e) => updateExerciseField(exercise._id, "reps", e.target.value)} placeholder="Rép" />
                    <input value={exercise.tempo ?? ""} onChange={(e) => updateExerciseField(exercise._id, "tempo", e.target.value)} placeholder="Tempo" />
                    <input value={exercise.rest ?? ""} onChange={(e) => updateExerciseField(exercise._id, "rest", e.target.value)} placeholder="Repos" />
                    <input value={exercise.cues ?? ""} onChange={(e) => updateExerciseField(exercise._id, "cues", e.target.value)} placeholder="Notes" />
                    <button type="button" className="cms-remove" onClick={() => removeExerciseRow(exercise._id)}>
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn--ghost btn--block" onClick={addExerciseRow}>
                  + Ajouter un exercice
                </button>
              </div>
              <div className="modal-card__actions">
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? "Sauvegarde..." : formState.id ? "Mettre à jour" : "Enregistrer"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={closeForm}>
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeRecap && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="dashboard-card__title">
              {new Date(activeRecap.sessionDate).toLocaleDateString("fr-FR")} — {activeRecap.focus}
            </div>
            <p style={{ opacity: 0.75 }}>
              Intensité: {activeRecap.intensity ?? "N/A"} {activeRecap.notes ? `• ${activeRecap.notes}` : ""}
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {activeRecap.exercises.map((exercise, index) => (
                <li key={`${activeRecap.id}-modal-${index}`} style={{ marginBottom: 6 }}>
                  <strong>{exercise.name}</strong> — {exercise.sets ?? "?"} x {exercise.reps ?? "?"}
                  {exercise.tempo ? ` @${exercise.tempo}` : ""} {exercise.rest ? `• repos ${exercise.rest}` : ""}
                  {exercise.cues ? ` (${exercise.cues})` : ""}
                </li>
              ))}
            </ul>
            <div className="share-actions">
              <button className="btn btn--ghost" type="button" onClick={() => navigator.clipboard.writeText(shareText).catch(() => {})}>
                Copier
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => window.open(`mailto:?subject=Recap%20${encodeURIComponent(activeRecap.focus ?? "")}&body=${encodeURIComponent(shareText)}`, "_self")}>
                Email
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener")}>
                WhatsApp
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => window.open(MemberApi.recapUrl(), "_blank")}>
                PDF complet
              </button>
            </div>
            <textarea value={shareText} readOnly style={{ minHeight: 150 }} />
            {shareQr && <img src={shareQr} alt="QR recap" style={{ alignSelf: "flex-start", borderRadius: 12, border: "1px solid #f0e6e2", padding: 8 }} />}
            <div className="modal-card__actions">
              {activeRecap.authorRole === "MEMBER" && (
                <button className="btn btn--ghost btn--small" type="button" onClick={() => openEditForm(activeRecap)}>
                  Modifier
                </button>
              )}
              <button className="btn btn--outline btn--small" type="button" onClick={closeShareModal}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MemberPaymentsPage() {
  const { payments, paymentsPagination, goToPaymentPage } = useMemberDashboardContext();
  const methodLabels: Record<Payment["method"], string> = {
    STRIPE: "Stripe (CB)",
    CASH: "Cash"
  };
  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Historique paiements</div>
        <div className="pipeline-list">
          {payments.map((payment) => (
            <div key={payment.id} className="pipeline-item">
              <div>
                <strong>{(payment.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: payment.currency || "EUR" })}</strong>
                <p>via {methodLabels[payment.method]}</p>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(payment.createdAt).toLocaleDateString("fr-FR")}</span>
              </div>
              <div className="pipeline-item__actions pipeline-item__actions--column">
                <span className="timeline-calendar__status">{payment.status}</span>
                {payment.status === "PAID" ? (
                  <button className="btn btn--outline" onClick={() => window.open(PaymentApi.receiptUrl(payment.id), "_blank")}>
                    Reçu PDF
                  </button>
                ) : (
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    {payment.method === "CASH" ? "En attente de validation du coach" : "Vérification Stripe en cours"}
                  </span>
                )}
              </div>
            </div>
          ))}
          {payments.length === 0 && <div style={{ opacity: 0.6 }}>Aucun paiement enregistré.</div>}
        </div>
        {paymentsPagination && (
          <PaginationControls
            page={paymentsPagination.page}
            totalPages={paymentsPagination.totalPages}
            total={paymentsPagination.total}
            pageSize={paymentsPagination.pageSize}
            onPageChange={(page) => {
              goToPaymentPage(page);
            }}
          />
        )}
      </section>
    </div>
  );
}

export function MemberProgressPage() {
  const { progress } = useMemberDashboardContext();
  const goals = progress?.goals ?? [];
  const checkIns = progress?.checkIns ?? [];
  const videoNotes = progress?.videoNotes ?? [];
  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Objectifs court terme</div>
        <div className="focus-list">
          {goals.length === 0 && <div style={{ opacity: 0.6 }}>Ton coach définira les objectifs après ton onboarding.</div>}
          {goals.map((goal) => (
            <div key={goal.id} className="focus-item">
              <div>
                <strong>{goal.title}</strong>
                <p>Cible: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString("fr-FR") : "À préciser"}</p>
              </div>
              <span className="focus-tag">{goal.status}</span>
            </div>
          ))}
        </div>
        <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => window.open(MemberApi.recapUrl(), "_blank")}>
          Télécharger mon recap PDF
        </button>
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Check-ins & notes vidéo</div>
        <div className="stat-grid">
          {checkIns.length === 0 && <div style={{ opacity: 0.6 }}>Pas encore de check-in.</div>}
          {checkIns.slice(0, 4).map((check) => (
            <div key={check.id} className="stat-chip">
              <div className="stat-value">{check.value}</div>
              <div className="stat-label">{check.metric}</div>
              <p>
                {new Date(check.createdAt).toLocaleDateString("fr-FR")} · {check.notes ?? "Pas de note"}
              </p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <h4>Notes vidéo</h4>
          <div className="snapshot-grid">
            {videoNotes.length === 0 && <div style={{ opacity: 0.6 }}>Ton coach ajoutera bientôt des analyses vidéo.</div>}
            {videoNotes.map((note) => (
              <a key={note.id} className="snapshot-card" href={note.url} target="_blank" rel="noreferrer">
                <div>
                  <strong>{new Date(note.createdAt).toLocaleDateString("fr-FR")}</strong>
                  <p style={{ opacity: 0.7 }}>{note.description ?? note.url}</p>
                </div>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Ouvrir</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function MemberNotificationsPage() {
  const { notifications, markNotification, deleteNotification } = useMemberDashboardContext();
  const { supported, permission, registering, requestPermission } = usePushNotifications();
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  async function enablePush() {
    try {
      const result = await requestPermission();
      if (result === "granted") {
        setPushMessage("Notifications push activées. Tu recevras une alerte système même si l'app est en arrière-plan.");
      } else if (result === "denied") {
        setPushMessage("Notifications bloquées par le navigateur. Autorise-les depuis les préférences de ton navigateur.");
      } else {
        setPushMessage("Confirme la popup du navigateur pour terminer l'activation.");
      }
    } catch (err: any) {
      setPushMessage(err?.message ?? "Activation impossible pour l'instant.");
    }
  }

  const permissionLabel = supported ? (permission === "granted" ? "Activées" : permission === "denied" ? "Bloquées" : "À activer") : "Non supporté";

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Notifications push web</div>
        <p>Active les notifications système pour recevoir une alerte native dès qu'une nouvelle notification arrive.</p>
        <div className="form-actions">
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Statut : {permissionLabel}</span>
          {supported && permission !== "granted" && (
            <button className="btn btn--ghost btn--small" type="button" onClick={enablePush} disabled={registering}>
              {registering ? "Activation..." : "Activer les notifications"}
            </button>
          )}
        </div>
        {pushMessage && <small style={{ opacity: 0.75 }}>{pushMessage}</small>}
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Notifications</div>
        <div className="pipeline-list">
          {notifications.map((notif) => (
            <div key={notif.id} className="pipeline-item">
              <div>
                <strong>{notif.title}</strong>
                <p>{notif.body}</p>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{new Date(notif.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="pipeline-item__actions">
                <select value={notif.status} onChange={(e) => markNotification(notif.id, e.target.value as Notification["status"])}>
                  <option value="UNREAD">Non lu</option>
                  <option value="READ">Lu</option>
                </select>
                <button className="btn btn--outline" onClick={() => deleteNotification(notif.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          {notifications.length === 0 && <div style={{ opacity: 0.6 }}>Pas de notifications.</div>}
        </div>
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function MemberCalendarPage() {
  const { bookings: defaultBookings, packs, refreshPacks } = useMemberDashboardContext();
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberBooking["status"]>("ALL");
  const [packFilter, setPackFilter] = useState("ALL");
  const [calendarBookings, setCalendarBookings] = useState<MemberBooking[]>(defaultBookings);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [listModal, setListModal] = useState<"upcoming" | "past" | null>(null);
  const [selectedCalendarBooking, setSelectedCalendarBooking] = useState<MemberBooking | null>(null);
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<Slot[]>([]);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [preselectedSlot, setPreselectedSlot] = useState<Slot | null>(null);

  const canBook = useMemo(() => packs.some((pack) => pack.status === "ACTIVE" && packCounters(pack).remaining > 0), [packs]);

  useEffect(() => {
    setCalendarBookings(defaultBookings);
  }, [defaultBookings]);

  const fetchBookings = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setCalendarLoading(true);
        setCalendarError(null);
      }
      try {
        const list = await MemberApi.bookings({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          productId: packFilter === "ALL" ? undefined : packFilter === "NONE" ? "none" : packFilter
        });
        setCalendarBookings(list);
      } catch (err: any) {
        if (!opts?.silent) setCalendarError(err?.message ?? "Impossible de charger les réservations.");
      } finally {
        if (!opts?.silent) setCalendarLoading(false);
      }
    },
    [statusFilter, packFilter]
  );

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings({ silent: true });
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const refreshAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const data = await PublicApi.availability();
      setAvailabilitySlots(buildAvailableSlots(data.availabilities, data.bookedSlots));
    } catch (err: any) {
      setAvailabilityError(err?.message ?? "Impossible de charger les créneaux disponibles.");
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAvailability();
  }, [refreshAvailability]);

  useEffect(() => {
    if (!calendarNotice) return;
    const timer = setTimeout(() => setCalendarNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [calendarNotice]);

  const packOptions = useMemo(() => {
    const options = new Map<string, string>();
    defaultBookings.forEach((booking) => {
      const product = booking.pack?.product;
      if (product?.id) {
        options.set(product.id, product.title ?? "Pack");
      }
    });
    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [defaultBookings]);

  const hasUnassignedPack = defaultBookings.some((booking) => !booking.pack?.product?.id);

  const sorted = useMemo(() => [...calendarBookings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [calendarBookings]);
  const upcoming = sorted.filter((booking) => new Date(booking.endAt) >= new Date());
  const past = sorted.filter((booking) => new Date(booking.endAt) < new Date());
  const calendarBookingMap = useMemo(() => new Map(calendarBookings.map((booking) => [booking.id, booking])), [calendarBookings]);

  const calendarEvents: CalendarGridEvent[] = useMemo(() => {
    const bookingEvents = calendarBookings.map((booking) => {
      if (booking.event) {
        return {
          id: booking.event.id,
          startAt: booking.event.startAt,
          endAt: booking.event.endAt,
          title: booking.event.title,
          subtitle: booking.event.subtitle,
          status: booking.event.status,
          statusLabel: booking.event.statusLabel,
          color: booking.event.color,
          background: booking.event.background,
          tooltip: booking.event.tooltip
        };
      }
      return {
        id: booking.id,
        startAt: booking.startAt,
        endAt: booking.endAt,
        title: booking.pack?.product?.title ?? "Séance coaching",
        status: booking.status
      };
    });
    const limitedSlots = availabilitySlots.slice(0, 60);
    const availableEvents = limitedSlots.map((slot) => ({
      id: `slot-${slot.startAt}`,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status: "AVAILABLE",
      statusLabel: memberCalendarStatusStyles.AVAILABLE.label,
      title: "Réserver",
      subtitle: new Date(slot.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      color: memberCalendarStatusStyles.AVAILABLE.color,
      background: memberCalendarStatusStyles.AVAILABLE.background,
      tooltip: `Créneau disponible — ${new Date(slot.startAt).toLocaleString("fr-FR")}`
    }));
    return [...bookingEvents, ...availableEvents];
  }, [calendarBookings, availabilitySlots]);

  const statusChip = (status: MemberBooking["status"]) => {
    const map: Record<MemberBooking["status"], string> = { PENDING: "#f97316", CONFIRMED: "#16a34a", REFUSED: "#dc2626" };
    return (
      <span style={{ padding: "4px 10px", borderRadius: 999, background: map[status], color: "#fff", fontSize: 12, textTransform: "uppercase" }}>
        {status === "PENDING" ? "En attente" : status === "CONFIRMED" ? "Confirmée" : "Refusée"}
      </span>
    );
  };

  const BookingList = ({ items }: { items: MemberBooking[] }) => {
    if (items.length === 0) return <div style={{ opacity: 0.6 }}>Aucun créneau.</div>;
    return (
      <div className="pipeline-list">
        {items.map((booking) => (
          <div key={booking.id} className="pipeline-item">
            <div>
              <strong>{formatDateTime(booking.startAt)}</strong>
              <p style={{ margin: "4px 0" }}>→ {new Date(booking.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
              {booking.memberNotes && <p style={{ opacity: 0.75 }}>{booking.memberNotes}</p>}
              {booking.pack?.product?.title && <p style={{ fontSize: 12, opacity: 0.7 }}>Pack: {booking.pack.product.title}</p>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {statusChip(booking.status)}
              {booking.status === "PENDING" && <small style={{ opacity: 0.7 }}>En attente de validation par le coach.</small>}
              {booking.status === "REFUSED" && <small style={{ opacity: 0.7 }}>Paiement remboursé automatiquement.</small>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const nextBooking = upcoming[0];
  const lastBooking = past[past.length - 1];
  const activePacks = useMemo(() => packs.filter((pack) => pack.status === "ACTIVE"), [packs]);
  const totalRemainingHours = useMemo(
    () => activePacks.reduce((sum, pack) => sum + packCounters(pack).remaining, 0),
    [activePacks]
  );

  const handleBookingSuccess = useCallback(async () => {
    await fetchBookings({ silent: true });
    await refreshAvailability();
    await refreshPacks();
    setBookingModalOpen(false);
    setPreselectedSlot(null);
  }, [fetchBookings, refreshAvailability, refreshPacks]);

  function openBookingModal(slot?: Slot) {
    if (!canBook) {
      setCalendarNotice("Active ou recharge un pack pour réserver un créneau.");
      return;
    }
    if (slot) {
      setPreselectedSlot(slot);
    } else {
      setPreselectedSlot(null);
    }
    setBookingModalOpen(true);
  }

  function handleBookingClose() {
    setBookingModalOpen(false);
    setPreselectedSlot(null);
  }

  function openListModal(type: "upcoming" | "past") {
    setListModal(type);
  }


  return (
    <>
      <div className="dashboard">
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Agenda</p>
            <h2>Visualise tes réservations</h2>
            <p>Les créneaux payés passent en « En attente ». Dès validation du coach, ils basculent en « Confirmée ».</p>
          </div>
          <div className="hero-ctas">
            <button type="button" className="btn" onClick={() => openBookingModal()} disabled={!canBook}>
              Réserver un créneau
            </button>
            {!canBook && <small style={{ color: "#dc2626" }}>Active ou recharge un pack pour réserver.</small>}
          </div>
        </section>

        <section className="dashboard-card calendar-summary">
          <div className="calendar-summary__item">
            <p className="eyebrow">Prochain rendez-vous</p>
            <strong>{nextBooking ? formatDateTime(nextBooking.startAt) : "Pas encore planifié"}</strong>
            {nextBooking && (
              <span className="calendar-summary__badge" style={{ background: memberCalendarStatusStyles[nextBooking.status].background, color: memberCalendarStatusStyles[nextBooking.status].color }}>
                {memberCalendarStatusStyles[nextBooking.status].label}
              </span>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => openListModal("upcoming")} disabled={upcoming.length === 0}>
              {upcoming.length === 0 ? "Aucune séance" : "Voir les détails"}
            </button>
          </div>
          <div className="calendar-summary__item">
            <p className="eyebrow">Historique</p>
            <strong>{past.length} créneau{past.length > 1 ? "x" : ""}</strong>
            {lastBooking && <small style={{ opacity: 0.7 }}>Dernière séance : {formatDateTime(lastBooking.startAt)}</small>}
            <button className="btn btn--ghost btn--small" onClick={() => openListModal("past")} disabled={past.length === 0}>
              {past.length === 0 ? "Pas d'historique" : "Consulter"}
            </button>
          </div>
          <div className="calendar-summary__item">
            <p className="eyebrow">Heures restantes</p>
            <strong>{totalRemainingHours}h</strong>
            {activePacks[0] ? (
              <small style={{ opacity: 0.7 }}>{activePacks[0].product.title}</small>
            ) : (
              <small style={{ opacity: 0.7 }}>Aucun pack actif</small>
            )}
            <Link className="btn btn--ghost btn--small" to="/shop">
              Acheter un pack
            </Link>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="filter-bar calendar-filter">
            <label>
              Statut
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as MemberBooking["status"] | "ALL")}>
                <option value="ALL">Tous</option>
                <option value="PENDING">En attente</option>
                <option value="CONFIRMED">Confirmé</option>
                <option value="REFUSED">Refusé</option>
              </select>
            </label>
            <label>
              Pack
              <select value={packFilter} onChange={(e) => setPackFilter(e.target.value)}>
                <option value="ALL">Tous</option>
                {packOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
                {hasUnassignedPack && <option value="NONE">Sans pack</option>}
              </select>
            </label>
            <div className="calendar-filter__status">
              {calendarLoading && <small style={{ opacity: 0.7 }}>Chargement des réservations...</small>}
              {calendarError && <small style={{ color: "crimson" }}>{calendarError}</small>}
              {calendarNotice && <small style={{ color: "#b45309" }}>{calendarNotice}</small>}
              {!calendarLoading && !calendarError && <small>{calendarBookings.length} créneau(x) affiché(s)</small>}
              {availabilityLoading && <small style={{ opacity: 0.7 }}>Mise à jour des créneaux libres...</small>}
              {availabilityError && <small style={{ color: "crimson" }}>{availabilityError}</small>}
            </div>
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card__title">Vue calendrier</div>
          <CalendarGrid events={calendarEvents} statusStyles={memberCalendarStatusStyles} emptyLabel="Réserve ta première séance pour remplir le calendrier." onEventClick={handleCalendarEventClick} />
        </section>
      </div>

      {selectedCalendarBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="dashboard-card__title">Détails de la séance</div>
            <p style={{ fontWeight: 600, fontSize: "1rem" }}>{formatDateTime(selectedCalendarBooking.startAt)}</p>
            <p>Fin: {new Date(selectedCalendarBooking.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
            {selectedCalendarBooking.event?.statusLabel ? (
              <span className="focus-tag" style={{ background: selectedCalendarBooking.event.background ?? "#ececec", color: selectedCalendarBooking.event.color ?? "#0f172a" }}>
                {selectedCalendarBooking.event.statusLabel}
              </span>
            ) : (
              <span className="focus-tag" style={{ background: memberCalendarStatusStyles[selectedCalendarBooking.status].background, color: memberCalendarStatusStyles[selectedCalendarBooking.status].color }}>
                {memberCalendarStatusStyles[selectedCalendarBooking.status].label}
              </span>
            )}
            {selectedCalendarBooking.pack?.product?.title && <p>Pack: {selectedCalendarBooking.pack.product.title}</p>}
            {selectedCalendarBooking.memberNotes && <p>Notes: {selectedCalendarBooking.memberNotes}</p>}
            <div className="modal-card__actions">
              <button className="btn btn--outline btn--small" type="button" onClick={() => setSelectedCalendarBooking(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {bookingModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--wide">
            <div className="modal-card__header">
              <h3>Réserver un créneau</h3>
              <button className="modal-close" onClick={handleBookingClose} aria-label="Fermer">
                ×
              </button>
            </div>
            <BookingForm
              embed
              packs={packs}
              refreshPacks={refreshPacks}
              initialSlot={preselectedSlot}
              onBooking={handleBookingSuccess}
            />
          </div>
        </div>
      )}

      {listModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card modal-card--wide">
            <div className="modal-card__header">
              <h3>{listModal === "upcoming" ? "Séances planifiées" : "Historique des séances"}</h3>
              <button className="modal-close" onClick={() => setListModal(null)} aria-label="Fermer">
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <BookingList items={listModal === "upcoming" ? upcoming : past} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MemberSettingsPage() {
  const [form, setForm] = useState({
    email: "",
    fullName: "",
    goal: "",
    level: "",
    age: "",
    heightCm: "",
    weightKg: "",
    preferredTraining: "",
    limitations: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    MemberApi.profile()
      .then((profile) => {
        setForm({
          email: profile.email ?? "",
          fullName: profile.fullName ?? "",
          goal: profile.goal ?? "",
          level: profile.level ?? "",
          age: profile.age ? String(profile.age) : "",
          heightCm: profile.heightCm ? String(profile.heightCm) : "",
          weightKg: profile.weightKg ? String(profile.weightKg) : "",
          preferredTraining: profile.preferredTraining ?? "",
          limitations: profile.limitations ?? ""
        });
      })
      .catch(() => {
        setStatus({ tone: "error", message: "Impossible de charger le profil." });
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        email: form.email,
        fullName: form.fullName || undefined,
        goal: form.goal || undefined,
        level: form.level || undefined,
        age: form.age ? Number(form.age) : null,
        heightCm: form.heightCm ? Number(form.heightCm) : null,
        weightKg: form.weightKg ? Number(form.weightKg) : null,
        preferredTraining: form.preferredTraining || null,
        limitations: form.limitations || null
      };
      const updated = await MemberApi.updateProfile(payload);
      setForm({
        email: updated.email ?? "",
        fullName: updated.fullName ?? "",
        goal: updated.goal ?? "",
        level: updated.level ?? "",
        age: updated.age ? String(updated.age) : "",
        heightCm: updated.heightCm ? String(updated.heightCm) : "",
        weightKg: updated.weightKg ? String(updated.weightKg) : "",
        preferredTraining: updated.preferredTraining ?? "",
        limitations: updated.limitations ?? ""
      });
      setStatus({ tone: "success", message: "Profil mis à jour." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Erreur pendant la sauvegarde." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <section className="dashboard-card">
          <p>Chargement du profil...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Paramètres du profil</div>
        {status && (
          <div style={{ marginBottom: 12, color: status.tone === "error" ? "crimson" : "#0f9d58", fontWeight: 600 }}>{status.message}</div>
        )}
        <form className="cms-form" onSubmit={submit}>
          <div className="cms-grid">
            <div>
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} required />
              <label>Nom complet</label>
              <input value={form.fullName} onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="Alex Client" />
              <label>Objectif</label>
              <input value={form.goal} onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))} placeholder="Recomposition, PR..." />
            </div>
            <div>
              <label>Niveau</label>
              <select value={form.level} onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value }))}>
                <option value="">Choisir</option>
                <option value="Débutant">Débutant</option>
                <option value="Intermédiaire">Intermédiaire</option>
                <option value="Avancé">Avancé</option>
              </select>
              <label>Âge</label>
              <input type="number" min="0" value={form.age} onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))} />
              <label>Taille (cm)</label>
              <input type="number" min="0" value={form.heightCm} onChange={(e) => setForm((prev) => ({ ...prev, heightCm: e.target.value }))} />
              <label>Poids (kg)</label>
              <input type="number" min="0" value={form.weightKg} onChange={(e) => setForm((prev) => ({ ...prev, weightKg: e.target.value }))} />
            </div>
            <div>
              <label>Préférences d'entraînement</label>
              <textarea value={form.preferredTraining} onChange={(e) => setForm((prev) => ({ ...prev, preferredTraining: e.target.value }))} />
              <label>Limitations / blessures</label>
              <textarea value={form.limitations} onChange={(e) => setForm((prev) => ({ ...prev, limitations: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
  function handleCalendarEventClick(event: CalendarGridEvent) {
    if (event.status === "AVAILABLE") {
      const slot = availabilitySlots.find((item) => item.startAt === event.startAt);
      if (slot) {
        openBookingModal(slot);
      } else {
        setCalendarNotice("Créneau indisponible, recharge la page.");
      }
      return;
    }
    const booking = calendarBookingMap.get(event.id);
    if (booking) setSelectedCalendarBooking(booking);
  }
