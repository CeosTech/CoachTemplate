import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CoachProgramApi,
  CoachSiteApi,
  OnboardingTemplateApi,
  type MemberSummary,
  type MemberProgress,
  type OnboardingStep,
  type CoachOnboardingTemplate,
  type ProgramPlan
} from "../api/coach";
import { Modal } from "../components/Modal";
import { MEMBER_GOAL_PRESETS, MEMBER_LEVEL_PRESETS } from "../constants/memberPresets";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type MemberDetail = {
  id: string;
  fullName?: string | null;
  goal?: string | null;
  level?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  preferredTraining?: string | null;
  limitations?: string | null;
  programNotes?: string | null;
  followUpNotes?: string | null;
  planUrl?: string | null;
  user?: { email?: string | null; createdAt: string };
  payments: Array<{ id: string; amountCents: number; currency: string; status: string; createdAt: string }>;
  notifications: Array<{ id: string; title: string; status: string; createdAt: string }>;
  memberPacks: Array<{
    id: string;
    status: string;
    totalCredits?: number | null;
    creditsRemaining?: number | null;
    activatedAt: string;
    product?: { id: string; title: string; creditValue?: number | null };
  }>;
};

type StepPreset = {
  label: string;
  title: string;
  description: string;
  dueOffsetDays?: number;
};

const defaultOnboardingPresets: StepPreset[] = [
  {
    label: "Questionnaire détaillé",
    title: "Questionnaire détaillé",
    description: "Remplir le formulaire habitudes + historique blessures.",
    dueOffsetDays: 1
  },
  {
    label: "Photos / mesures",
    title: "Photos / mesures",
    description: "Envoyer 3 photos + mensurations clés.",
    dueOffsetDays: 2
  },
  {
    label: "Connexion outils",
    title: "Connexion outils",
    description: "Partager calendrier, app de tracking ou Google Sheet.",
    dueOffsetDays: 3
  }
];

