import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Outlet, useOutletContext } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { DashboardNav, type DashboardNavLink } from "../../components/DashboardNav";
import { PaginationControls } from "../../components/Pagination";
import { CalendarGrid, type CalendarGridEvent } from "../../components/CalendarGrid";
import { useAuthStore, type AuthState } from "../../store/auth.store";
import {
  CoachSiteApi,
  CoachProductApi,
  CoachSettingsApi,
  CoachAvailabilityApi,
  CoachAvailabilityRuleApi,
  CoachBookingApi,
  OnboardingTemplateApi,
  CoachVideoApi,
  type CoachProductPayload,
  type CoachProductUpdatePayload,
  type ContactMessage,
  type MemberSummary,
  type Notification,
  type OnboardingStep,
  type SessionRecap,
  type SessionRecapExercise,
  type CoachProfileSettings,
  type CoachIntegrationSettings,
  type AvailabilitySlot,
  type AvailabilityRule,
  type CoachBooking,
  type CoachOnboardingTemplate,
  type ExerciseVideo
} from "../../api/coach";
import { PaymentApi, type CoachPaymentReport, type Payment } from "../../api/payment";
import type { PaginatedResponse, PaginationMeta } from "../../api/client";
import { type Product } from "../../api/public";
import { usePushNotifications } from "../../hooks/usePushNotifications";

const focusOptions = ["Force", "Hypertrophie", "Conditioning", "Mobilité", "Mindset"];
const intensityOptions = ["RPE 7", "RPE 8", "RPE 9", "Technique"];
const PAYMENT_PAGE_SIZE = 8;
const COACH_RECAPS_PAGE_SIZE = 5;
const COACH_VIDEOS_PAGE_SIZE = 9;
const exerciseLibrary = [
  "Back Squat",
  "Bench Press",
  "Deadlift",
  "Front Squat",
  "Hip Thrust",
  "Military Press",
  "Pull-ups",
  "Rows",
  "Split Squat",
  "Farmer Carry"
];

function randomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

type TemplateStepForm = {
  key: string;
  title: string;
  description: string;
  dueOffsetDays: string;
  autoEmail: boolean;
  autoSms: boolean;
};

type TemplateFormState = {
  title: string;
  description: string;
  steps: TemplateStepForm[];
};

function createTemplateFormState(template?: CoachOnboardingTemplate): TemplateFormState {
  return {
    title: template?.title ?? "",
    description: template?.description ?? "",
    steps:
      template?.steps?.length
        ? template.steps.map((step) => ({
            key: step.id ?? randomId(),
            title: step.title,
            description: step.description ?? "",
            dueOffsetDays:
              step.dueOffsetDays !== null && step.dueOffsetDays !== undefined ? String(step.dueOffsetDays) : "",
            autoEmail: Boolean(step.autoEmail),
            autoSms: Boolean(step.autoSms)
          }))
        : [
            { key: randomId(), title: "Questionnaire détaillé", description: "", dueOffsetDays: "1", autoEmail: false, autoSms: false },
            { key: randomId(), title: "Photos / mesures", description: "", dueOffsetDays: "2", autoEmail: false, autoSms: false }
          ]
  };
}

const coachCalendarStatusStyles = {
  PENDING: { label: "À valider", color: "#f97316", background: "rgba(249,115,22,0.15)" },
  CONFIRMED: { label: "Confirmée", color: "#16a34a", background: "rgba(22,163,74,0.15)" },
  REFUSED: { label: "Refusée", color: "#dc2626", background: "rgba(220,38,38,0.15)" }
};

const weekdayOptions = [
  { value: "0", label: "Lundi" },
  { value: "1", label: "Mardi" },
  { value: "2", label: "Mercredi" },
  { value: "3", label: "Jeudi" },
  { value: "4", label: "Vendredi" },
  { value: "5", label: "Samedi" },
  { value: "6", label: "Dimanche" }
];

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function labelForWeekday(value: number) {
  const option = weekdayOptions.find((opt) => Number(opt.value) === value);
  return option?.label ?? `Jour ${value + 1}`;
}

type RecapForm = {
  memberId: string;
  sessionDate: string;
  focus: string;
  intensity: string;
  notes: string;
  exercises: SessionRecapExercise[];
};

function createDefaultRecapForm(memberId?: string): RecapForm {
  return {
    memberId: memberId ?? "",
    sessionDate: new Date().toISOString().slice(0, 10),
    focus: "Force",
    intensity: "RPE 8",
    notes: "",
    exercises: [
      { name: "Back Squat", sets: "4", reps: "6", rest: "150s", tempo: "31X1" },
      { name: "Split Squat", sets: "3", reps: "10", rest: "90s" }
    ]
  };
}
type CoachOutletContext = {
  user: AuthState["user"];
  members: MemberSummary[];
  onboardingAlerts: OnboardingStep[];
  contactMessages: ContactMessage[];
  notifications: Notification[];
  payments: Payment[];
  paymentsPagination: PaginationMeta | null;
  paymentReport: CoachPaymentReport | null;
  products: Product[];
  createCashPayment: (payload: { memberId: string; amountCents: number; description?: string; notes?: string }) => Promise<void>;
  refreshProducts: () => Promise<void>;
  createProduct: (payload: CoachProductPayload) => Promise<Product>;
  updateProduct: (id: string, payload: CoachProductUpdatePayload) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  refreshPayments: () => Promise<void>;
  goToPaymentPage: (page: number) => Promise<void>;
  updatePaymentStatus: (id: string, status: Payment["status"], notes?: string) => Promise<void>;
  updateContactStatus: (id: string, status: ContactMessage["status"]) => Promise<void>;
  sendNotification: (payload: { title: string; body: string; memberId?: string; audience?: "ALL" }) => Promise<void>;
  updateNotificationStatus: (id: string, status: Notification["status"]) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
};

export function CoachLayout() {
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [onboardingAlerts, setOnboardingAlerts] = useState<OnboardingStep[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [paymentsData, setPaymentsData] = useState<PaginatedResponse<Payment> | null>(null);
  const [paymentReport, setPaymentReport] = useState<CoachPaymentReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const refreshProducts = useCallback(async () => {
    try {
      const list = await CoachProductApi.list();
      setProducts(list);
    } catch {
      // silent fail, UI already handles empty state
    }
  }, []);

  const paymentParamsRef = useRef({ page: 1, pageSize: PAYMENT_PAGE_SIZE });

  const refreshPayments = useCallback(
    async (params?: { page?: number; pageSize?: number }) => {
      const nextParams = {
        page: params?.page ?? paymentParamsRef.current.page,
        pageSize: params?.pageSize ?? paymentParamsRef.current.pageSize
      };
      try {
        const [list, report] = await Promise.all([PaymentApi.coachList(nextParams), PaymentApi.coachReport()]);
        setPaymentsData(list);
        paymentParamsRef.current = { page: list.pagination.page, pageSize: list.pagination.pageSize };
        setPaymentReport(report);
      } catch {
        // ignore
      }
    },
    []
  );

  const goToPaymentPage = useCallback(
    async (page: number) => {
      await refreshPayments({ page });
    },
    [refreshPayments]
  );

  useEffect(() => {
    CoachSiteApi.members().then(setMembers).catch(() => {});
    CoachSiteApi.contactMessages().then(setContactMessages).catch(() => {});
    CoachSiteApi.onboardingAlerts().then(setOnboardingAlerts).catch(() => {});
    CoachSiteApi.notifications().then(setNotifications).catch(() => {});
    refreshProducts();
    refreshPayments();
  }, [refreshPayments, refreshProducts]);

  async function createProduct(payload: CoachProductPayload) {
    const created = await CoachProductApi.create(payload);
    setProducts((prev) => [created, ...prev]);
    return created;
  }

  async function updateProduct(id: string, payload: CoachProductUpdatePayload) {
    const updated = await CoachProductApi.update(id, payload);
    setProducts((prev) => prev.map((product) => (product.id === id ? updated : product)));
    return updated;
  }

  async function deleteProduct(id: string) {
    await CoachProductApi.delete(id);
    setProducts((prev) => prev.filter((product) => product.id !== id));
  }

  async function updatePaymentStatus(id: string, status: Payment["status"], notes?: string) {
    try {
      const updated = await PaymentApi.updateStatus(id, status, notes);
      setPaymentsData((prev) => (prev ? { ...prev, items: prev.items.map((payment) => (payment.id === updated.id ? updated : payment)) } : prev));
      const report = await PaymentApi.coachReport();
      setPaymentReport(report);
    } catch {
      // optional toast could be added later
    }
  }

  async function createCashPayment(payload: { memberId: string; amountCents: number; description?: string; notes?: string }) {
    try {
      await PaymentApi.createCash(payload);
      await refreshPayments({ page: 1 });
    } catch {
      // swallow for now
    }
  }

  async function updateContactStatus(id: string, status: ContactMessage["status"]) {
    try {
      const updated = await CoachSiteApi.updateContactStatus(id, status);
      setContactMessages((prev) => prev.map((message) => (message.id === updated.id ? updated : message)));
    } catch {
      // swallow
    }
  }

  async function sendNotification(payload: { title: string; body: string; memberId?: string; audience?: "ALL" }) {
    try {
      const created: any = await CoachSiteApi.sendNotification(payload);
      if (created?.id) {
        setNotifications((prev) => [created as Notification, ...prev]);
      } else {
        CoachSiteApi.notifications().then(setNotifications).catch(() => {});
      }
    } catch {
      // swallow
    }
  }

  async function updateNotificationStatus(id: string, status: Notification["status"]) {
    try {
      const updated = await CoachSiteApi.updateNotificationStatus(id, status);
      setNotifications((prev) => prev.map((notif) => (notif.id === updated.id ? updated : notif)));
    } catch {
      // swallow
    }
  }

  async function deleteNotification(id: string) {
    try {
      await CoachSiteApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((notif) => notif.id !== id));
    } catch {
      // swallow
    }
  }

  const contextValue: CoachOutletContext = {
    user,
    members,
    onboardingAlerts,
    contactMessages,
    notifications,
    payments: paymentsData?.items ?? [],
    paymentsPagination: paymentsData?.pagination ?? null,
    paymentReport,
    products,
    createCashPayment,
    refreshProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshPayments,
    goToPaymentPage,
    updatePaymentStatus,
    updateContactStatus,
    sendNotification,
    updateNotificationStatus,
    deleteNotification
  };

  const sections = [
    { label: "Vue d'ensemble", to: "/coach/overview", group: "Pilotage" },
    { label: "Workflows onboarding", to: "/coach/workflows", group: "Pilotage" },
    { label: "Offres & packs", to: "/coach/products", group: "Pilotage" },
    { label: "Calendrier & réservations", to: "/coach/calendar", group: "Adhérents" },
    { label: "Fiches adhérents", to: "/coach/members", group: "Adhérents" },
    { label: "Recaps & suivi", to: "/coach/recaps", group: "Adhérents" },
    { label: "Program Builder", to: "/coach/programs", group: "Programmes" },
    { label: "Vidéothèque", to: "/coach/videos", group: "Programmes" },
    { label: "Notifications", to: "/coach/notifications", group: "Programmes" },
    { label: "Inbox prospects", to: "/coach/inbox", group: "Business" },
    { label: "Paiements & cash", to: "/coach/billing", group: "Business" },
    { label: "Paramètres", to: "/coach/settings", group: "Réglages" }
  ];

  const coachNavLinks: DashboardNavLink[] = [
    { label: "Vue d'ensemble", to: "/coach/overview", variant: "menu" },
    { label: "Calendrier", to: "/coach/calendar", variant: "menu" },
    { label: "Members", to: "/coach/members", variant: "menu" },
    { label: "Program Builder", to: "/coach/programs", variant: "menu" },
    { label: "Paiements", to: "/coach/billing", variant: "primary" },
    { label: "Workflows", to: "/coach/workflows", variant: "primary" },
    { label: "Vidéos", to: "/coach/videos", variant: "primary" },
    { label: "Paramètres", to: "/coach/settings", variant: "primary" }
  ];

  const coachMobileActions = useMemo(
    () => [
      { label: "Agenda", helper: "Valider un créneau", href: "/coach/calendar" },
      { label: "Paiement cash", helper: "Enregistrer un encaissement", href: "/coach/billing" }
    ],
    []
  );

  return (
    <>
      <DashboardNav title="Command center coach" subtitle="Pilotage complet" links={coachNavLinks} />
      <DashboardLayout
        sidebarTitle="Command center coach"
        action={{ label: "Voir les adhérents", href: "/coach/members" }}
        sections={sections}
        mobileActions={coachMobileActions}
      >
        <Outlet context={contextValue} />
      </DashboardLayout>
    </>
  );
}