function offsetToDate(offset?: number) {
  if (offset === undefined || offset === null) return "";
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatDateInput(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function toIsoFromDateInput(value?: string) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00Z`).toISOString();
}

function packHours(pack: MemberDetail["memberPacks"][number]) {
  const total = typeof pack.totalCredits === "number" ? pack.totalCredits : pack.product?.creditValue ?? 0;
  const remaining = typeof pack.creditsRemaining === "number" ? pack.creditsRemaining : total;
  return { total, remaining };
}

export function MemberDirectoryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [selected, setSelected] = useState<MemberDetail | null>(null);
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [goalForm, setGoalForm] = useState({ title: "", targetDate: "", status: "PENDING" });
  const [checkInForm, setCheckInForm] = useState({ metric: "", value: "", notes: "" });
  const [videoForm, setVideoForm] = useState({ url: "", description: "" });
  const [onboardingForm, setOnboardingForm] = useState({
    title: defaultOnboardingPresets[0].title,
    description: defaultOnboardingPresets[0].description,
    dueDate: offsetToDate(defaultOnboardingPresets[0].dueOffsetDays),
    status: "PENDING"
  });
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [editingStep, setEditingStep] = useState<{ id: string; title: string; description: string; dueDate: string; status: string } | null>(null);
  const [editingModalOpen, setEditingModalOpen] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const [filters, setFilters] = useState({ search: "", level: "" });
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    fullName: "",
    goal: "",
    level: "",
    age: "",
    heightCm: "",
    weightKg: ""
  });
  const [creating, setCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [templates, setTemplates] = useState<CoachOnboardingTemplate[]>([]);
  const [templatePresets, setTemplatePresets] = useState<StepPreset[]>(defaultOnboardingPresets);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [programPlans, setProgramPlans] = useState<ProgramPlan[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);
  const [notesForm, setNotesForm] = useState({ programNotes: "", followUpNotes: "" });
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesStatus, setNotesStatus] = useState<string | null>(null);
  const memberGoals = progress?.goals ?? [];
  const memberCheckIns = progress?.checkIns ?? [];
  const memberVideos = progress?.videoNotes ?? [];
  const onboardingSteps = progress?.onboardingSteps ?? [];
  const planLink = selected?.planUrl ? (selected.planUrl.startsWith("http") ? selected.planUrl : `${API_BASE}${selected.planUrl}`) : null;
  const assignedPlan = useMemo(() => {
    if (!selected) return null;
    return programPlans.find((plan) => plan.memberId === selected.id) ?? null;
  }, [programPlans, selected]);
  const onboardingAlertClass = onboardingMessage
    ? `member-alert member-alert--inline ${onboardingMessage.includes("Impossible") ? "member-alert--error" : "member-alert--success"}`
    : null;
  const depletedPacks = selected?.memberPacks?.filter((pack) => packHours(pack).remaining <= 0) ?? [];

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const memberId = params.get("memberId");
    if (memberId) {
      openDetail(memberId);
    }
  }, [location.search]);

  useEffect(() => {
    OnboardingTemplateApi.list()
      .then((list) => {
        setTemplates(list);
        const presets = list.flatMap((template) =>
          template.steps.map((step) => ({
            label: `${template.title} • ${step.title}`,
            title: step.title,
            description: step.description ?? "",
            dueOffsetDays: step.dueOffsetDays ?? undefined
          }))
        );
        if (presets.length) {
          setTemplatePresets(presets);
          setOnboardingForm((prev) =>
            prev.title === defaultOnboardingPresets[0].title
              ? {
                  ...prev,
                  title: presets[0].title,
                  description: presets[0].description,
                  dueDate: presets[0].dueOffsetDays !== undefined ? offsetToDate(presets[0].dueOffsetDays) : prev.dueDate
                }
              : prev
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    setProgramsLoading(true);
    CoachProgramApi.list()
      .then((plans) => {
        if (active) setProgramPlans(plans);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setProgramsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setGoalModalOpen(false);
      setCheckInModalOpen(false);
      setVideoModalOpen(false);
      setOnboardingModalOpen(false);
      setEditingModalOpen(false);
      setEditingStep(null);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setNotesForm({ programNotes: "", followUpNotes: "" });
      setNotesStatus(null);
      setPlanFeedback(null);
      return;
    }
    setNotesForm({
      programNotes: selected.programNotes ?? "",
      followUpNotes: selected.followUpNotes ?? ""
    });
    setNotesStatus(null);
    setPlanFeedback(null);
  }, [selected]);

  useEffect(() => {
    if (!selected) {
      setAssignPlanId("");
      return;
    }
    const plan = programPlans.find((item) => item.memberId === selected.id);
    setAssignPlanId(plan?.id ?? "");
  }, [programPlans, selected]);

  async function loadMembers(params = filters) {
    setLoadingMembers(true);
    try {
      const list = await CoachSiteApi.members({
        search: params.search || undefined,
        level: params.level || undefined
      });
      setMembers(list);
    } catch {
      // swallow
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleCreateMember(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreatedPassword(null);
    if (!createForm.email) {
      setCreateError("Email requis");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        email: createForm.email,
        fullName: createForm.fullName,
        goal: createForm.goal,
        level: createForm.level,
        age: createForm.age ? Number(createForm.age) : undefined,
        heightCm: createForm.heightCm ? Number(createForm.heightCm) : undefined,
        weightKg: createForm.weightKg ? Number(createForm.weightKg) : undefined
      };
      const created = await CoachSiteApi.createMember(payload);
      setCreatedPassword(created.temporaryPassword);
      setCreateForm({ email: "", fullName: "", goal: "", level: "", age: "", heightCm: "", weightKg: "" });
      closeCreateModal();
      loadMembers();
    } catch (err: any) {
      setCreateError(err?.message ?? "Impossible de créer le membre");
    } finally {
      setCreating(false);
    }
  }

  function updateCreateField(field: keyof typeof createForm, value: string) {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateError(null);
  }

  function closeEditingModal() {
    setEditingModalOpen(false);
    setEditingStep(null);
  }

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    loadMembers();
  }

  async function openDetail(id: string) {
    const [detail, prog] = await Promise.all([CoachSiteApi.memberDetail(id), CoachSiteApi.memberProgress(id)]);
    const normalized = {
      ...(detail as MemberDetail),
      memberPacks: (detail as MemberDetail).memberPacks ?? []
    };
    setSelected(normalized);
    setProgress(prog);
    setGoalForm({ title: "", targetDate: "", status: "PENDING" });
    setCheckInForm({ metric: "", value: "", notes: "" });
    setVideoForm({ url: "", description: "" });
  }

  function closeDetail() {
    setSelected(null);
    setProgress(null);
    navigate("/coach/members", { replace: true });
  }

  async function addGoal(e: FormEvent) {
    e.preventDefault();
    if (!selected || !goalForm.title) return;
    const goal = await CoachSiteApi.createGoal(selected.id, goalForm);
    setProgress((prev) => (prev ? { ...prev, goals: [goal, ...prev.goals] } : prev));
    setGoalForm({ title: "", targetDate: "", status: "PENDING" });
    setGoalModalOpen(false);
  }

  async function updateGoalStatus(goalId: string, status: string) {
    if (!selected) return;
    const goal = await CoachSiteApi.updateGoal(selected.id, goalId, { status });
    setProgress((prev) => (prev ? { ...prev, goals: prev.goals.map((g) => (g.id === goal.id ? goal : g)) } : prev));
  }

  async function deleteGoal(goalId: string) {
    if (!selected) return;
    await CoachSiteApi.deleteGoal(selected.id, goalId);
    setProgress((prev) => (prev ? { ...prev, goals: prev.goals.filter((g) => g.id !== goalId) } : prev));
  }

  async function addCheckIn(e: FormEvent) {
    e.preventDefault();
    if (!selected || !checkInForm.metric || !checkInForm.value) return;
    const created = await CoachSiteApi.createCheckIn(selected.id, checkInForm);
    setProgress((prev) => (prev ? { ...prev, checkIns: [created, ...prev.checkIns] } : prev));
    setCheckInForm({ metric: "", value: "", notes: "" });
    setCheckInModalOpen(false);
  }

  async function deleteCheckIn(checkInId: string) {
    if (!selected) return;
    await CoachSiteApi.deleteCheckIn(selected.id, checkInId);
    setProgress((prev) => (prev ? { ...prev, checkIns: prev.checkIns.filter((c) => c.id !== checkInId) } : prev));
  }

  async function addVideo(e: FormEvent) {
    e.preventDefault();
    if (!selected || !videoForm.url) return;
    const note = await CoachSiteApi.createVideoNote(selected.id, videoForm);
    setProgress((prev) => (prev ? { ...prev, videoNotes: [note, ...prev.videoNotes] } : prev));
    setVideoForm({ url: "", description: "" });
    setVideoModalOpen(false);
  }

  async function deleteVideo(videoId: string) {
    if (!selected) return;
    await CoachSiteApi.deleteVideoNote(selected.id, videoId);
    setProgress((prev) => (prev ? { ...prev, videoNotes: prev.videoNotes.filter((v) => v.id !== videoId) } : prev));
  }

  function updateNotesField(field: keyof typeof notesForm, value: string) {
    setNotesForm((prev) => ({ ...prev, [field]: value }));
  }

  async function saveCoachNotes(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setNotesSaving(true);
    setNotesStatus(null);
    try {
      const payload = await CoachSiteApi.updateMemberNotes(selected.id, {
        programNotes: notesForm.programNotes,
        followUpNotes: notesForm.followUpNotes
      });
      setSelected((prev) => (prev ? { ...prev, programNotes: payload.programNotes ?? null, followUpNotes: payload.followUpNotes ?? null, planUrl: payload.planUrl ?? prev.planUrl } : prev));
      setProgress((prev) =>
        prev && prev.member
          ? { ...prev, member: { ...prev.member, programNotes: payload.programNotes ?? null, followUpNotes: payload.followUpNotes ?? null, planUrl: payload.planUrl ?? prev.member.planUrl ?? null } }
          : prev
      );
      setNotesStatus("Notes enregistrées.");
    } catch (err: any) {
      setNotesStatus(err?.message ?? "Impossible d'enregistrer.");
    } finally {
      setNotesSaving(false);
    }
  }

  async function handleAssignPlan() {
    if (!selected || !assignPlanId) return;
    setAssigningPlan(true);
    setPlanFeedback(null);
    try {
      const updated = await CoachProgramApi.assign(assignPlanId, selected.id);
      setProgramPlans((prev) => prev.map((plan) => (plan.id === updated.id ? updated : plan)));
      setPlanFeedback("Programme assigné ✅");
      setSelected((prev) => (prev ? { ...prev, planUrl: updated.sharePath } : prev));
      setProgress((prev) =>
        prev && prev.member ? { ...prev, member: { ...prev.member, planUrl: updated.sharePath } } : prev
      );
    } catch (err: any) {
      setPlanFeedback(err?.message ?? "Impossible d'assigner ce programme.");
    } finally {
      setAssigningPlan(false);
    }
  }

  function updateOnboardingCollection(updater: (steps: OnboardingStep[]) => OnboardingStep[]) {
    setProgress((prev) => (prev ? { ...prev, onboardingSteps: updater(prev.onboardingSteps ?? []) } : prev));
  }

  function resetOnboardingForm(templateIndex = 0) {
    const template = templatePresets[templateIndex] ?? defaultOnboardingPresets[templateIndex] ?? defaultOnboardingPresets[0];
    setOnboardingForm({
      title: template.title,
      description: template.description,
      dueDate: template.dueOffsetDays !== undefined ? offsetToDate(template.dueOffsetDays) : "",
      status: "PENDING"
    });
  }

  function applyTemplateToForm(label: string) {
    const template = templatePresets.find((tpl) => tpl.label === label) ?? defaultOnboardingPresets.find((tpl) => tpl.label === label);
    if (template) {
      setOnboardingForm({
        title: template.title,
        description: template.description,
        dueDate: template.dueOffsetDays !== undefined ? offsetToDate(template.dueOffsetDays) : "",
        status: "PENDING"
      });
    }
  }

  async function applyTemplateToMember() {
    if (!selected || !selectedTemplateId) return;
    setApplyingTemplate(true);
    setOnboardingMessage(null);
    try {
      const steps = await OnboardingTemplateApi.applyToMember(selected.id, selectedTemplateId);
      setProgress((prev) => (prev ? { ...prev, onboardingSteps: steps as OnboardingStep[] } : prev));
      setSelectedTemplateId("");
      setOnboardingMessage("Template appliqué ✅");
    } catch (err: any) {
      setOnboardingMessage(err?.message ?? "Impossible d'appliquer le template.");
    } finally {
      setApplyingTemplate(false);
    }
  }

  async function addOnboardingStep(e: FormEvent) {
    e.preventDefault();
    if (!selected || !onboardingForm.title) return;
    setOnboardingBusy(true);
    setOnboardingMessage(null);
    try {
      const payload = {
        title: onboardingForm.title,
        description: onboardingForm.description || undefined,
        status: onboardingForm.status || undefined,
        dueDate: toIsoFromDateInput(onboardingForm.dueDate)
      };
      const created = (await CoachSiteApi.createOnboardingStep(selected.id, payload)) as OnboardingStep;
      updateOnboardingCollection((steps) => [...steps, created]);
      resetOnboardingForm();
      setOnboardingModalOpen(false);
      setOnboardingMessage("Étape ajoutée.");
    } catch (err: any) {
      setOnboardingMessage(err?.message ?? "Impossible d'ajouter l'étape.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  function startEditOnboarding(step: OnboardingStep) {
    setEditingStep({
      id: step.id,
      title: step.title,
      description: step.description ?? "",
      dueDate: formatDateInput(step.dueDate),
      status: step.status ?? "PENDING"
    });
    setOnboardingMessage(null);
    setEditingModalOpen(true);
  }

  async function submitEditingOnboarding(e: FormEvent) {
    e.preventDefault();
    if (!selected || !editingStep) return;
    setEditingBusy(true);
    setOnboardingMessage(null);
    try {
      const payload = {
        title: editingStep.title,
        description: editingStep.description,
        status: editingStep.status,
        dueDate: toIsoFromDateInput(editingStep.dueDate)
      };
      const updated = (await CoachSiteApi.updateOnboardingStep(selected.id, editingStep.id, payload)) as OnboardingStep;
      updateOnboardingCollection((steps) => steps.map((step) => (step.id === updated.id ? updated : step)));
      closeEditingModal();
      setOnboardingMessage("Étape mise à jour.");
    } catch (err: any) {
      setOnboardingMessage(err?.message ?? "Impossible de mettre à jour l'étape.");
    } finally {
      setEditingBusy(false);
    }
  }

  async function updateOnboardingStatus(step: OnboardingStep, status: string) {
    if (!selected) return;
    setOnboardingMessage(null);
    try {
      const updated = (await CoachSiteApi.updateOnboardingStep(selected.id, step.id, { status })) as OnboardingStep;
      updateOnboardingCollection((steps) => steps.map((current) => (current.id === updated.id ? updated : current)));
    } catch (err: any) {
      setOnboardingMessage(err?.message ?? "Impossible de mettre à jour le statut.");
    }
  }

  async function deleteOnboardingStep(stepId: string) {
    if (!selected) return;
    setOnboardingMessage(null);
    try {
      await CoachSiteApi.deleteOnboardingStep(selected.id, stepId);
      updateOnboardingCollection((steps) => steps.filter((step) => step.id !== stepId));
      if (editingStep?.id === stepId) {
        closeEditingModal();
      }
    } catch (err: any) {
      setOnboardingMessage(err?.message ?? "Suppression impossible.");
    }
  }

  return (
    <>
      <div className="dashboard member-directory">
        <section className="dashboard-card member-directory__hero">
          <div>
            <p className="eyebrow">Fichiers adhérents</p>
            <h2>Pilotage business & suivi en un coup d'œil</h2>
            <p>Filtres rapides, fiche détaillée et actions clés accessibles en deux clics.</p>
          </div>
          <div className="hero-ctas">
            <button className="btn" onClick={() => setCreateModalOpen(true)}>
              + Ajouter un adhérent
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => loadMembers()}>
              Rafraîchir la liste
            </button>
          </div>
        </section>

        {createdPassword && (
          <div className="member-alert" role="status">
            <div>
              <strong>Accès créé</strong>
              <p>
                Mot de passe provisoire: <span className="member-alert__code">{createdPassword}</span>
              </p>
            </div>
            <button className="member-alert__dismiss" type="button" aria-label="Fermer l'alerte" onClick={() => setCreatedPassword(null)}>
              ×
            </button>
          </div>
        )}

        <section className="dashboard-card">
          <div className="dashboard-card__title">Filtrer les adhérents</div>
          <form className="cms-form" onSubmit={applyFilters}>
            <div className="cms-grid">
              <div>
                <label>Recherche</label>
                <input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Nom, email, objectif..." />
              </div>
              <div>
                <label>Niveau</label>
                <input value={filters.level} onChange={(e) => setFilters((prev) => ({ ...prev, level: e.target.value }))} placeholder="Débutant, Avancé..." />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn--ghost" type="submit">
                Appliquer
              </button>
              <button
                className="btn btn--outline btn--small"
                type="button"
                onClick={() => {
                  setFilters({ search: "", level: "" });
                  loadMembers({ search: "", level: "" });
                }}
              >
                Réinitialiser
              </button>
            </div>
          </form>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card__title">Liste des adhérents ({members.length})</div>
          <div className="member-table">
            <div className="member-table__header">
              <div>Nom</div>
              <div>Email</div>
              <div>Objectif</div>
              <div>Niveau</div>
              <div>Statut</div>
            </div>
            {loadingMembers && <div style={{ padding: 16 }}>Chargement...</div>}
            {!loadingMembers &&
              members.map((member) => (
                <button key={member.id} className="member-table__row" onClick={() => openDetail(member.id)}>
                  <div>{member.fullName ?? "Anonyme"}</div>
                  <div>{member.user?.email}</div>
                  <div>{member.goal ?? "-"}</div>
                  <div>{member.level ?? "-"}</div>
                  <div className="member-table__badges">
                    {!member.isActivated && <span className="focus-tag focus-tag--warning">À activer</span>}
                    {member.hasActiveCredits ? (
                      <span className="focus-tag focus-tag--success">{(member.totalCreditsRemaining ?? 0).toString()}h restantes</span>
                    ) : (member.activePackCount ?? 0) > 0 || member.lastPackTitle ? (
                      <span className="focus-tag focus-tag--warning">Pack à relancer</span>
                    ) : (
                      <span className="focus-tag focus-tag--ghost">Inscription en ligne</span>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </section>

        {selected && (
          <>
            <section className="dashboard-card">
              <div className="dashboard-card__title member-detail__title">
                <span>
                  {selected.fullName} — {selected.user?.email}
                </span>
                <div className="member-card__actions">
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => window.open(CoachSiteApi.memberRecapUrl(selected.id), "_blank")}>
                    Exporter le PDF recap
                  </button>
                  <button className="btn btn--outline btn--small" type="button" onClick={closeDetail}>
                    Fermer
                  </button>
                </div>
              </div>
              <div className="member-detail-grid">
                <article className="member-card member-card--profile">
                  <div className="member-card__header">
                    <p className="eyebrow">Profil</p>
                    {selected.user?.createdAt && <small className="member-card__sub">Inscrit le {new Date(selected.user.createdAt).toLocaleDateString("fr-FR")}</small>}
                  </div>
                  <dl className="member-card__meta">
                    <div>
                      <dt>Objectif</dt>
                      <dd>{selected.goal ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Niveau</dt>
                      <dd>{selected.level ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Préférences</dt>
                      <dd>{selected.preferredTraining ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Limitations</dt>
                      <dd>{selected.limitations ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Âge</dt>
                      <dd>{selected.age ?? "—"} ans</dd>
                    </div>
                    <div>
                      <dt>Taille</dt>
                      <dd>{selected.heightCm ?? "—"} cm</dd>
                    </div>
                    <div>
                      <dt>Poids</dt>
                      <dd>{selected.weightKg ?? "—"} kg</dd>
                    </div>
                  </dl>
                </article>

                <article className="member-card">
                  <div className="member-card__header">
                    <p className="eyebrow">Programme & suivi</p>
                  </div>
                  <form className="member-notes" onSubmit={saveCoachNotes}>
                    <div className="member-card__section">
                      <strong>Programme actuel</strong>
                      <textarea value={notesForm.programNotes} onChange={(e) => updateNotesField("programNotes", e.target.value)} placeholder="Bloc en cours, rappels de charge, etc." />
                      {planLink && (
                        <a className="btn btn--ghost btn--small" href={planLink} target="_blank" rel="noreferrer">
                          Voir le plan partagé
                        </a>
                      )}
                      {assignedPlan && <small className="member-card__sub">Plan assigné: {assignedPlan.title}</small>}
                    </div>
                    <div className="member-card__section">
                      <strong>Suivi hebdo</strong>
                      <textarea value={notesForm.followUpNotes} onChange={(e) => updateNotesField("followUpNotes", e.target.value)} placeholder="Notes envoyées après check-in, points officiels..." />
                    </div>
                    <div className="member-notes__actions">
                      <button className="btn btn--small" type="submit" disabled={notesSaving}>
                        {notesSaving ? "Enregistrement..." : "Enregistrer les notes"}
                      </button>
                      {notesStatus && <span className={`member-hint${/impossible/i.test(notesStatus) ? " member-hint--error" : ""}`}>{notesStatus}</span>}
                    </div>
                  </form>
                  <div className="member-card__section">
                    <strong>Assigner un programme</strong>
                    {programsLoading ? (
                      <p className="member-card__sub">Chargement des plans...</p>
                    ) : programPlans.length === 0 ? (
                      <p className="member-card__sub">Crée ton premier plan dans Program Builder pour pouvoir l&apos;assigner ici.</p>
                    ) : (
                      <>
                        <div className="assign-panel">
                          <div className="assign-panel__form">
                            <select value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)}>
                              <option value="">Choisir un programme</option>
                              {programPlans.map((plan) => (
                                <option key={plan.id} value={plan.id}>
                                  {plan.title}
                                  {plan.memberId && plan.memberId !== selected.id ? ` • ${plan.member?.fullName ?? "assigné"}` : ""}
                                </option>
                              ))}
                            </select>
                            <button className="btn btn--ghost" type="button" onClick={handleAssignPlan} disabled={!assignPlanId || assigningPlan}>
                              {assigningPlan ? "Assignation..." : "Assigner"}
                            </button>
                          </div>
                        </div>
                        {planFeedback && <p className={`member-hint${/impossible/i.test(planFeedback) ? " member-hint--error" : ""}`}>{planFeedback}</p>}
                      </>
                    )}
                  </div>
                </article>

                <article className="member-card">
                  <div className="member-card__header">
                    <p className="eyebrow">Paiements & notifications</p>
                  </div>
                  <div className="member-card__section">
                    <strong>Paiements récents</strong>
                    <ul className="member-card__list">
                      {selected.payments.length === 0 && <li className="member-card__empty">Aucun paiement enregistré.</li>}
                      {selected.payments.map((payment) => (
                        <li key={payment.id}>
                          <div className="member-card__list-line">
                            <strong>{(payment.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: payment.currency })}</strong>
                            <small>{new Date(payment.createdAt).toLocaleDateString("fr-FR")}</small>
                          </div>
                          <span className="focus-tag">{payment.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="member-card__section">
                    <strong>Notifications envoyées</strong>
                    <ul className="member-card__list">
                      {selected.notifications.length === 0 && <li className="member-card__empty">Pas encore de notifications.</li>}
                      {selected.notifications.map((notif) => (
                        <li key={notif.id}>
                          <div className="member-card__list-line">
                            <strong>{notif.title}</strong>
                            <small>{new Date(notif.createdAt).toLocaleDateString("fr-FR")}</small>
                          </div>
                          <span className="focus-tag">{notif.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>

                <article className="member-card">
                  <div className="member-card__header">
                    <p className="eyebrow">Packs & crédits</p>
                  </div>
                  {depletedPacks.length > 0 && (
                    <div className="member-card__alert">
                      {depletedPacks.length === 1
                        ? `Le pack ${depletedPacks[0].product?.title ?? ""} est épuisé. Relance ${selected.fullName} pour renouveler.`
                        : "Plusieurs packs sont épuisés — pense à proposer un renouvellement."}
                    </div>
                  )}
                  {selected.memberPacks.length === 0 && <div className="member-card__empty">Aucun pack acheté pour l'instant.</div>}
                  {selected.memberPacks.length > 0 && (
                    <div className="pack-grid pack-grid--compact">
                      {selected.memberPacks.map((pack) => {
                        const { total, remaining } = packHours(pack);
                        const isDepleted = remaining <= 0;
                        return (
                          <div key={pack.id} className={`pack-card${isDepleted ? " pack-card--warning" : ""}`}>
                            <div className="pack-card__title">{pack.product?.title ?? "Pack"}</div>
                            <div className="pack-card__hours">
                              <strong>{remaining}</strong>
                              <span>h restantes</span>
                            </div>
                            <div className="pack-card__meta">
                              {total ? `${total}h au total` : "Crédits illimités"} · Activé le {new Date(pack.activatedAt).toLocaleDateString("fr-FR")}
                            </div>
                            <div className="pack-card__status">{pack.status}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </div>
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card__title member-detail__title">
                <span>Suivi avancé — {selected.fullName}</span>
                <div className="member-card__actions">
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => setGoalModalOpen(true)}>
                    + Objectif
                  </button>
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => setOnboardingModalOpen(true)}>
                    + Étape onboarding
                  </button>
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => setCheckInModalOpen(true)}>
                    + Check-in
                  </button>
                  <button className="btn btn--ghost btn--small" type="button" onClick={() => setVideoModalOpen(true)}>
                    + Note vidéo
                  </button>
                </div>
              </div>
              <div className="member-detail-grid member-detail-grid--stretch">
                <article className="member-card member-card--focus">
                  <div className="member-card__header">
                    <div>
                      <p className="eyebrow">Objectifs & recap</p>
                      <p className="member-card__sub">Définis des jalons et envoie un PDF récapitulatif.</p>
                    </div>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => setGoalModalOpen(true)}>
                      Ajouter
                    </button>
                  </div>
                  <div className="focus-list">
                    {memberGoals.map((goal) => (
                      <div key={goal.id} className="focus-item">
                        <div>
                          <strong>{goal.title}</strong>
                          <p>Cible: {goal.targetDate ? new Date(goal.targetDate).toLocaleDateString("fr-FR") : "-"}</p>
                        </div>
                        <div className="member-card__actions">
                          <select value={goal.status} onChange={(e) => updateGoalStatus(goal.id, e.target.value)}>
                            <option value="PENDING">À lancer</option>
                            <option value="IN_PROGRESS">En cours</option>
                            <option value="DONE">Terminé</option>
                          </select>
                          <button className="btn btn--outline btn--small" type="button" onClick={() => deleteGoal(goal.id)}>
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    {memberGoals.length === 0 && <div className="member-card__empty">Aucun objectif pour l&apos;instant.</div>}
                  </div>
                  <button className="btn btn--block" type="button" onClick={() => window.open(CoachSiteApi.memberRecapUrl(selected.id), "_blank")}>
                    Générer le PDF recap
                  </button>
                </article>

                <article className="member-card member-card--onboarding">
                  <div className="member-card__header">
                    <div>
                      <p className="eyebrow">Checklist onboarding</p>
                      <p className="member-card__sub">Pilote questionnaire, photos et connexions.</p>
                    </div>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => setOnboardingModalOpen(true)}>
                      Ajouter
                    </button>
                  </div>
                  {onboardingAlertClass && <div className={onboardingAlertClass}>{onboardingMessage}</div>}
                  {templates.length > 0 && (
                    <div className="assign-panel">
                      <h4>Appliquer un template complet</h4>
                      <div className="assign-panel__form">
                        <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                          <option value="">Choisir un template</option>
                          {templates.map((tpl) => (
                            <option key={tpl.id} value={tpl.id}>
                              {tpl.title} • {tpl.steps.length} étapes
                            </option>
                          ))}
                        </select>
                        <button className="btn btn--ghost" type="button" onClick={applyTemplateToMember} disabled={!selectedTemplateId || applyingTemplate}>
                          {applyingTemplate ? "Ajout..." : "Appliquer"}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="focus-list">
                    {onboardingSteps.map((step) => (
                      <div key={step.id} className="focus-item">
                        <div>
                          <strong>{step.title}</strong>
                          {step.description && <p>{step.description}</p>}
                          <p style={{ fontSize: 12, opacity: 0.75 }}>
                            {step.status} {step.dueDate ? `• Due ${new Date(step.dueDate).toLocaleDateString("fr-FR")}` : ""}
                          </p>
                        </div>
                        <div className="member-card__actions">
                          <select value={step.status} onChange={(e) => updateOnboardingStatus(step, e.target.value)}>
                            <option value="PENDING">À faire</option>
                            <option value="COMPLETED">Terminé</option>
                            <option value="SKIPPED">À replanifier</option>
                          </select>
                          <button className="btn btn--ghost btn--small" type="button" onClick={() => startEditOnboarding(step)}>
                            Modifier
                          </button>
                          <button className="btn btn--outline btn--small" type="button" onClick={() => deleteOnboardingStep(step.id)}>
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ))}
                    {onboardingSteps.length === 0 && <div className="member-card__empty">En attente des étapes automatiques.</div>}
                  </div>
                </article>

                <article className="member-card">
                  <div className="member-card__header">
                    <div>
                      <p className="eyebrow">Check-ins biométriques</p>
                      <p className="member-card__sub">Mensurations, HRV, poids...</p>
                    </div>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => setCheckInModalOpen(true)}>
                      Ajouter
                    </button>
                  </div>
                  <ul className="member-card__list">
                    {memberCheckIns.map((check) => (
                      <li key={check.id}>
                        <div>
                          <strong>{check.metric}</strong>
                          <p>
                            {check.value} — {new Date(check.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                          <small>{check.notes ?? "—"}</small>
                        </div>
                        <div className="member-card__actions">
                          <button className="btn btn--outline btn--small" type="button" onClick={() => deleteCheckIn(check.id)}>
                            Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                    {memberCheckIns.length === 0 && <li className="member-card__empty">Pas encore de check-in.</li>}
                  </ul>
                </article>

                <article className="member-card">
                  <div className="member-card__header">
                    <div>
                      <p className="eyebrow">Notes vidéo</p>
                      <p className="member-card__sub">Ajoute un Loom ou YouTube à consulter plus tard.</p>
                    </div>
                    <button className="btn btn--outline btn--small" type="button" onClick={() => setVideoModalOpen(true)}>
                      Ajouter
                    </button>
                  </div>
                  <ul className="member-card__list">
                    {memberVideos.map((note) => (
                      <li key={note.id}>
                        <div>
                          <a href={note.url} target="_blank" rel="noreferrer">
                            {note.description ?? note.url}
                          </a>
                          <small>{new Date(note.createdAt).toLocaleDateString("fr-FR")}</small>
                        </div>
                        <div className="member-card__actions">
                          <button className="btn btn--outline btn--small" type="button" onClick={() => deleteVideo(note.id)}>
                            Supprimer
                          </button>
                        </div>
                      </li>
                    ))}
                    {memberVideos.length === 0 && <li className="member-card__empty">Pas encore de notes.</li>}
                  </ul>
                </article>
              </div>
            </section>
          </>
        )}
      </div>

      <Modal open={createModalOpen} onClose={closeCreateModal} title="Ajouter un adhérent">
        {createError && <div className="member-alert member-alert--inline member-alert--error">{createError}</div>}
        <form className="cms-form" onSubmit={handleCreateMember}>
          <div className="cms-grid">
            <div>
              <label>Nom complet</label>
              <input value={createForm.fullName} onChange={(e) => updateCreateField("fullName", e.target.value)} placeholder="Nom et prénom" />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={createForm.email} onChange={(e) => updateCreateField("email", e.target.value)} placeholder="email@exemple.com" required />
            </div>
            <div>
              <label>Objectif</label>
              <input list="member-goal-presets" value={createForm.goal} onChange={(e) => updateCreateField("goal", e.target.value)} placeholder="Recomposition, performance..." />
            </div>
            <div>
              <label>Niveau</label>
              <input list="member-level-presets" value={createForm.level} onChange={(e) => updateCreateField("level", e.target.value)} placeholder="Débutant / Avancé..." />
            </div>
            <div>
              <label>Âge</label>
              <input value={createForm.age} onChange={(e) => updateCreateField("age", e.target.value)} placeholder="Âge" />
            </div>
            <div>
              <label>Taille (cm)</label>
              <input value={createForm.heightCm} onChange={(e) => updateCreateField("heightCm", e.target.value)} placeholder="Taille (cm)" />
            </div>
            <div>
              <label>Poids (kg)</label>
              <input value={createForm.weightKg} onChange={(e) => updateCreateField("weightKg", e.target.value)} placeholder="Poids (kg)" />
            </div>
          </div>
          <div className="modal-card__actions">
            <button className="btn" type="submit" disabled={creating}>
              {creating ? "Création..." : "Créer l&apos;adhérent"}
            </button>
            <button className="btn btn--ghost" type="button" onClick={closeCreateModal}>
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={goalModalOpen && Boolean(selected)} onClose={() => setGoalModalOpen(false)} title="Nouvel objectif">
        {selected ? (
          <form className="cms-form" onSubmit={addGoal}>
            <label>
              Titre
              <input value={goalForm.title} onChange={(e) => setGoalForm((prev) => ({ ...prev, title: e.target.value }))} required />
            </label>
            <label>
              Date cible
              <input type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((prev) => ({ ...prev, targetDate: e.target.value }))} />
            </label>
            <label>
              Statut
              <select value={goalForm.status} onChange={(e) => setGoalForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="PENDING">À lancer</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="DONE">Terminé</option>
              </select>
            </label>
            <div className="modal-card__actions">
              <button className="btn" type="submit">
                Enregistrer
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setGoalModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p>Sélectionne un adhérent pour créer un objectif.</p>
        )}
      </Modal>

      <Modal open={onboardingModalOpen && Boolean(selected)} onClose={() => setOnboardingModalOpen(false)} title="Ajouter une étape d'onboarding">
        {selected ? (
          <form className="cms-form" onSubmit={addOnboardingStep}>
            <label>
              Preset rapide
              <select defaultValue="" onChange={(e) => e.target.value && applyTemplateToForm(e.target.value)}>
                <option value="">Choisir un preset</option>
                {templatePresets.map((tpl) => (
                  <option key={tpl.label} value={tpl.label}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Titre
              <input value={onboardingForm.title} onChange={(e) => setOnboardingForm((prev) => ({ ...prev, title: e.target.value }))} required />
            </label>
            <label>
              Description
              <textarea value={onboardingForm.description} onChange={(e) => setOnboardingForm((prev) => ({ ...prev, description: e.target.value }))} />
            </label>
            <div className="cms-grid">
              <label>
                Échéance
                <input type="date" value={onboardingForm.dueDate} onChange={(e) => setOnboardingForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
              </label>
              <label>
                Statut
                <select value={onboardingForm.status} onChange={(e) => setOnboardingForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="PENDING">À faire</option>
                  <option value="COMPLETED">Terminé</option>
                  <option value="SKIPPED">À replanifier</option>
                </select>
              </label>
            </div>
            <div className="modal-card__actions">
              <button className="btn" type="submit" disabled={onboardingBusy}>
                {onboardingBusy ? "Ajout..." : "Enregistrer"}
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setOnboardingModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p>Sélectionne un adhérent pour ajouter une étape.</p>
        )}
      </Modal>

      <Modal open={editingModalOpen && Boolean(editingStep)} onClose={closeEditingModal} title="Modifier l'étape">
        {editingStep ? (
          <form className="cms-form" onSubmit={submitEditingOnboarding}>
            <label>
              Titre
              <input value={editingStep.title} onChange={(e) => setEditingStep((prev) => (prev ? { ...prev, title: e.target.value } : prev))} required />
            </label>
            <label>
              Description
              <textarea value={editingStep.description} onChange={(e) => setEditingStep((prev) => (prev ? { ...prev, description: e.target.value } : prev))} />
            </label>
            <div className="cms-grid">
              <label>
                Échéance
                <input type="date" value={editingStep.dueDate} onChange={(e) => setEditingStep((prev) => (prev ? { ...prev, dueDate: e.target.value } : prev))} />
              </label>
              <label>
                Statut
                <select value={editingStep.status} onChange={(e) => setEditingStep((prev) => (prev ? { ...prev, status: e.target.value } : prev))}>
                  <option value="PENDING">À faire</option>
                  <option value="COMPLETED">Terminé</option>
                  <option value="SKIPPED">À replanifier</option>
                </select>
              </label>
            </div>
            <div className="modal-card__actions">
              <button className="btn" type="submit" disabled={editingBusy}>
                {editingBusy ? "Sauvegarde..." : "Mettre à jour"}
              </button>
              <button className="btn btn--ghost" type="button" onClick={closeEditingModal}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p>Aucune étape sélectionnée.</p>
        )}
      </Modal>

      <Modal open={checkInModalOpen && Boolean(selected)} onClose={() => setCheckInModalOpen(false)} title="Nouveau check-in biométrique">
        {selected ? (
          <form className="cms-form" onSubmit={addCheckIn}>
            <label>
              Métrique
              <input value={checkInForm.metric} onChange={(e) => setCheckInForm((prev) => ({ ...prev, metric: e.target.value }))} required />
            </label>
            <label>
              Valeur
              <input value={checkInForm.value} onChange={(e) => setCheckInForm((prev) => ({ ...prev, value: e.target.value }))} required />
            </label>
            <label>
              Notes
              <textarea value={checkInForm.notes} onChange={(e) => setCheckInForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <div className="modal-card__actions">
              <button className="btn" type="submit">
                Ajouter
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setCheckInModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p>Sélectionne un adhérent pour ajouter un check-in.</p>
        )}
      </Modal>

      <Modal open={videoModalOpen && Boolean(selected)} onClose={() => setVideoModalOpen(false)} title="Nouvelle note vidéo">
        {selected ? (
          <form className="cms-form" onSubmit={addVideo}>
            <label>
              URL (Loom, YouTube...)
              <input value={videoForm.url} onChange={(e) => setVideoForm((prev) => ({ ...prev, url: e.target.value }))} required />
            </label>
            <label>
              Commentaire
              <textarea value={videoForm.description} onChange={(e) => setVideoForm((prev) => ({ ...prev, description: e.target.value }))} />
            </label>
            <div className="modal-card__actions">
              <button className="btn" type="submit">
                Ajouter
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setVideoModalOpen(false)}>
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <p>Sélectionne un adhérent pour ajouter une note vidéo.</p>
        )}
      </Modal>
      <datalist id="member-goal-presets">
        {MEMBER_GOAL_PRESETS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
      <datalist id="member-level-presets">
        {MEMBER_LEVEL_PRESETS.map((preset) => (
          <option key={preset} value={preset} />
        ))}
      </datalist>
    </>
  );
}