function useCoachDashboardContext() {
  return useOutletContext<CoachOutletContext>();
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function CoachOverviewPage() {
  const { user, members, onboardingAlerts, contactMessages, paymentReport, products } = useCoachDashboardContext();
  const monthly = useMemo(() => products.filter((product) => product.billingInterval === "MONTHLY"), [products]);
  const upsells = useMemo(() => products.filter((product) => product.billingInterval !== "MONTHLY"), [products]);
  const projectedMrr = useMemo(
    () =>
      monthly.reduce((total, product) => {
        const units = product.activeSubscribers && product.activeSubscribers > 0 ? product.activeSubscribers : 1;
        return total + (product.priceCents / 100) * units;
      }, 0),
    [monthly]
  );
  const pipelineAlerts = onboardingAlerts.slice(0, 4);
  const unreadMessages = contactMessages.filter((message) => message.status === "NEW").length;
  const [agenda, setAgenda] = useState<CoachBooking[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoadingAgenda(true);
    CoachBookingApi.list()
      .then((list) => {
        if (!mounted) return;
        setAgenda(list);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoadingAgenda(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const pendingRequests = useMemo(
    () => agenda.filter((booking) => booking.status === "PENDING").sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [agenda]
  );
  const confirmedAgenda = useMemo(
    () => agenda.filter((booking) => booking.status === "CONFIRMED").sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [agenda]
  );

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">Pilotage business</p>
          <h2>Bienvenue coach {user?.email?.split("@")[0]}</h2>
          <p>Visualise la santé de ta box: MRR, onboarding et offres à pousser.</p>
        </div>
        <div className="hero-ctas">
          <Link to="/coach/programs" className="btn btn--ghost">
            Program Builder
          </Link>
          <Link to="/coach/members" className="btn">
            Fiches adhérents
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">KPIs rapides</div>
        <div className="stat-grid">
          <div className="stat-chip">
            <div className="stat-value">{formatCurrency(projectedMrr || paymentReport?.summary.paid || 0)}</div>
            <div className="stat-label">MRR projeté</div>
            <p>basé sur tes abonnements actifs</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{members.length}</div>
            <div className="stat-label">Adhérents actifs</div>
            <p>Membres suivis ce mois</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{unreadMessages}</div>
            <div className="stat-label">Leads à traiter</div>
            <p>via la page contact</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{paymentReport ? formatCurrency(paymentReport.summary.outstanding) : "0 €"}</div>
            <div className="stat-label">Encours / upsell</div>
            <p>paiements à relancer</p>
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Navigation rapide — clients</div>
        <div className="hero-ctas">
          <Link className="btn" to="/coach/members">
            Fiches adhérents
          </Link>
          <Link className="btn btn--ghost" to="/coach/calendar">
            Calendrier & réservations
          </Link>
          <Link className="btn btn--ghost" to="/coach/workflows">
            Workflows onboarding
          </Link>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Demandes de réservation & agenda</div>
        {loadingAgenda && <div style={{ opacity: 0.6 }}>Chargement des créneaux...</div>}
        {!loadingAgenda && pendingRequests.length === 0 && <div style={{ opacity: 0.65 }}>Aucune demande en attente. Partage ton calendrier pour remplir ta semaine.</div>}
        <div className="pipeline-list">
          {pendingRequests.slice(0, 3).map((booking) => (
            <div key={booking.id} className="pipeline-item">
              <div>
                <strong>{new Date(booking.startAt).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</strong>
                <p>{booking.user?.email}</p>
                {booking.memberNotes && <p style={{ opacity: 0.7 }}>{booking.memberNotes}</p>}
              </div>
              <div className="pipeline-item__actions">
                <Link className="btn btn--ghost btn--small" to="/coach/calendar">
                  Confirmer
                </Link>
                {booking.user?.memberProfile?.id && (
                  <Link className="btn btn--outline btn--small" to={`/coach/members?memberId=${booking.user.memberProfile.id}`}>
                    Fiche
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 8 }}>Confirmées</h4>
          {confirmedAgenda.length === 0 && <div style={{ opacity: 0.6 }}>Pas encore de séances confirmées.</div>}
          <div className="focus-list">
            {confirmedAgenda.slice(0, 3).map((booking) => (
              <div key={booking.id} className="focus-item">
                <div>
                  <strong>{new Date(booking.startAt).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" })}</strong>
                  <p>{new Date(booking.startAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="focus-tag">OK</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-card dashboard-card--accent">
        <div className="dashboard-card__title">Pipeline onboarding</div>
        <div className="pipeline-list">
          {pipelineAlerts.map((step) => (
            <div key={step.id} className="pipeline-item">
              <div>
                <strong>{step.fullName ?? "Membre"}</strong>
                <p>{step.title}</p>
                {step.dueDate && <span style={{ fontSize: 12 }}>Due {new Date(step.dueDate).toLocaleDateString("fr-FR")}</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span className="timeline-calendar__status">{step.status}</span>
                {step.memberId && (
                  <Link className="btn btn--ghost btn--small" to={`/coach/members?memberId=${step.memberId}`}>
                    Voir la fiche
                  </Link>
                )}
              </div>
            </div>
          ))}
          {pipelineAlerts.length === 0 && <div style={{ opacity: 0.6 }}>Aucune alerte urgente — tu peux lancer de nouveaux onboardings.</div>}
        </div>
        <Link to="/coach/workflows" className="btn btn--ghost" style={{ marginTop: 12 }}>
          Voir le funnel complet
        </Link>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Upsells & checkouts</div>
        <div className="workout-grid">
          {upsells.length === 0 && <div style={{ opacity: 0.65 }}>Publie tes offres dans le CMS pour les partager ici.</div>}
          {upsells.map((offer) => (
            <div key={offer.id} className="workout-card">
              <div style={{ fontSize: 18, fontWeight: 700 }}>{offer.title}</div>
              <p style={{ opacity: 0.75 }}>{offer.description}</p>
              <div style={{ fontSize: 24, margin: "12px 0" }}>{formatCurrency(offer.priceCents / 100)}</div>
              <button
                className="btn btn--block"
                onClick={() => (offer.checkoutUrl ? window.open(offer.checkoutUrl, "_blank", "noopener") : alert("Lien indisponible"))}
              >
                Partager le checkout
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CoachWorkflowsPage() {
  const { onboardingAlerts } = useCoachDashboardContext();
  const [templates, setTemplates] = useState<CoachOnboardingTemplate[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(() => createTemplateFormState());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const programmingTimeline = [
    { phase: "Bloc actuel", info: "Force / Lower", meta: "Sem. 3 — RPE 8" },
    { phase: "Deload", info: "Recovery + mobilité", meta: "Prévu semaine prochaine" },
    { phase: "Prochain cycle", info: "Hybrid performance", meta: "Créer dans Program Builder" }
  ];

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    setLoadingTemplates(true);
    try {
      const list = await OnboardingTemplateApi.list();
      setTemplates(list);
    } catch {
      // silent: empty state handles errors
    } finally {
      setLoadingTemplates(false);
    }
  }

  function resetTemplateForm(template?: CoachOnboardingTemplate) {
    setTemplateForm(createTemplateFormState(template));
    setEditingTemplateId(template?.id ?? null);
    setTemplateStatus(null);
  }

  function startEdit(template: CoachOnboardingTemplate) {
    setEditingTemplateId(template.id);
    setTemplateForm(createTemplateFormState(template));
    setTemplateStatus(null);
  }

  function updateTemplateField(field: keyof TemplateFormState, value: string) {
    setTemplateForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateStep(stepKey: string, patch: Partial<TemplateStepForm>) {
    setTemplateForm((prev) => ({
      ...prev,
      steps: prev.steps.map((step) => (step.key === stepKey ? { ...step, ...patch } : step))
    }));
  }

  function addStep() {
    setTemplateForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { key: randomId(), title: "Étape personnalisée", description: "", dueOffsetDays: "", autoEmail: false, autoSms: false }
      ]
    }));
  }

  function removeStep(stepKey: string) {
    setTemplateForm((prev) => {
      if (prev.steps.length === 1) {
        return {
          ...prev,
          steps: [{ key: randomId(), title: "", description: "", dueOffsetDays: "", autoEmail: false, autoSms: false }]
        };
      }
      return { ...prev, steps: prev.steps.filter((step) => step.key !== stepKey) };
    });
  }

  async function handleTemplateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!templateForm.title.trim()) {
      setTemplateStatus({ tone: "error", message: "Ajoute un titre à ton template." });
      return;
    }
    const steps = templateForm.steps
      .filter((step) => step.title.trim().length > 0)
      .map((step) => ({
        title: step.title.trim(),
        description: step.description.trim() ? step.description.trim() : undefined,
        dueOffsetDays: step.dueOffsetDays ? Number(step.dueOffsetDays) : null,
        autoEmail: step.autoEmail,
        autoSms: step.autoSms
      }));
    if (steps.length === 0) {
      setTemplateStatus({ tone: "error", message: "Ajoute au moins une étape." });
      return;
    }
    setTemplateStatus(null);
    try {
      let saved: CoachOnboardingTemplate;
      if (editingTemplateId) {
        saved = await OnboardingTemplateApi.update(editingTemplateId, {
          title: templateForm.title.trim(),
          description: templateForm.description.trim() || undefined,
          steps
        });
        setTemplates((prev) => prev.map((tpl) => (tpl.id === saved.id ? saved : tpl)));
        setTemplateStatus({ tone: "success", message: "Template mis à jour." });
      } else {
        saved = await OnboardingTemplateApi.create({
          title: templateForm.title.trim(),
          description: templateForm.description.trim() || undefined,
          steps
        });
        setTemplates((prev) => [saved, ...prev]);
        setTemplateStatus({ tone: "success", message: "Template publié." });
      }
      setEditingTemplateId(saved.id);
      setTemplateForm(createTemplateFormState(saved));
    } catch (err: any) {
      setTemplateStatus({ tone: "error", message: err?.message ?? "Impossible d'enregistrer le template." });
    }
  }

  async function handleTemplateDelete(template: CoachOnboardingTemplate) {
    if (!window.confirm(`Supprimer ${template.title} ?`)) return;
    try {
      await OnboardingTemplateApi.remove(template.id);
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== template.id));
      if (editingTemplateId === template.id) {
        resetTemplateForm();
      }
      setTemplateStatus({ tone: "success", message: "Template supprimé." });
    } catch (err: any) {
      setTemplateStatus({ tone: "error", message: err?.message ?? "Suppression impossible." });
    }
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Templates onboarding</div>
        {templateStatus && (
          <div className={`program-builder__status program-builder__status--${templateStatus.tone}`}>{templateStatus.message}</div>
        )}
        <div className="template-manager">
          <div className="template-list">
            {loadingTemplates && <div className="program-library__empty">Chargement...</div>}
            {!loadingTemplates && templates.length === 0 && (
              <div className="program-library__empty">Crée ton premier template pour automatiser l&apos;onboarding.</div>
            )}
            {templates.map((template) => (
              <div
                key={template.id}
                className={`template-list__item${editingTemplateId === template.id ? " template-list__item--active" : ""}`}
                onClick={() => startEdit(template)}
              >
                <div>
                  <strong>{template.title}</strong>
                  <p>{template.description ?? "Sans description"}</p>
                  <small>{template.steps.length} étape{template.steps.length > 1 ? "s" : ""}</small>
                </div>
                <div className="template-list__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(template);
                    }}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateDelete(template);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form className="cms-form template-form" onSubmit={handleTemplateSubmit}>
            <input placeholder="Titre du template" value={templateForm.title} onChange={(e) => updateTemplateField("title", e.target.value)} />
            <textarea placeholder="Description" value={templateForm.description} onChange={(e) => updateTemplateField("description", e.target.value)} />
            <div className="template-steps">
              {templateForm.steps.map((step, index) => (
                <div key={step.key} className="template-step">
                  <div className="template-step__header">
                    <strong>Étape {index + 1}</strong>
                    <button type="button" className="btn btn--outline btn--small" onClick={() => removeStep(step.key)}>
                      Supprimer
                    </button>
                  </div>
                  <input placeholder="Titre" value={step.title} onChange={(e) => updateStep(step.key, { title: e.target.value })} />
                  <textarea
                    placeholder="Description"
                    value={step.description}
                    onChange={(e) => updateStep(step.key, { description: e.target.value })}
                  />
                  <div className="template-step__grid">
                    <label>
                      <span>Délais (jours)</span>
                      <input
                        type="number"
                        min="0"
                        value={step.dueOffsetDays}
                        onChange={(e) => updateStep(step.key, { dueOffsetDays: e.target.value })}
                      />
                    </label>
                    <label className="template-step__toggle">
                      <input type="checkbox" checked={step.autoEmail} onChange={(e) => updateStep(step.key, { autoEmail: e.target.checked })} />
                      Email auto
                    </label>
                    <label className="template-step__toggle">
                      <input type="checkbox" checked={step.autoSms} onChange={(e) => updateStep(step.key, { autoSms: e.target.checked })} />
                      SMS
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn--ghost btn--small" onClick={addStep}>
                + Ajouter une étape
              </button>
              <span style={{ flex: 1 }} />
              {editingTemplateId && (
                <button type="button" className="btn btn--outline btn--small" onClick={() => resetTemplateForm()}>
                  Nouveau template
                </button>
              )}
              <button className="btn" type="submit">
                {editingTemplateId ? "Mettre à jour" : "Publier"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Checklist à relancer</div>
        <div className="pipeline-list">
          {onboardingAlerts.map((alert) => (
            <div key={alert.id} className="pipeline-item">
              <div>
                <strong>{alert.fullName ?? alert.memberId}</strong>
                <p>{alert.title}</p>
                {alert.dueDate && <small>Due {new Date(alert.dueDate).toLocaleDateString("fr-FR")}</small>}
              </div>
              <Link className="btn btn--ghost btn--small" to="/coach/members">
                Ouvrir la fiche
              </Link>
            </div>
          ))}
          {onboardingAlerts.length === 0 && <div style={{ opacity: 0.6 }}>Ton funnel est à jour 🎯.</div>}
        </div>
      </section>

      <section className="dashboard-card dashboard-card--accent">
        <div className="dashboard-card__title">Programming timeline</div>
        <div className="timeline-calendar">
          {programmingTimeline.map((item) => (
            <div key={item.phase} className="timeline-calendar__item">
              <div className="timeline-calendar__phase">{item.phase}</div>
              <div className="timeline-calendar__weeks">{item.info}</div>
              <p>{item.meta}</p>
              <Link to="/coach/programs" className="timeline-calendar__status">
                Editer
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CoachNotificationsPage() {
  const { notifications, members, sendNotification, updateNotificationStatus, deleteNotification } = useCoachDashboardContext();
  const { supported, permission, registering, requestPermission } = usePushNotifications();
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", target: "ALL" as "ALL" | string });
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.title || !form.body) return;
    setSending(true);
    const payload =
      form.target === "ALL"
        ? { title: form.title, body: form.body, audience: "ALL" as const }
        : { title: form.title, body: form.body, memberId: form.target };
    await sendNotification(payload);
    setForm({ title: "", body: "", target: "ALL" });
    setSending(false);
  }

  async function enablePush() {
    try {
      const result = await requestPermission();
      if (result === "granted") {
        setPushMessage("Notifications push activées. Tu recevras une alerte système dès qu'un membre réagit.");
      } else if (result === "denied") {
        setPushMessage("Notifications bloquées par ton navigateur.");
      } else {
        setPushMessage("Confirme la fenêtre du navigateur pour terminer l'activation.");
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
        <p>Reçois une notification système (Windows, macOS, mobile) dès qu'un adhérent t'envoie un message ou reçoit un recap.</p>
        <div className="form-actions">
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Statut : {permissionLabel}</span>
          {supported && permission !== "granted" && (
            <button className="btn btn--ghost btn--small" type="button" onClick={enablePush} disabled={registering}>
              {registering ? "Activation..." : "Activer"}
            </button>
          )}
        </div>
        {pushMessage && <small style={{ opacity: 0.75 }}>{pushMessage}</small>}
      </section>
      <section className="dashboard-card">
        <div className="dashboard-card__title">Envoyer une notification</div>
        <form className="cms-form" onSubmit={submit}>
          <input placeholder="Titre" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
          <textarea placeholder="Message" value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} />
          <select value={form.target} onChange={(e) => setForm((prev) => ({ ...prev, target: e.target.value }))}>
            <option value="ALL">Tous les adhérents</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName ?? member.user?.email ?? "Membre"} {member.goal ? `• ${member.goal}` : ""}
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={sending}>
            {sending ? "Envoi..." : "Diffuser la notif"}
          </button>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Historique notifications</div>
        <div className="pipeline-list">
          {notifications.map((notif) => (
            <div key={notif.id} className="pipeline-item">
              <div>
                <strong>{notif.title}</strong>
                <p>{notif.body}</p>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {notif.member?.fullName ?? notif.member?.user?.email ?? "Broadcast"} · {new Date(notif.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="pipeline-item__actions">
                <select value={notif.status} onChange={(e) => updateNotificationStatus(notif.id, e.target.value as Notification["status"])}>
                  <option value="UNREAD">Non lu</option>
                  <option value="READ">Lu</option>
                </select>
                <button className="btn btn--outline" onClick={() => deleteNotification(notif.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
          {notifications.length === 0 && <div style={{ opacity: 0.6 }}>Aucune notification envoyée.</div>}
        </div>
      </section>
    </div>
  );
}

type ProductFormState = {
  title: string;
  description: string;
  price: string;
  billingInterval: string;
  checkoutUrl: string;
  isActive: boolean;
  creditHours: string;
};

const billingIntervalOptions = [
  { value: "ONE_TIME", label: "Pack ponctuel" },
  { value: "MONTHLY", label: "Abonnement mensuel" },
  { value: "QUARTERLY", label: "Trimestriel" }
];

function createProductFormState(product?: Product): ProductFormState {
  return {
    title: product?.title ?? "",
    description: product?.description ?? "",
    price: product ? formatPriceInput(product.priceCents) : "",
    billingInterval: product?.billingInterval ?? "ONE_TIME",
    checkoutUrl: product?.checkoutUrl ?? "",
    isActive: product?.isActive ?? true,
    creditHours: product?.creditValue ? String(product.creditValue) : ""
  };
}

function formatPriceInput(priceCents: number) {
  const euros = priceCents / 100;
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
}

function parsePriceToCents(value: string) {
  if (!value) return 0;
  const normalized = value.replace(",", ".").trim();
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export function CoachProductsPage() {
  const { products, refreshProducts, createProduct, updateProduct, deleteProduct } = useCoachDashboardContext();
  const [form, setForm] = useState<ProductFormState>(() => createProductFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionProductId, setActionProductId] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setForm(createProductFormState());
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm(createProductFormState(product));
    setStatus(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    const priceCents = parsePriceToCents(form.price);
    const creditValue = Number(form.creditHours);
    if (!form.title.trim() || priceCents <= 0) {
      setStatus({ tone: "error", message: "Ajoute un titre et un prix valide." });
      return;
    }
    if (!Number.isFinite(creditValue) || creditValue <= 0) {
      setStatus({ tone: "error", message: "Définis le nombre d'heures incluses dans ce pack." });
      return;
    }
    setSubmitting(true);
    const payload: CoachProductPayload = {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : undefined,
      priceCents,
      billingInterval: form.billingInterval || "ONE_TIME",
      checkoutUrl: form.checkoutUrl.trim() ? form.checkoutUrl.trim() : undefined,
      isActive: form.isActive,
      creditValue: Math.round(creditValue)
    };
    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        setStatus({ tone: "success", message: "Pack mis à jour." });
      } else {
        await createProduct(payload);
        setStatus({ tone: "success", message: "Pack publié." });
      }
      resetForm();
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Erreur lors de l'enregistrement." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Supprimer ${product.title} ?`)) return;
    setActionProductId(product.id);
    setStatus(null);
    try {
      await deleteProduct(product.id);
      if (editingId === product.id) resetForm();
      setStatus({ tone: "success", message: "Offre supprimée." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Suppression impossible." });
    } finally {
      setActionProductId(null);
    }
  }

  async function toggleActive(product: Product) {
    setActionProductId(product.id);
    setStatus(null);
    try {
      await updateProduct(product.id, { isActive: !product.isActive });
      setStatus({ tone: "success", message: product.isActive ? "Offre mise en pause." : "Offre activée." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible de mettre à jour le statut." });
    } finally {
      setActionProductId(null);
    }
  }

  function cancelEdit() {
    resetForm();
    setStatus(null);
  }

  const hasProducts = products.length > 0;

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">{editingId ? "Mettre à jour une offre" : "Créer une nouvelle offre"}</div>
        {status && (
          <div style={{ color: status.tone === "error" ? "crimson" : "#0f9d58", marginBottom: 12, fontWeight: 600 }}>{status.message}</div>
        )}
        {editingId && (
          <div className="form-hint" style={{ marginBottom: 12 }}>
            Edition en cours • {form.title || "Sans titre"}
            <button type="button" className="btn btn--ghost btn--small" style={{ marginLeft: 12 }} onClick={cancelEdit}>
              Annuler
            </button>
          </div>
        )}
        <form className="cms-form" onSubmit={handleSubmit}>
          <div className="cms-grid">
            <div>
              <label>Titre</label>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Pack Performance" required />
              <label>Prix (en €)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="149"
                required
              />
              <label>Heures incluses</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.creditHours}
                onChange={(e) => setForm((prev) => ({ ...prev, creditHours: e.target.value }))}
                placeholder="Nombre d'heures consommables"
                required
              />
            </div>
            <div>
              <label>Fréquence</label>
              <select value={form.billingInterval} onChange={(e) => setForm((prev) => ({ ...prev, billingInterval: e.target.value }))}>
                {billingIntervalOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label>URL de checkout (Stripe)</label>
              <input value={form.checkoutUrl} onChange={(e) => setForm((prev) => ({ ...prev, checkoutUrl: e.target.value }))} placeholder="https://checkout..." />
              <label>Status</label>
              <select value={form.isActive ? "ACTIVE" : "INACTIVE"} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === "ACTIVE" }))}>
                <option value="ACTIVE">Visible</option>
                <option value="INACTIVE">En pause</option>
              </select>
            </div>
            <div>
              <label>Description</label>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="8 semaines intensives, plan nutrition, support mindset..."
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : editingId ? "Mettre à jour" : "Publier l'offre"}
            </button>
            <button type="button" className="btn btn--ghost btn--small" onClick={refreshProducts}>
              Rafraîchir
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Catalogue actuel</div>
        {!hasProducts && <div style={{ opacity: 0.6 }}>Aucune offre publiée pour l'instant. Ajoute un pack pour nourrir la boutique.</div>}
        {hasProducts && (
          <div className="workout-grid">
            {products.map((product) => {
              const actionBusy = actionProductId === product.id;
              const intervalLabel =
                billingIntervalOptions.find((option) => option.value === (product.billingInterval ?? "ONE_TIME"))?.label ??
                (product.billingInterval ?? "Flexible");
              return (
                <div key={product.id} className="workout-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{product.title}</div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: product.isActive ? "#0f9d58" : "#dc2626" }}>
                      {product.isActive ? "Actif" : "En pause"}
                    </span>
                  </div>
                  <p style={{ opacity: 0.75, minHeight: 48 }}>{product.description}</p>
                  <div style={{ fontSize: 24, margin: "12px 0" }}>{formatCurrency(product.priceCents / 100)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", color: "#be123c" }}>
                    {product.creditValue ? `${product.creditValue}h incluses` : "Crédit non défini"}
                  </div>
                  <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{intervalLabel}</p>
                  <p style={{ fontSize: 12, opacity: 0.7 }}>Abonnés actifs: {product.activeSubscribers ?? 0}</p>
                  <div className="share-actions" style={{ marginTop: 12 }}>
                    <button className="btn btn--ghost btn--small" type="button" onClick={() => startEdit(product)}>
                      Modifier
                    </button>
                    <button className="btn btn--ghost btn--small" type="button" disabled={actionBusy} onClick={() => toggleActive(product)}>
                      {product.isActive ? "Mettre en pause" : "Activer"}
                    </button>
                    <button className="btn btn--outline btn--small" type="button" disabled={actionBusy} onClick={() => handleDelete(product)}>
                      Supprimer
                    </button>
                    <button
                      className="btn btn--outline btn--small"
                      type="button"
                      disabled={!product.checkoutUrl}
                      onClick={() => product.checkoutUrl && window.open(product.checkoutUrl, "_blank", "noopener")}
                    >
                      Partager
                    </button>
                  </div>
                  {product.checkoutUrl && (
                    <small style={{ display: "block", marginTop: 8, wordBreak: "break-all", opacity: 0.7 }}>{product.checkoutUrl}</small>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function toLocalInputValue(dateString: string) {
  const date = new Date(dateString);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function toIsoString(localValue: string) {
  const date = new Date(localValue);
  return date.toISOString();
}

export function CoachAvailabilityPage() {
  const { products } = useCoachDashboardContext();
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ start: "", end: "" });
  const [editForm, setEditForm] = useState({ start: "", end: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | CoachBooking["status"]>("ALL");
  const [packFilter, setPackFilter] = useState("ALL");
  const [selectedCalendarBooking, setSelectedCalendarBooking] = useState<CoachBooking | null>(null);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [ruleStatus, setRuleStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [ruleForm, setRuleForm] = useState({ weekday: "0", start: "09:00", end: "18:00" });
  const [ruleSaving, setRuleSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleEditForm, setRuleEditForm] = useState({ weekday: "0", start: "09:00", end: "18:00" });
  const [applyingRules, setApplyingRules] = useState(false);
  const [applyRange, setApplyRange] = useState("14");

  useEffect(() => {
    loadSlots();
    loadRules();
  }, []);

  useEffect(() => {
    refreshBookings();
  }, [statusFilter, packFilter]);

  async function loadSlots() {
    setLoading(true);
    try {
      const list = await CoachAvailabilityApi.list();
      setSlots(list);
    } catch {
      setStatus({ tone: "error", message: "Impossible de charger les disponibilités." });
    } finally {
      setLoading(false);
    }
  }

  async function loadRules() {
    setRulesLoading(true);
    try {
      const list = await CoachAvailabilityRuleApi.list();
      setRules(sortRuleList(list));
    } catch {
      setRuleStatus({ tone: "error", message: "Impossible de charger les horaires." });
    } finally {
      setRulesLoading(false);
    }
  }

  function sortRuleList(list: AvailabilityRule[]) {
    return [...list].sort((a, b) => (a.weekday - b.weekday !== 0 ? a.weekday - b.weekday : a.startMinutes - b.startMinutes));
  }

  async function refreshBookings() {
    setBookingLoading(true);
    setBookingMessage(null);
    try {
      const list = await CoachBookingApi.list({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        productId: packFilter === "ALL" ? undefined : packFilter === "NONE" ? "none" : packFilter
      });
      setBookings(list);
    } catch {
      setBookingMessage("Impossible de charger les réservations.");
    } finally {
      setBookingLoading(false);
    }
  }

  async function updateBookingStatus(id: string, status: CoachBooking["status"]) {
    setBookingMessage(null);
    try {
      const updated = await CoachBookingApi.update(id, { status });
      setBookings((prev) => prev.map((booking) => (booking.id === updated.id ? updated : booking)));
      setBookingMessage(status === "CONFIRMED" ? "Séance confirmée ✅" : "Séance refusée + remboursement déclenché.");
    } catch (err: any) {
      setBookingMessage(err?.message ?? "Impossible de mettre à jour la réservation.");
    }
  }

  async function submitRule(e: FormEvent) {
    e.preventDefault();
    if (!ruleForm.start || !ruleForm.end) {
      setRuleStatus({ tone: "error", message: "Ajoute un horaire de début et de fin." });
      return;
    }
    setRuleSaving(true);
    setRuleStatus(null);
    try {
      const created = await CoachAvailabilityRuleApi.create({
        weekday: Number(ruleForm.weekday),
        startTime: ruleForm.start,
        endTime: ruleForm.end
      });
      setRules((prev) => sortRuleList([...prev, created]));
      setRuleForm({ weekday: ruleForm.weekday, start: ruleForm.start, end: ruleForm.end });
      setRuleStatus({ tone: "success", message: "Horaire ajouté." });
    } catch (err: any) {
      setRuleStatus({ tone: "error", message: err?.message ?? "Impossible d'ajouter l'horaire." });
    } finally {
      setRuleSaving(false);
    }
  }

  function startRuleEdit(rule: AvailabilityRule) {
    setEditingRuleId(rule.id);
    setRuleEditForm({ weekday: String(rule.weekday), start: formatMinutes(rule.startMinutes), end: formatMinutes(rule.endMinutes) });
    setRuleStatus(null);
  }

  function cancelRuleEditForm() {
    setEditingRuleId(null);
    setRuleEditForm({ weekday: "0", start: "09:00", end: "18:00" });
  }

  async function submitRuleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRuleId) return;
    if (!ruleEditForm.start || !ruleEditForm.end) {
      setRuleStatus({ tone: "error", message: "Ajoute un horaire complet." });
      return;
    }
    setRuleSaving(true);
    setRuleStatus(null);
    try {
      const updated = await CoachAvailabilityRuleApi.update(editingRuleId, {
        weekday: Number(ruleEditForm.weekday),
        startTime: ruleEditForm.start,
        endTime: ruleEditForm.end
      });
      setRules((prev) => sortRuleList(prev.map((rule) => (rule.id === updated.id ? updated : rule))));
      setRuleStatus({ tone: "success", message: "Horaire mis à jour." });
      cancelRuleEditForm();
    } catch (err: any) {
      setRuleStatus({ tone: "error", message: err?.message ?? "Impossible de mettre à jour l'horaire." });
    } finally {
      setRuleSaving(false);
    }
  }

  async function deleteRule(id: string) {
    if (!window.confirm("Supprimer cet horaire ?")) return;
    setRuleStatus(null);
    try {
      await CoachAvailabilityRuleApi.remove(id);
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      if (editingRuleId === id) cancelRuleEditForm();
    } catch (err: any) {
      setRuleStatus({ tone: "error", message: err?.message ?? "Suppression impossible." });
    }
  }

  async function applyRulesToSlots(e?: FormEvent) {
    e?.preventDefault();
    setApplyingRules(true);
    setRuleStatus(null);
    try {
      const result = await CoachAvailabilityRuleApi.apply({
        days: Number(applyRange) || 14
      });
      setRuleStatus({ tone: "success", message: result.createdCount > 0 ? `${result.createdCount} créneaux générés.` : "Aucun nouveau créneau à publier." });
      await loadSlots();
    } catch (err: any) {
      setRuleStatus({ tone: "error", message: err?.message ?? "Impossible de générer les créneaux." });
    } finally {
      setApplyingRules(false);
    }
  }

  async function submitNewSlot(e: FormEvent) {
    e.preventDefault();
    if (!form.start || !form.end) {
      setStatus({ tone: "error", message: "Choisis un début et une fin." });
      return;
    }
    setCreating(true);
    setStatus(null);
    try {
      const created = await CoachAvailabilityApi.create({ startAt: toIsoString(form.start), endAt: toIsoString(form.end) });
      setSlots((prev) => [...prev, created].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      setForm({ start: "", end: "" });
      setStatus({ tone: "success", message: "Créneau ajouté." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible d'ajouter le créneau." });
    } finally {
      setCreating(false);
    }
  }

  function startEdit(slot: AvailabilitySlot) {
    setEditingId(slot.id);
    setEditForm({ start: toLocalInputValue(slot.startAt), end: toLocalInputValue(slot.endAt) });
    setStatus(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ start: "", end: "" });
  }

  async function submitEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editForm.start || !editForm.end) return;
    setSavingEdit(true);
    setStatus(null);
    try {
      const updated = await CoachAvailabilityApi.update(editingId, { startAt: toIsoString(editForm.start), endAt: toIsoString(editForm.end) });
      setSlots((prev) => prev.map((slot) => (slot.id === updated.id ? updated : slot)).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()));
      setStatus({ tone: "success", message: "Créneau mis à jour." });
      cancelEdit();
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible de mettre à jour le créneau." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteSlot(id: string) {
    if (!window.confirm("Supprimer ce créneau ?")) return;
    setStatus(null);
    try {
      await CoachAvailabilityApi.delete(id);
      setSlots((prev) => prev.filter((slot) => slot.id !== id));
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Suppression impossible." });
    }
  }

  const packOptions = useMemo(() => products.map((product) => ({ id: product.id, label: product.title ?? "Pack" })), [products]);
  const hasUnassignedBookings = bookings.some((booking) => !booking.pack?.product?.id);

  const sortedBookings = useMemo(() => [...bookings].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()), [bookings]);
  const pendingBookings = sortedBookings.filter((booking) => booking.status === "PENDING");
  const upcomingBookings = sortedBookings.filter((booking) => booking.status !== "REFUSED");
  const calendarBookingMap = useMemo(() => new Map(bookings.map((booking) => [booking.id, booking])), [bookings]);
  const calendarEvents: CalendarGridEvent[] = useMemo(() => {
    return bookings.map((booking) => {
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
        status: booking.status,
        title: booking.pack?.product?.title ?? booking.user?.email ?? "Réservation"
      };
    });
  }, [bookings]);

  function formatRange(start: string, end: string) {
    return `${new Date(start).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} → ${new Date(
      end
    ).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function handleCalendarEventClick(event: CalendarGridEvent) {
    const booking = calendarBookingMap.get(event.id);
    if (booking) {
      setSelectedCalendarBooking(booking);
    }
  }

  async function handleCalendarModalStatus(nextStatus: CoachBooking["status"]) {
    if (!selectedCalendarBooking) return;
    await updateBookingStatus(selectedCalendarBooking.id, nextStatus);
    setSelectedCalendarBooking(null);
  }

  const selectedBookingBadge = selectedCalendarBooking
    ? {
        label: selectedCalendarBooking.event?.statusLabel ?? coachCalendarStatusStyles[selectedCalendarBooking.status].label,
        color: selectedCalendarBooking.event?.color ?? coachCalendarStatusStyles[selectedCalendarBooking.status].color,
        background: selectedCalendarBooking.event?.background ?? coachCalendarStatusStyles[selectedCalendarBooking.status].background
      }
    : null;

  const selectedBookingMember = selectedCalendarBooking?.event?.memberName ?? selectedCalendarBooking?.user?.memberProfile?.fullName ?? selectedCalendarBooking?.user?.email ?? selectedCalendarBooking?.userId;

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Horaires & jours d'ouverture</div>
        <p style={{ opacity: 0.75 }}>Définis tes jours d'ouverture récurrents. En un clic, génère les créneaux réservables pour les prochaines semaines.</p>
        {ruleStatus && (
          <div style={{ marginBottom: 12, color: ruleStatus.tone === "error" ? "crimson" : "#0f9d58", fontWeight: 600 }}>{ruleStatus.message}</div>
        )}
        <div className="schedule-rules">
          {rulesLoading && <div style={{ opacity: 0.7 }}>Chargement des horaires...</div>}
          {!rulesLoading && rules.length === 0 && <div style={{ opacity: 0.65 }}>Aucun horaire défini. Ajoute ta première plage ci-dessous.</div>}
          {rules.map((rule) => (
            <div key={rule.id} className="schedule-rule">
              <div>
                <strong>{labelForWeekday(rule.weekday)}</strong>
                <p>{formatMinutes(rule.startMinutes)} → {formatMinutes(rule.endMinutes)}</p>
              </div>
              <div className="schedule-rule__actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => startRuleEdit(rule)}>
                  Modifier
                </button>
                <button className="btn btn--outline btn--small" type="button" onClick={() => deleteRule(rule.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
        <form className="cms-form" onSubmit={submitRule} style={{ marginTop: 16 }}>
          <div className="cms-grid">
            <div>
              <label>Jour</label>
              <select value={ruleForm.weekday} onChange={(e) => setRuleForm((prev) => ({ ...prev, weekday: e.target.value }))}>
                {weekdayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Début</label>
              <input type="time" value={ruleForm.start} onChange={(e) => setRuleForm((prev) => ({ ...prev, start: e.target.value }))} required />
            </div>
            <div>
              <label>Fin</label>
              <input type="time" value={ruleForm.end} onChange={(e) => setRuleForm((prev) => ({ ...prev, end: e.target.value }))} required />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={ruleSaving}>
              {ruleSaving ? "Ajout..." : "Ajouter l'horaire"}
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={loadRules}>
              Rafraîchir
            </button>
          </div>
        </form>
        {editingRuleId && (
          <form className="cms-form" onSubmit={submitRuleEdit} style={{ marginTop: 12 }}>
            <div className="form-hint">Edition de l'horaire sélectionné</div>
            <div className="cms-grid">
              <div>
                <label>Jour</label>
                <select value={ruleEditForm.weekday} onChange={(e) => setRuleEditForm((prev) => ({ ...prev, weekday: e.target.value }))}>
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Début</label>
                <input type="time" value={ruleEditForm.start} onChange={(e) => setRuleEditForm((prev) => ({ ...prev, start: e.target.value }))} required />
              </div>
              <div>
                <label>Fin</label>
                <input type="time" value={ruleEditForm.end} onChange={(e) => setRuleEditForm((prev) => ({ ...prev, end: e.target.value }))} required />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={ruleSaving}>
                {ruleSaving ? "Sauvegarde..." : "Mettre à jour"}
              </button>
              <button className="btn btn--ghost btn--small" type="button" onClick={cancelRuleEditForm}>
                Annuler
              </button>
            </div>
          </form>
        )}
        <form className="cms-form cms-form--compact" onSubmit={applyRulesToSlots} style={{ marginTop: 12 }}>
          <label>Générer des créneaux pour les prochains jours</label>
          <div className="apply-rules">
            <input type="number" min="1" max="60" value={applyRange} onChange={(e) => setApplyRange(e.target.value)} />
            <button className="btn btn--ghost" type="submit" disabled={applyingRules}>
              {applyingRules ? "Génération..." : "Publier les créneaux"}
            </button>
          </div>
          <small style={{ opacity: 0.7 }}>Cela crée les créneaux réels utilisés par la page booking en respectant ton planning.</small>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Agenda des réservations</div>
        <div className="filter-bar" style={{ marginBottom: 12 }}>
          <label>
            Statut
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "ALL" | CoachBooking["status"])}>
              <option value="ALL">Tous</option>
              <option value="PENDING">En attente</option>
              <option value="CONFIRMED">Confirmés</option>
              <option value="REFUSED">Refusés</option>
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
              {hasUnassignedBookings && <option value="NONE">Sans pack</option>}
            </select>
          </label>
        </div>
        {bookingMessage && <div style={{ marginBottom: 12, color: bookingMessage.includes("Impossible") ? "crimson" : "#0f9d58" }}>{bookingMessage}</div>}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ opacity: 0.75 }}>Confirme ou refuse les demandes payées par les adhérents. Les refus déclenchent un remboursement auto.</p>
          <button className="btn btn--ghost btn--small" type="button" onClick={refreshBookings} disabled={bookingLoading}>
            Rafraîchir
          </button>
        </div>
        {pendingBookings.length === 0 && <div style={{ opacity: 0.6 }}>Pas de créneaux en attente.</div>}
        <div className="pipeline-list">
          {pendingBookings.map((booking) => (
            <div key={booking.id} className="pipeline-item">
              <div>
                <strong>{formatRange(booking.startAt, booking.endAt)}</strong>
                <p>Adhérent: {booking.user?.email ?? booking.userId}</p>
                {booking.pack?.product?.title && <p style={{ fontSize: 12, opacity: 0.75 }}>Pack: {booking.pack.product.title}</p>}
                {booking.memberNotes && <p style={{ opacity: 0.75 }}>Note: {booking.memberNotes}</p>}
              </div>
              <div className="pipeline-item__actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => updateBookingStatus(booking.id, "CONFIRMED")}>
                  Confirmer
                </button>
                <button className="btn btn--outline btn--small" type="button" onClick={() => updateBookingStatus(booking.id, "REFUSED")}>
                  Refuser
                </button>
                {booking.user?.memberProfile?.id && (
                  <Link className="btn btn--ghost btn--small" to={`/coach/members?memberId=${booking.user.memberProfile.id}`}>
                    Fiche
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <h4>À venir</h4>
          {upcomingBookings.length === 0 && <div style={{ opacity: 0.6 }}>Aucun créneau planifié.</div>}
          <div className="pipeline-list">
            {upcomingBookings.map((booking) => (
              <div key={booking.id} className="pipeline-item">
                <div>
                  <strong>{formatRange(booking.startAt, booking.endAt)}</strong>
                  <p>{booking.status === "CONFIRMED" ? "Confirmée" : booking.status === "REFUSED" ? "Refusée" : "En attente"}</p>
                  {booking.pack?.product?.title && <p style={{ fontSize: 12, opacity: 0.7 }}>Pack: {booking.pack.product.title}</p>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {booking.status === "CONFIRMED" && <span className="timeline-calendar__status">Go</span>}
                  {booking.status === "REFUSED" && <span className="timeline-calendar__status" style={{ background: "#fee2e2", color: "#dc2626" }}>Refusée</span>}
                  {booking.user?.memberProfile?.id && (
                    <Link className="btn btn--outline btn--small" to={`/coach/members?memberId=${booking.user.memberProfile.id}`}>
                      Fiche
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Calendrier mensuel</div>
        <CalendarGrid events={calendarEvents} statusStyles={coachCalendarStatusStyles} emptyLabel="Pas de réservations sur cette période." onEventClick={handleCalendarEventClick} />
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Publier des créneaux réservables</div>
        <p style={{ opacity: 0.75 }}>
          Ces disponibilités alimentent la page booking. Ajoute des plages (date + heure de début/fin) puis partage le lien de réservation public.
        </p>
        {status && (
          <div style={{ marginBottom: 12, color: status.tone === "error" ? "crimson" : "#0f9d58", fontWeight: 600 }}>{status.message}</div>
        )}
        <form className="cms-form" onSubmit={submitNewSlot}>
          <div className="cms-grid">
            <div>
              <label>Début</label>
              <input type="datetime-local" value={form.start} onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))} required />
            </div>
            <div>
              <label>Fin</label>
              <input type="datetime-local" value={form.end} onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))} required />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={creating}>
              {creating ? "Ajout..." : "Ajouter le créneau"}
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={loadSlots}>
              Rafraîchir
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Créneaux planifiés</div>
        {loading && <div style={{ opacity: 0.7 }}>Chargement...</div>}
        {!loading && slots.length === 0 && <div style={{ opacity: 0.6 }}>Aucune disponibilité publiée. Ajoute un créneau pour ouvrir les réservations.</div>}
        <div className="pipeline-list">
          {slots.map((slot) => (
            <div key={slot.id} className="pipeline-item">
              <div>
                <strong>{new Date(slot.startAt).toLocaleString("fr-FR")}</strong>
                <p>→ {new Date(slot.endAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="pipeline-item__actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => startEdit(slot)}>
                  Modifier
                </button>
                <button className="btn btn--outline btn--small" type="button" onClick={() => deleteSlot(slot.id)}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>

        {editingId && (
          <form className="cms-form" onSubmit={submitEdit} style={{ marginTop: 16 }}>
            <div className="form-hint">Edition du créneau sélectionné</div>
            <div className="cms-grid">
              <div>
                <label>Début</label>
                <input type="datetime-local" value={editForm.start} onChange={(e) => setEditForm((prev) => ({ ...prev, start: e.target.value }))} required />
              </div>
              <div>
                <label>Fin</label>
                <input type="datetime-local" value={editForm.end} onChange={(e) => setEditForm((prev) => ({ ...prev, end: e.target.value }))} required />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={savingEdit}>
                {savingEdit ? "Sauvegarde..." : "Mettre à jour"}
              </button>
              <button className="btn btn--ghost btn--small" type="button" onClick={cancelEdit}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </section>

      {selectedCalendarBooking && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="dashboard-card__title">Détails de la réservation</div>
            <p style={{ fontWeight: 600 }}>{selectedBookingMember ?? "Adhérent"}</p>
            <p>{formatRange(selectedCalendarBooking.startAt, selectedCalendarBooking.endAt)}</p>
            {selectedBookingBadge && (
              <span className="focus-tag" style={{ background: selectedBookingBadge.background, color: selectedBookingBadge.color }}>
                {selectedBookingBadge.label}
              </span>
            )}
            {selectedCalendarBooking.pack?.product?.title && <p>Pack: {selectedCalendarBooking.pack.product.title}</p>}
            {selectedCalendarBooking.memberNotes && <p>Notes membre: {selectedCalendarBooking.memberNotes}</p>}
            {selectedCalendarBooking.coachNotes && <p>Notes coach: {selectedCalendarBooking.coachNotes}</p>}
            <div className="modal-card__actions">
              {selectedCalendarBooking.status === "PENDING" && (
                <>
                  <button className="btn" type="button" onClick={() => handleCalendarModalStatus("CONFIRMED")}>
                    Confirmer
                  </button>
                  <button className="btn btn--ghost" type="button" onClick={() => handleCalendarModalStatus("REFUSED")}>
                    Refuser
                  </button>
                </>
              )}
              <button className="btn btn--outline btn--small" type="button" onClick={() => setSelectedCalendarBooking(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CoachRecapsPage() {
  const { members } = useCoachDashboardContext();
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [recapsByMember, setRecapsByMember] = useState<Record<string, PaginatedResponse<SessionRecap> | undefined>>({});
  const [loadingRecaps, setLoadingRecaps] = useState(false);
  const [recapError, setRecapError] = useState<string | null>(null);
  const [form, setForm] = useState<RecapForm>(() => createDefaultRecapForm());
  const [editingRecapId, setEditingRecapId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const recapParamsRef = useRef<Record<string, { page: number; pageSize: number }>>({});

  useEffect(() => {
    if (!members.length) return;
    setSelectedMemberId((prev) => (prev ? prev : members[0].id));
    setForm((prev) => (prev.memberId ? prev : createDefaultRecapForm(members[0].id)));
  }, [members]);

  useEffect(() => {
    if (!selectedMemberId) return;
    if (recapsByMember[selectedMemberId]) return;
    loadRecaps(selectedMemberId, 1);
  }, [selectedMemberId, recapsByMember]);

  async function loadRecaps(memberId: string, page?: number) {
    if (!memberId) return;
    setLoadingRecaps(true);
    setRecapError(null);
    const currentParams = recapParamsRef.current[memberId] ?? { page: 1, pageSize: COACH_RECAPS_PAGE_SIZE };
    const nextParams = {
      page: page ?? currentParams.page,
      pageSize: currentParams.pageSize
    };
    try {
      const list = await CoachSiteApi.memberRecaps(memberId, nextParams);
      setRecapsByMember((prev) => ({ ...prev, [memberId]: list }));
      recapParamsRef.current[memberId] = { page: list.pagination.page, pageSize: list.pagination.pageSize };
    } catch (err: any) {
      setRecapError(err?.message ?? "Impossible de charger les recaps.");
    } finally {
      setLoadingRecaps(false);
    }
  }

  function cancelEdit(nextMemberId?: string) {
    setEditingRecapId(null);
    setForm(createDefaultRecapForm(nextMemberId ?? (selectedMemberId || undefined)));
  }

  function handleMemberChange(memberId: string) {
    if (!memberId) {
      setSelectedMemberId("");
      setForm(createDefaultRecapForm());
      setEditingRecapId(null);
      return;
    }
    if (editingRecapId && memberId !== form.memberId) {
      const confirmSwitch = window.confirm("Tu es en train de modifier un recap. Abandonner les modifications ?");
      if (!confirmSwitch) return;
      cancelEdit(memberId);
    } else {
      setForm(createDefaultRecapForm(memberId));
    }
    setSelectedMemberId(memberId);
    loadRecaps(memberId, 1);
  }

  function startEdit(recap: SessionRecap) {
    setSelectedMemberId(recap.memberId);
    setForm({
      memberId: recap.memberId,
      sessionDate: new Date(recap.sessionDate).toISOString().slice(0, 10),
      focus: recap.focus ?? "Force",
      intensity: recap.intensity ?? "RPE 8",
      notes: recap.notes ?? "",
      exercises:
        recap.exercises.length > 0
          ? recap.exercises.map((exercise) => ({ ...exercise }))
          : [
              {
                name: "",
                sets: "3",
                reps: "10",
                rest: "60s"
              }
            ]
    });
    setEditingRecapId(recap.id);
    if (!recapsByMember[recap.memberId]) loadRecaps(recap.memberId, 1);
  }

  function updateExercise(index: number, patch: Partial<SessionRecapExercise>) {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise, idx) => (idx === index ? { ...exercise, ...patch } : exercise))
    }));
  }

  function addExerciseRow() {
    setForm((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { name: "", sets: "3", reps: "10", rest: "60s" }]
    }));
  }

  async function removeRecap(memberId: string, recapId: string) {
    const shouldDelete = window.confirm("Supprimer ce recap ?");
    if (!shouldDelete) return;
    setRecapError(null);
    try {
      await CoachSiteApi.deleteSessionRecap(memberId, recapId);
      const currentPage = recapParamsRef.current[memberId]?.page ?? 1;
      await loadRecaps(memberId, currentPage);
      if (editingRecapId === recapId) {
        cancelEdit(memberId);
      }
    } catch (err: any) {
      setRecapError(err?.message ?? "Impossible de supprimer le recap.");
    }
  }

  function removeExerciseRow(index: number) {
    setForm((prev) => {
      if (prev.exercises.length <= 1) return prev;
      return { ...prev, exercises: prev.exercises.filter((_, idx) => idx !== index) };
    });
  }

  async function submitRecap(e: FormEvent) {
    e.preventDefault();
    if (!form.memberId) {
      setRecapError("Sélectionne un adhérent.");
      return;
    }
    const exercises = form.exercises.filter((exercise) => exercise.name.trim().length > 0);
    if (exercises.length === 0) {
      setRecapError("Ajoute au moins un exercice.");
      return;
    }
    setSubmitting(true);
    setRecapError(null);
    const payload = {
      sessionDate: form.sessionDate,
      focus: form.focus,
      intensity: form.intensity,
      notes: form.notes,
      exercises
    };
    try {
      if (editingRecapId) {
        await CoachSiteApi.updateSessionRecap(form.memberId, editingRecapId, payload);
        const currentPage = recapParamsRef.current[form.memberId]?.page ?? 1;
        await loadRecaps(form.memberId, currentPage);
        cancelEdit(form.memberId);
      } else {
        await CoachSiteApi.createSessionRecap(form.memberId, payload);
        await loadRecaps(form.memberId, 1);
        setForm(createDefaultRecapForm(form.memberId));
      }
      setSelectedMemberId(form.memberId);
    } catch (err: any) {
      setRecapError(err?.message ?? "Impossible d'enregistrer le recap.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentRecapPage = selectedMemberId ? recapsByMember[selectedMemberId] : undefined;
  const currentRecaps = currentRecapPage?.items ?? [];
  const currentPagination = currentRecapPage?.pagination ?? null;
  const selectedMember = members.find((member) => member.id === selectedMemberId);
  const isEditingRecap = Boolean(editingRecapId);
  const editingRecap = isEditingRecap ? currentRecaps.find((recap) => recap.id === editingRecapId) : null;
  const memberLabel = selectedMember?.fullName ?? selectedMember?.user?.email ?? "Adhérent";

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Envoyer un recap de séance</div>
        {recapError && <div style={{ color: "crimson", marginBottom: 8 }}>{recapError}</div>}
        <form className="cms-form" onSubmit={submitRecap}>
          {isEditingRecap && (
            <div className="form-hint">
              Edition du recap du{" "}
              {editingRecap ? new Date(editingRecap.sessionDate).toLocaleDateString("fr-FR") : new Date(form.sessionDate).toLocaleDateString("fr-FR")}
              <button type="button" className="btn btn--ghost btn--small" onClick={() => cancelEdit()}>
                Annuler l&apos;édition
              </button>
            </div>
          )}
          <div className="cms-grid">
            <div>
              <label>Adhérent</label>
              <select value={form.memberId} onChange={(e) => handleMemberChange(e.target.value)} required disabled={isEditingRecap}>
                <option value="">Choisir un membre</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName ?? member.user?.email ?? "Adhérent"} {member.goal ? `• ${member.goal}` : ""}
                  </option>
                ))}
              </select>
              <label>Session</label>
              <input type="date" value={form.sessionDate} onChange={(e) => setForm((prev) => ({ ...prev, sessionDate: e.target.value }))} required />
            </div>
            <div>
              <label>Focus</label>
              <select value={form.focus} onChange={(e) => setForm((prev) => ({ ...prev, focus: e.target.value }))}>
                {focusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <label>Intensité</label>
              <select value={form.intensity} onChange={(e) => setForm((prev) => ({ ...prev, intensity: e.target.value }))}>
                {intensityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Notes coach</label>
              <textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Commentaires, ressenti, objectifs de la prochaine séance" />
            </div>
          </div>
          <div>
            <h4>Exercices</h4>
            {form.exercises.map((exercise, index) => (
              <div key={`exercise-${index}`} className="exercise-row">
                <input
                  list="session-exercise-library"
                  value={exercise.name}
                  onChange={(e) => updateExercise(index, { name: e.target.value })}
                  placeholder="Exercice"
                  required
                />
                <input value={exercise.sets ?? ""} onChange={(e) => updateExercise(index, { sets: e.target.value })} placeholder="Séries" />
                <input value={exercise.reps ?? ""} onChange={(e) => updateExercise(index, { reps: e.target.value })} placeholder="Rép" />
                <input value={exercise.tempo ?? ""} onChange={(e) => updateExercise(index, { tempo: e.target.value })} placeholder="Tempo" />
                <input value={exercise.rest ?? ""} onChange={(e) => updateExercise(index, { rest: e.target.value })} placeholder="Repos" />
                <input value={exercise.cues ?? ""} onChange={(e) => updateExercise(index, { cues: e.target.value })} placeholder="Consignes" />
                <button type="button" className="cms-remove" onClick={() => removeExerciseRow(index)} disabled={form.exercises.length <= 1}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--ghost" onClick={addExerciseRow}>
              + Ajouter un exercice
            </button>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={submitting || !form.memberId}>
              {submitting ? "Envoi..." : isEditingRecap ? "Mettre à jour le recap" : "Publier le recap"}
            </button>
            {isEditingRecap && (
              <button type="button" className="btn btn--ghost btn--small" onClick={() => cancelEdit()}>
                Annuler
              </button>
            )}
          </div>
        </form>
        <datalist id="session-exercise-library">
          {exerciseLibrary.map((exercise) => (
            <option key={exercise} value={exercise} />
          ))}
        </datalist>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">
          Historique recaps — {memberLabel}
          <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
            <select value={selectedMemberId} onChange={(e) => handleMemberChange(e.target.value)} disabled={isEditingRecap}>
              <option value="">Choisir un membre</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName ?? member.user?.email ?? "Adhérent"}
                </option>
              ))}
            </select>
            <button
              className="btn btn--ghost btn--small"
              type="button"
              onClick={() => selectedMemberId && loadRecaps(selectedMemberId, recapParamsRef.current[selectedMemberId]?.page)}
            >
              Rafraîchir
            </button>
          </div>
        </div>
        {loadingRecaps && <div style={{ opacity: 0.7 }}>Chargement des recaps...</div>}
        {!loadingRecaps && currentRecaps.length === 0 && <div style={{ opacity: 0.6 }}>Pas encore de recap pour cet adhérent.</div>}
        <div className="pipeline-list">
          {currentRecaps.map((recap) => (
            <div key={recap.id} className="pipeline-item">
              <div>
                <strong>
                  {new Date(recap.sessionDate).toLocaleDateString("fr-FR")} — {recap.focus ?? "Session"}
                </strong>
                <p style={{ opacity: 0.75 }}>
                  {recap.intensity ?? "-"}
                  {recap.notes ? ` • ${recap.notes}` : ""}
                </p>
                <ul style={{ margin: "6px 0 0 16px", padding: 0, listStyle: "disc" }}>
                  {recap.exercises.map((exercise, idx) => (
                    <li key={`${recap.id}-${idx}`}>
                      <strong>{exercise.name}</strong> — {exercise.sets ?? "?"} x {exercise.reps ?? "?"}
                      {exercise.tempo ? ` @${exercise.tempo}` : ""}
                      {exercise.rest ? ` • repos ${exercise.rest}` : ""}
                      {exercise.cues ? ` (${exercise.cues})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pipeline-item__actions">
                <button className="btn btn--ghost btn--small" type="button" onClick={() => startEdit(recap)}>
                  Modifier
                </button>
                <button className="btn btn--outline btn--small" type="button" onClick={() => removeRecap(recap.memberId, recap.id)}>
                  Supprimer
                </button>
                <button className="btn btn--outline btn--small" type="button" onClick={() => window.open(CoachSiteApi.memberRecapUrl(recap.memberId), "_blank")}>
                  Exporter PDF
                </button>
              </div>
            </div>
          ))}
        </div>
        {currentPagination && (
          <PaginationControls
            page={currentPagination.page}
            totalPages={currentPagination.totalPages}
            total={currentPagination.total}
            pageSize={currentPagination.pageSize}
            onPageChange={(page) => selectedMemberId && loadRecaps(selectedMemberId, page)}
          />
        )}
      </section>
    </div>
  );
}

export function CoachVideosPage() {
  const [videosPage, setVideosPage] = useState<PaginatedResponse<ExerciseVideo> | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<"UPLOAD" | "LINK">("UPLOAD");
  const [form, setForm] = useState({ title: "", description: "", category: "Force", externalUrl: "" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const videoParamsRef = useRef({ page: 1, pageSize: COACH_VIDEOS_PAGE_SIZE });
  const videos = videosPage?.items ?? [];
  const videoPagination = videosPage?.pagination ?? null;

  const categoryOptions = useMemo(() => {
    const defaults = ["Force", "Hypertrophie", "Conditioning", "Mobilité", "Préhab", "Mindset"];
    const custom = videos.map((video) => video.category).filter(Boolean);
    return Array.from(new Set([...defaults, ...custom])).sort((a, b) => a.localeCompare(b, "fr"));
  }, [videos]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseVideo[]>();
    videos.forEach((video) => {
      const key = video.category || "Autres";
      map.set(key, [...(map.get(key) ?? []), video]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [videos]);

  const refreshVideos = useCallback(
    async (params?: { page?: number; pageSize?: number }) => {
    setLoading(true);
    setFormError(null);
    const nextParams = {
      page: params?.page ?? videoParamsRef.current.page,
      pageSize: params?.pageSize ?? videoParamsRef.current.pageSize
    };
    try {
      const list = await CoachVideoApi.list(nextParams);
      setVideosPage(list);
      videoParamsRef.current = { page: list.pagination.page, pageSize: list.pagination.pageSize };
    } catch (err: any) {
      setFormError(err?.message ?? "Impossible de charger la vidéothèque.");
    } finally {
      setLoading(false);
    }
    },
    []
  );

  useEffect(() => {
    refreshVideos();
  }, [refreshVideos]);

  function handleModeChange(next: "UPLOAD" | "LINK") {
    setMode(next);
    setFormError(null);
    if (next === "LINK") {
      setPendingFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else {
      setForm((prev) => ({ ...prev, externalUrl: "" }));
    }
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setFormError("Ajoute un titre.");
      return;
    }
    if (mode === "UPLOAD" && !pendingFile) {
      setFormError("Ajoute un fichier vidéo.");
      return;
    }
    if (mode === "LINK" && !form.externalUrl.trim()) {
      setFormError("Colle un lien vidéo valide (YouTube, Vimeo, MP4...).");
      return;
    }
    setFormError(null);
    setUploading(true);
    const trimmedUrl = form.externalUrl.trim();
    try {
      await CoachVideoApi.upload({
        title: form.title,
        description: form.description,
        category: form.category,
        file: mode === "UPLOAD" ? pendingFile : null,
        externalUrl: mode === "LINK" ? trimmedUrl : undefined
      });
      await refreshVideos({ page: 1 });
      setForm((prev) => ({ title: "", description: "", category: prev.category, externalUrl: "" }));
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setFormError(err?.message ?? "Upload impossible.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(videoId: string) {
    const confirmDelete = window.confirm("Supprimer cette vidéo ? (le fichier sera effacé du serveur)");
    if (!confirmDelete) return;
    try {
      await CoachVideoApi.delete(videoId);
      await refreshVideos({ page: videoParamsRef.current.page });
    } catch (err: any) {
      setFormError(err?.message ?? "Suppression impossible.");
    }
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Uploader une nouvelle démonstration</div>
        {formError && <div style={{ color: "crimson", marginBottom: 8 }}>{formError}</div>}
        <form className="cms-form" onSubmit={handleUpload}>
          <div className="form-hint" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="video-mode"
                value="UPLOAD"
                checked={mode === "UPLOAD"}
                onChange={() => handleModeChange("UPLOAD")}
              />
              Héberger le fichier
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name="video-mode"
                value="LINK"
                checked={mode === "LINK"}
                onChange={() => handleModeChange("LINK")}
              />
              Utiliser un lien (YouTube, Vimeo, MP4…)
            </label>
          </div>
          <div className="cms-grid">
            <div>
              <label>Titre *</label>
              <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} required />
              <label>Catégorie *</label>
              <input
                list="coach-video-categories"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Force - Lower"
                required
              />
              <datalist id="coach-video-categories">
                {categoryOptions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Consignes clés, tempo, points d'attention"
              />
              {mode === "UPLOAD" ? (
                <>
                  <label>Fichier vidéo *</label>
                  <input
                    type="file"
                    accept="video/*"
                    ref={fileInputRef}
                    onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                    required={mode === "UPLOAD" && !pendingFile}
                  />
                  <small style={{ opacity: 0.7 }}>Formats supportés: mp4, mov, webm. 200 Mo max.</small>
                </>
              ) : (
                <>
                  <label>Lien vidéo *</label>
                  <input
                    type="url"
                    value={form.externalUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, externalUrl: e.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required={mode === "LINK"}
                  />
                  <small style={{ opacity: 0.7 }}>Collez un lien YouTube, Vimeo ou un MP4 déjà hébergé.</small>
                </>
              )}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={uploading}>
              {uploading ? "Upload en cours..." : "Publier la vidéo"}
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={() => refreshVideos()} disabled={loading}>
              Actualiser la liste
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Vidéos publiées</div>
        {loading && <div style={{ opacity: 0.65 }}>Chargement de la bibliothèque...</div>}
        {!loading && videos.length === 0 && <div style={{ opacity: 0.65 }}>Aucune vidéo publiée pour l&apos;instant.</div>}
        {grouped.map(([category, entries]) => (
          <div key={category} style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0 }}>{category}</h4>
              <span style={{ fontSize: 12, opacity: 0.6 }}>{entries.length} vidéo(s)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {entries.map((video) => (
                <div key={video.id} className="workout-card" style={{ padding: 0 }}>
                  <VideoPreview url={video.videoUrl} />
                  <div style={{ padding: 16 }}>
                    <strong>{video.title}</strong>
                    {video.description && <p style={{ marginTop: 4, opacity: 0.75 }}>{video.description}</p>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <small style={{ opacity: 0.6 }}>
                        {new Date(video.createdAt).toLocaleDateString("fr-FR")} · {getVideoSourceLabel(video.videoUrl, !!video.fileKey)}
                      </small>
                      <button className="btn btn--outline btn--small" type="button" onClick={() => handleDelete(video.id)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {videoPagination && (
          <PaginationControls
            page={videoPagination.page}
            totalPages={videoPagination.totalPages}
            total={videoPagination.total}
            pageSize={videoPagination.pageSize}
            onPageChange={(page) => refreshVideos({ page })}
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
          title="Vidéo hébergée"
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

export function CoachInboxPage() {
  const { contactMessages, updateContactStatus } = useCoachDashboardContext();
  const newMessages = contactMessages.filter((message) => message.status === "NEW");
  const archived = contactMessages.filter((message) => message.status !== "NEW");

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Leads & messages entrants</div>
        <div className="pipeline-list">
          {newMessages.map((message) => (
            <div key={message.id} className="pipeline-item">
              <div>
                <strong>{message.fullName}</strong> — {message.email}
                <p>{message.subject}</p>
                <p style={{ opacity: 0.8 }}>{message.message}</p>
                <span style={{ fontSize: 12, opacity: 0.65 }}>{new Date(message.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="pipeline-item__actions">
                <button className="btn btn--ghost btn--small" onClick={() => updateContactStatus(message.id, "READ")}>
                  Qualifier
                </button>
                <button className="btn btn--outline btn--small" onClick={() => updateContactStatus(message.id, "ARCHIVED")}>
                  Archiver
                </button>
              </div>
            </div>
          ))}
          {newMessages.length === 0 && <div style={{ opacity: 0.6 }}>Pas de nouveau lead aujourd&apos;hui.</div>}
        </div>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Historique & suivi</div>
        <div className="pipeline-list">
          {archived.map((message) => (
            <div key={message.id} className="pipeline-item">
              <div>
                <strong>{message.fullName}</strong>
                <p>{message.subject}</p>
                <span style={{ fontSize: 12, opacity: 0.65 }}>{new Date(message.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="pipeline-item__actions">
                <select value={message.status} onChange={(e) => updateContactStatus(message.id, e.target.value as ContactMessage["status"])}>
                  <option value="READ">Qualifié</option>
                  <option value="ARCHIVED">Archivé</option>
                </select>
              </div>
            </div>
          ))}
          {archived.length === 0 && <div style={{ opacity: 0.6 }}>Ton historique est vide.</div>}
        </div>
      </section>
    </div>
  );
}

export function CoachBillingPage() {
  const { members, payments, paymentsPagination, paymentReport, refreshPayments, goToPaymentPage, updatePaymentStatus, createCashPayment } = useCoachDashboardContext();
  const totals = paymentReport?.totals ?? {};
  const cashPending = paymentReport?.cash?.pending ?? [];
  const cashPaid = paymentReport?.cash?.paid ?? [];
  const [cashForm, setCashForm] = useState({ memberId: "", amount: "", description: "", notes: "" });
  const [cashStatus, setCashStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [cashNotes, setCashNotes] = useState<Record<string, string>>({});
  const [cashActionLoading, setCashActionLoading] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  function handleCashField(field: keyof typeof cashForm, value: string) {
    setCashForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCashSubmit(event: FormEvent) {
    event.preventDefault();
    if (!cashForm.memberId) {
      setCashStatus({ tone: "error", message: "Choisis un adhérent." });
      return;
    }
    const amount = Number(String(cashForm.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setCashStatus({ tone: "error", message: "Montant invalide." });
      return;
    }
    setCashSubmitting(true);
    setCashStatus(null);
    try {
      await createCashPayment({
        memberId: cashForm.memberId,
        amountCents: Math.round(amount * 100),
        description: cashForm.description || undefined,
        notes: cashForm.notes || undefined
      });
      setCashForm({ memberId: "", amount: "", description: "", notes: "" });
      setCashStatus({ tone: "success", message: "Paiement cash enregistré. Tu peux le valider quand tu encaisses." });
    } catch (err: any) {
      setCashStatus({ tone: "error", message: err?.message ?? "Erreur pendant la création du paiement cash." });
    } finally {
      setCashSubmitting(false);
    }
  }

  function handleCashNoteChange(id: string, value: string) {
    setCashNotes((prev) => ({ ...prev, [id]: value }));
  }

  async function handleCashValidation(id: string) {
    setCashActionLoading(id);
    try {
      await updatePaymentStatus(id, "PAID", cashNotes[id]);
      setCashNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setCashActionLoading(null);
    }
  }

  async function handleExportPayments() {
    setExportingCsv(true);
    setExportStatus(null);
    try {
      const all: Payment[] = [];
      let page = 1;
      const pageSize = 100;
      let totalPages = 1;
      do {
        const response = await PaymentApi.coachList({ page, pageSize });
        all.push(...response.items);
        totalPages = response.pagination.totalPages;
        page += 1;
      } while (page <= totalPages);

      if (all.length === 0) {
        setExportStatus({ tone: "error", message: "Aucun paiement à exporter pour l'instant." });
        return;
      }

      const header = ["ID", "Membre", "Email", "Montant (€)", "Devise", "Méthode", "Statut", "Date"];
      const rows = all.map((payment) => [
        payment.id,
        payment.member?.fullName ?? "",
        payment.member?.user?.email ?? "",
        (payment.amountCents / 100).toFixed(2),
        payment.currency ?? "EUR",
        payment.method,
        payment.status,
        new Date(payment.createdAt).toLocaleString("fr-FR")
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
        .join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `paiements-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportStatus({ tone: "success", message: `Export généré (${all.length} paiement${all.length > 1 ? "s" : ""}).` });
    } catch (err: any) {
      setExportStatus({ tone: "error", message: err?.message ?? "Impossible de générer l'export CSV." });
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Cashflow & projections</div>
        <div className="stat-grid">
          <div className="stat-chip">
            <div className="stat-value">{paymentReport ? formatCurrency(paymentReport.summary.paid) : "0 €"}</div>
            <div className="stat-label">MRR encaissé</div>
            <p>Mois en cours</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{paymentReport ? formatCurrency(paymentReport.summary.outstanding) : "0 €"}</div>
            <div className="stat-label">À encaisser</div>
            <p>Automatisations Stripe + suivi cash</p>
          </div>
          <div className="stat-chip">
            <div className="stat-value">{Object.entries(totals).map(([method, amount]) => `${method}: ${formatCurrency(amount)}`).join(" • ") || "—"}</div>
            <div className="stat-label">Mix de paiement</div>
            <p>Stripe / Cash</p>
          </div>
        </div>
        <button className="btn btn--ghost" style={{ marginTop: 12 }} onClick={() => refreshPayments()}>
          Rafraîchir le reporting
        </button>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Créer un encaissement cash</div>
        <p style={{ opacity: 0.75, marginBottom: 12 }}>Ajoute manuellement un règlement cash pour suivre tes flux hors-ligne.</p>
        {cashStatus && (
          <div style={{ color: cashStatus.tone === "success" ? "#16a34a" : "crimson", marginBottom: 12, fontWeight: 600 }}>{cashStatus.message}</div>
        )}
        <form className="cms-form cms-form--compact" onSubmit={handleCashSubmit}>
          <div className="cms-grid">
            <div>
              <label>Membre</label>
              <select value={cashForm.memberId} onChange={(e) => handleCashField("memberId", e.target.value)} required>
                <option value="">Sélectionner</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName ?? member.user?.email ?? "Adhérent"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Montant (€)</label>
              <input value={cashForm.amount} onChange={(e) => handleCashField("amount", e.target.value)} placeholder="149" required />
            </div>
          </div>
          <label>Description (optionnel)</label>
          <input value={cashForm.description} onChange={(e) => handleCashField("description", e.target.value)} placeholder="Pack Signature - Janvier" />
          <label>Note interne</label>
          <textarea value={cashForm.notes} onChange={(e) => handleCashField("notes", e.target.value)} placeholder="Ex: payé avant séance / référence facture" />
          <div className="form-actions">
            <button className="btn" type="submit" disabled={cashSubmitting}>
              {cashSubmitting ? "Enregistrement..." : "Enregistrer le paiement cash"}
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span>Paiements récents</span>
          <button className="btn btn--ghost btn--small" type="button" onClick={handleExportPayments} disabled={exportingCsv}>
            {exportingCsv ? "Export en cours..." : "Exporter CSV"}
          </button>
        </div>
        {exportStatus && (
          <div style={{ marginBottom: 12, color: exportStatus.tone === "success" ? "#16a34a" : "crimson", fontWeight: 600 }}>{exportStatus.message}</div>
        )}
        <div className="pipeline-list">
          {payments.map((payment) => (
            <div key={payment.id} className="pipeline-item">
              <div>
                <strong>{formatCurrency(payment.amountCents / 100)}</strong> — {payment.method}
                <p>{payment.member?.fullName ?? payment.member?.user?.email ?? "Membre"}</p>
                <span style={{ fontSize: 12, opacity: 0.65 }}>{new Date(payment.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="pipeline-item__actions pipeline-item__actions--column">
                <select value={payment.status} onChange={(e) => updatePaymentStatus(payment.id, e.target.value as Payment["status"])}>
                  <option value="PENDING">En attente</option>
                  <option value="PAID">Payé</option>
                  <option value="FAILED">Échec</option>
                </select>
                <button className="btn btn--outline btn--small" onClick={() => window.open(PaymentApi.receiptUrl(payment.id), "_blank")}>
                  Reçu PDF
                </button>
              </div>
            </div>
          ))}
          {payments.length === 0 && <div style={{ opacity: 0.6 }}>Aucun paiement enregistré pour le moment.</div>}
        </div>
        {paymentsPagination && (
          <PaginationControls
            page={paymentsPagination.page}
            totalPages={paymentsPagination.totalPages}
            total={paymentsPagination.total}
            pageSize={paymentsPagination.pageSize}
            onPageChange={goToPaymentPage}
          />
        )}
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Cash tracking</div>
        <p style={{ opacity: 0.7, marginTop: -8, marginBottom: 16 }}>Les paiements en espèces restent « En attente » jusqu&apos;à ce que tu les valides manuellement ici.</p>
        <div className="cash-tracking">
          <div>
            <p className="eyebrow">À encaisser ({cashPending.length})</p>
            <div className="cash-tracking__list">
              {cashPending.length === 0 && <span className="cash-tracking__empty">Tous les paiements cash sont validés.</span>}
              {cashPending.map((payment) => (
                <div key={payment.id} className="cash-tracking__item">
                  <div>
                    <strong>{formatCurrency(payment.amountCents / 100)}</strong>
                    <small>{payment.member?.fullName ?? payment.member?.user?.email ?? "Membre"}</small>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <input
                      value={cashNotes[payment.id] ?? ""}
                      onChange={(e) => handleCashNoteChange(payment.id, e.target.value)}
                      placeholder="Référence / note"
                      style={{ borderRadius: 8, border: "1px solid #e5d5cf", padding: "6px 10px" }}
                    />
                    <button className="btn btn--ghost btn--small" type="button" disabled={cashActionLoading === payment.id} onClick={() => handleCashValidation(payment.id)}>
                      {cashActionLoading === payment.id ? "Validation..." : "Marquer encaissé"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Cash validé ({cashPaid.length})</p>
            <div className="cash-tracking__list">
              {cashPaid.length === 0 && <span className="cash-tracking__empty">Valide un paiement cash pour remplir cette section.</span>}
              {cashPaid.map((payment) => (
                <div key={payment.id} className="cash-tracking__item">
                  <div>
                    <strong>{formatCurrency(payment.amountCents / 100)}</strong>
                    <small>{new Date(payment.createdAt).toLocaleDateString("fr-FR")}</small>
                  </div>
                  <span className="focus-tag">{payment.member?.fullName ?? payment.member?.user?.email ?? "Membre"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function CoachSettingsPage() {
  const [profileForm, setProfileForm] = useState<CoachProfileSettings>({
    email: "",
    brandName: "",
    tagline: "",
    logoUrl: "",
    primaryColor: ""
  });
  const [integrationsForm, setIntegrationsForm] = useState<CoachIntegrationSettings>({
    stripePublicKey: "",
    stripeSecretKey: "",
    stripeWebhookSecret: ""
  });
  const [loading, setLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);

  useEffect(() => {
    Promise.all([CoachSettingsApi.profile(), CoachSettingsApi.integrations()])
      .then(([profile, integrations]) => {
        setProfileForm({
          email: profile.email ?? "",
          brandName: profile.brandName ?? "",
          tagline: profile.tagline ?? "",
          logoUrl: profile.logoUrl ?? "",
          primaryColor: profile.primaryColor ?? ""
        });
        setIntegrationsForm({
          stripePublicKey: integrations.stripePublicKey ?? "",
          stripeSecretKey: integrations.stripeSecretKey ?? "",
          stripeWebhookSecret: integrations.stripeWebhookSecret ?? ""
        });
      })
      .catch(() => {
        setProfileStatus({ tone: "error", message: "Impossible de charger les paramètres." });
      })
      .finally(() => setLoading(false));
  }, []);

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileStatus(null);
    try {
      const updated = await CoachSettingsApi.updateProfile(profileForm);
      setProfileForm({
        email: updated.email ?? "",
        brandName: updated.brandName ?? "",
        tagline: updated.tagline ?? "",
        logoUrl: updated.logoUrl ?? "",
        primaryColor: updated.primaryColor ?? ""
      });
      setProfileStatus({ tone: "success", message: "Profil coach mis à jour." });
    } catch (err: any) {
      setProfileStatus({ tone: "error", message: err?.message ?? "Erreur pendant la sauvegarde." });
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitIntegrations(e: FormEvent) {
    e.preventDefault();
    setSavingIntegrations(true);
    setIntegrationStatus(null);
    try {
      const updated = await CoachSettingsApi.updateIntegrations(integrationsForm);
      setIntegrationsForm({
        stripePublicKey: updated.stripePublicKey ?? "",
        stripeSecretKey: updated.stripeSecretKey ?? "",
        stripeWebhookSecret: updated.stripeWebhookSecret ?? ""
      });
      setIntegrationStatus({ tone: "success", message: "Intégrations sauvegardées." });
    } catch (err: any) {
      setIntegrationStatus({ tone: "error", message: err?.message ?? "Erreur pendant la sauvegarde." });
    } finally {
      setSavingIntegrations(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <section className="dashboard-card">
          <p>Chargement des paramètres...</p>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="dashboard-card">
        <div className="dashboard-card__title">Profil coach</div>
        {profileStatus && (
          <div style={{ marginBottom: 12, color: profileStatus.tone === "error" ? "crimson" : "#0f9d58", fontWeight: 600 }}>{profileStatus.message}</div>
        )}
        <form className="cms-form" onSubmit={submitProfile}>
          <div className="cms-grid">
            <div>
              <label>Email</label>
              <input type="email" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} required />
              <label>Nom de la marque</label>
              <input value={profileForm.brandName} onChange={(e) => setProfileForm((prev) => ({ ...prev, brandName: e.target.value }))} required />
              <label>Tagline</label>
              <input value={profileForm.tagline ?? ""} onChange={(e) => setProfileForm((prev) => ({ ...prev, tagline: e.target.value }))} placeholder="Body transformation..." />
            </div>
            <div>
              <label>Logo URL</label>
              <input value={profileForm.logoUrl ?? ""} onChange={(e) => setProfileForm((prev) => ({ ...prev, logoUrl: e.target.value }))} placeholder="https://" />
              <label>Couleur primaire (hex)</label>
              <input value={profileForm.primaryColor ?? ""} onChange={(e) => setProfileForm((prev) => ({ ...prev, primaryColor: e.target.value }))} placeholder="#FF1E1E" />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={savingProfile}>
              {savingProfile ? "Sauvegarde..." : "Enregistrer"}
            </button>
          </div>
        </form>
      </section>

      <section className="dashboard-card">
        <div className="dashboard-card__title">Clés & intégrations</div>
        <p style={{ opacity: 0.75, marginBottom: 12 }}>Stocke ici tes clés Stripe (checkout). Les notifications partent désormais via l'app uniquement.</p>
        {integrationStatus && (
          <div style={{ marginBottom: 12, color: integrationStatus.tone === "error" ? "crimson" : "#0f9d58", fontWeight: 600 }}>{integrationStatus.message}</div>
        )}
        <form className="cms-form" onSubmit={submitIntegrations}>
          <div className="cms-grid">
            <div>
              <label>Stripe public key</label>
              <input value={integrationsForm.stripePublicKey ?? ""} onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, stripePublicKey: e.target.value }))} placeholder="pk_live_..." />
              <label>Stripe secret key</label>
              <input
                type="password"
                value={integrationsForm.stripeSecretKey ?? ""}
                onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, stripeSecretKey: e.target.value }))}
                placeholder="sk_live_..."
              />
              <label>Stripe webhook secret</label>
              <input
                type="password"
                value={integrationsForm.stripeWebhookSecret ?? ""}
                onChange={(e) => setIntegrationsForm((prev) => ({ ...prev, stripeWebhookSecret: e.target.value }))}
                placeholder="whsec_..."
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={savingIntegrations}>
              {savingIntegrations ? "Sauvegarde..." : "Enregistrer les clés"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
