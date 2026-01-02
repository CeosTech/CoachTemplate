import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardNav } from "../components/DashboardNav";
import {
  CoachProgramApi,
  CoachSiteApi,
  type MemberSummary,
  type ProgramPlan,
  type ProgramPlanPayload,
  type ProgramSharePayload
} from "../api/coach";
import { Modal } from "../components/Modal";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

type Exercise = {
  id: string;
  name: string;
  sets: string;
  reps: string;
  tempo?: string;
  rest?: string;
  notes?: string;
};

type WorkoutBlock = {
  id: string;
  day: string;
  focus: string;
  notes?: string;
  exercises: Exercise[];
};

const defaultWorkout = (): WorkoutBlock => ({
  id: makeId(),
  day: "Jour 1",
  focus: "Force / Lower",
  notes: "",
  exercises: [
    { id: makeId(), name: "Back Squat", sets: "5", reps: "5", tempo: "31X1", rest: "150s", notes: "90% 1RM" },
    { id: makeId(), name: "Romanian Deadlift", sets: "4", reps: "8", tempo: "3010", rest: "90s" }
  ]
});

function buildLocalShareText({
  title,
  goal,
  deliveryNotes,
  workouts,
  link
}: {
  title: string;
  goal?: string;
  deliveryNotes?: string;
  workouts: WorkoutBlock[];
  link?: string;
}) {
  const sections = workouts.map((block, idx) => {
    const exercises = block.exercises
      .map((exercise, index) => {
        const details: string[] = [];
        if (exercise.sets || exercise.reps) details.push(`${exercise.sets} x ${exercise.reps}`);
        if (exercise.tempo) details.push(`tempo ${exercise.tempo}`);
        if (exercise.rest) details.push(`repos ${exercise.rest}`);
        if (exercise.notes) details.push(exercise.notes);
        return `${index + 1}. ${exercise.name || "Exercice"} — ${details.join(" • ")}`;
      })
      .join("\n");
    return `Jour ${idx + 1}: ${block.day} • ${block.focus}\n${exercises}${block.notes ? `\nNotes: ${block.notes}` : ""}`;
  });
  const pieces = [
    `Programme: ${title}`,
    goal ? `Objectif: ${goal}` : null,
    deliveryNotes ? `Notes: ${deliveryNotes}` : null,
    "",
    sections.join("\n\n"),
    link ? `Lien: ${link}` : null
  ].filter(Boolean);
  return pieces.join("\n");
}

export function ProgramBuilderPage() {
  const navigate = useNavigate();
  const [programName, setProgramName] = useState("Bloc Hybrid Elite");
  const [goal, setGoal] = useState("Force + Conditioning");
  const [deliveryNotes, setDeliveryNotes] = useState("Périodisation 6 semaines, charge progressive + auto-regulation RPE.");
  const [workouts, setWorkouts] = useState<WorkoutBlock[]>([defaultWorkout()]);
  const [editingBlock, setEditingBlock] = useState<WorkoutBlock | null>(null);
  const [programs, setPrograms] = useState<ProgramPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [assignMemberId, setAssignMemberId] = useState<string>("");
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [shareInfo, setShareInfo] = useState<ProgramSharePayload | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [list, memberList] = await Promise.all([CoachProgramApi.list(), CoachSiteApi.members()]);
        if (!active) return;
        setPrograms(list);
        setMembers(memberList);
        if (list.length > 0) {
          hydrateFromPlan(list[0]);
        }
      } catch {
        if (active) setStatus({ tone: "error", message: "Impossible de charger les programmes." });
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const selectedPlan = useMemo(() => programs.find((plan) => plan.id === selectedPlanId) ?? null, [programs, selectedPlanId]);

  const loadShareInfo = useCallback(async (planId: string) => {
    setShareLoading(true);
    setShareError(null);
    try {
      const payload = await CoachProgramApi.exportShare(planId);
      setShareInfo(payload);
    } catch (err: any) {
      setShareInfo(null);
      setShareError(err?.message ?? "Impossible de générer le partage.");
    } finally {
      setShareLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shareModalOpen || !selectedPlanId) {
      if (!shareModalOpen) {
        setShareInfo(null);
        setShareError(null);
      }
      return;
    }
    loadShareInfo(selectedPlanId);
  }, [selectedPlanId, shareModalOpen, loadShareInfo]);

  const shareLink = shareInfo?.shareLink ?? (selectedPlan ? `${API_BASE}${selectedPlan.sharePath}` : "");
  const baseSharePayload = { title: programName, goal, deliveryNotes, workouts, link: shareLink };
  const shareText = shareInfo?.shareText ?? buildLocalShareText(baseSharePayload);
  const mailLink = shareInfo?.mailto ?? `mailto:?subject=${encodeURIComponent(programName)}&body=${encodeURIComponent(shareText)}`;
  const whatsappLink = shareInfo?.whatsapp ?? `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const qrPayload = shareInfo?.qrPayload ?? (shareLink || shareText);
  const qrLink = `https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encodeURIComponent(qrPayload)}`;

  function resetForm() {
    setSelectedPlanId(null);
    setProgramName("Bloc Hybrid Elite");
    setGoal("Force + Conditioning");
    setDeliveryNotes("Périodisation 6 semaines, charge progressive + auto-regulation RPE.");
    const fresh = defaultWorkout();
    setWorkouts([fresh]);
    setEditingBlock(null);
    setAssignMemberId("");
    setStatus(null);
    setShareInfo(null);
    setShareError(null);
  }

  function hydrateFromPlan(plan: ProgramPlan) {
    setSelectedPlanId(plan.id);
    setProgramName(plan.title);
    setGoal(plan.goal ?? "");
    setDeliveryNotes(plan.deliveryNotes ?? "");
    setAssignMemberId(plan.memberId ?? "");
    setWorkouts(
      plan.workouts.length > 0
        ? plan.workouts.map((block, idx) => ({
            id: block.id ?? makeId() + idx,
            day: block.day ?? `Jour ${idx + 1}`,
            focus: block.focus ?? "Bloc personnalisé",
            notes: block.notes ?? "",
            exercises: (block.exercises ?? []).map((exercise, index) => ({
              id: exercise.id ?? `${makeId()}-${index}`,
              name: exercise.name ?? "",
              sets: exercise.sets ?? "",
              reps: exercise.reps ?? "",
              tempo: exercise.tempo ?? "",
              rest: exercise.rest ?? "",
              notes: exercise.notes ?? ""
            }))
          }))
        : [defaultWorkout()]
    );
  }

  function startEditWorkout(blockId: string) {
    const target = workouts.find((block) => block.id === blockId);
    if (!target) return;
    const clone: WorkoutBlock = {
      ...target,
      exercises: target.exercises.map((exercise) => ({ ...exercise }))
    };
    setEditingBlock(clone);
  }

  function closeEditor() {
    setEditingBlock(null);
  }

  function addWorkout() {
    const next = defaultWorkout();
    setWorkouts((prev) => [...prev, next]);
    setEditingBlock({ ...next, exercises: next.exercises.map((exercise) => ({ ...exercise })) });
  }

  function updateEditingBlock(patch: Partial<WorkoutBlock>) {
    setEditingBlock((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function addExerciseInEditor() {
    setEditingBlock((prev) =>
      prev
        ? {
            ...prev,
            exercises: [...prev.exercises, { id: makeId(), name: "", sets: "3", reps: "10", tempo: "", rest: "", notes: "" }]
          }
        : prev
    );
  }

  function updateEditorExercise(exerciseId: string, patch: Partial<Omit<Exercise, "id">>) {
    setEditingBlock((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise))
          }
        : prev
    );
  }

  function removeEditorExercise(exerciseId: string) {
    setEditingBlock((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.filter((exercise) => exercise.id !== exerciseId)
          }
        : prev
    );
  }

  function persistEditingBlock() {
    if (!editingBlock) return;
    setWorkouts((prev) => prev.map((block) => (block.id === editingBlock.id ? { ...editingBlock } : block)));
    closeEditor();
  }

  function removeWorkout(id: string) {
    setWorkouts((prev) => prev.filter((block) => block.id !== id));
    setEditingBlock((prev) => (prev?.id === id ? null : prev));
  }

  function duplicateWorkout(workout: WorkoutBlock) {
    const clone: WorkoutBlock = {
      ...workout,
      id: makeId(),
      day: `${workout.day} (copy)`,
      exercises: workout.exercises.map((exercise) => ({ ...exercise, id: makeId() }))
    };
    setWorkouts((prev) => [...prev, clone]);
    setEditingBlock({ ...clone, exercises: clone.exercises.map((exercise) => ({ ...exercise })) });
  }

  function copyShareText() {
    navigator.clipboard.writeText(shareText).catch(() => {});
  }

  function downloadPlan() {
    if (selectedPlanId) {
      window.open(CoachProgramApi.exportPdfUrl(selectedPlanId), "_blank", "noopener");
      return;
    }
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${shareText}</pre>`);
    win.document.close();
    win.focus();
    win.print();
  }

  async function handleSave() {
    if (!programName.trim()) {
      setStatus({ tone: "error", message: "Ajoute un titre à ton programme." });
      return;
    }
    const payload: ProgramPlanPayload = {
      title: programName.trim(),
      goal: goal.trim() || undefined,
      deliveryNotes: deliveryNotes.trim() || undefined,
      workouts: workouts.map((block) => ({
        id: block.id,
        day: block.day,
        focus: block.focus,
        notes: block.notes,
        exercises: block.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          tempo: exercise.tempo,
          rest: exercise.rest,
          notes: exercise.notes
        }))
      }))
    };
    setSaving(true);
    setStatus(null);
    try {
      const saved = selectedPlanId ? await CoachProgramApi.update(selectedPlanId, payload) : await CoachProgramApi.create(payload);
      setPrograms((prev) => {
        const exists = prev.find((plan) => plan.id === saved.id);
        if (exists) return prev.map((plan) => (plan.id === saved.id ? saved : plan));
        return [saved, ...prev];
      });
      hydrateFromPlan(saved);
      await loadShareInfo(saved.id);
      setStatus({ tone: "success", message: "Plan enregistré." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible d'enregistrer le plan." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(planId: string) {
    if (!window.confirm("Archiver ce plan ?")) return;
    setStatus(null);
    try {
      await CoachProgramApi.remove(planId);
      setPrograms((prev) => prev.filter((plan) => plan.id !== planId));
      if (selectedPlanId === planId) resetForm();
      setStatus({ tone: "success", message: "Plan archivé." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Suppression impossible." });
    }
  }

  async function handleAssign() {
    if (!selectedPlanId || !assignMemberId) return;
    setAssigning(true);
    setStatus(null);
    try {
      const updated = await CoachProgramApi.assign(selectedPlanId, assignMemberId);
      setPrograms((prev) => prev.map((plan) => (plan.id === updated.id ? updated : plan)));
      hydrateFromPlan(updated);
      await loadShareInfo(updated.id);
      setStatus({ tone: "success", message: "Plan partagé avec l'adhérent." });
    } catch (err: any) {
      setStatus({ tone: "error", message: err?.message ?? "Impossible d'assigner ce plan." });
    } finally {
      setAssigning(false);
    }
  }

  const topNavLinks = [
    { label: "Dashboard", to: "/coach/overview" },
    { label: "Workflows", to: "/coach/workflows" },
    { label: "Adhérents", to: "/coach/members" },
    { label: "Programmes", to: "/coach/programs" }
  ];

  return (
    <>
      <DashboardNav title="Program Builder" subtitle="Plans muscu & cardio" links={topNavLinks} />
      <div className="dashboard">
        <section className="dashboard-card program-library">
          <div className="dashboard-card__title">Bibliothèque de programmes</div>
          {status && <div className={`program-builder__status program-builder__status--${status.tone}`}>{status.message}</div>}
          {loading ? (
            <div className="program-library__empty">Chargement des plans...</div>
          ) : (
            <div className="program-library__grid">
              <button type="button" className="program-library__item program-library__item--new" onClick={resetForm}>
                + Nouveau plan
              </button>
              {programs.map((plan) => (
                <div key={plan.id} className={`program-library__item${selectedPlanId === plan.id ? " program-library__item--active" : ""}`}>
                  <div className="program-library__header">
                    <strong>{plan.title}</strong>
                    <span>{new Date(plan.updatedAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {plan.goal && <p className="program-library__goal">{plan.goal}</p>}
                  {plan.member?.fullName && <p className="program-library__meta">Assigné à {plan.member.fullName}</p>}
                  <div className="program-library__actions">
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => hydrateFromPlan(plan)}>
                      Ouvrir
                    </button>
                    <button type="button" className="btn btn--outline btn--small" onClick={() => handleDelete(plan.id)}>
                      Archiver
                    </button>
                  </div>
                </div>
              ))}
              {programs.length === 0 && <div className="program-library__empty program-library__item">Aucun plan sauvegardé pour l&apos;instant.</div>}
            </div>
          )}
        </section>

        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">{selectedPlanId ? "Edition d'un programme" : "Program Builder"}</p>
            <h2>{selectedPlanId ? programName : "Assemble tes blocs, partage instantanément"}</h2>
            <p>{selectedPlan?.member ? `Partagé avec ${selectedPlan.member.fullName}` : "Construis des plans muscu/cardio et exporte-les en un clic."}</p>
          </div>
          <div className="hero-ctas">
            <button className="btn btn--outline" onClick={() => navigate(-1)}>
              ← Retour
            </button>
            <button className="btn btn--ghost" onClick={resetForm}>
              Nouveau plan
            </button>
            <button className="btn btn--ghost" onClick={addWorkout}>
              Ajouter un bloc
            </button>
            <button className="btn" onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement..." : selectedPlanId ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </section>

        <section className="dashboard-card program-builder">
          <div className="program-meta">
            <label>
              <span>Nom du programme</span>
              <input value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Bloc Hybrid Elite" />
            </label>
            <label>
              <span>Objectif / bloc</span>
              <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Force, conditioning..." />
            </label>
            <label className="program-meta__full">
              <span>Notes globales</span>
              <textarea value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Périodisation, tempo, outils, etc." />
            </label>
          </div>

          <div className="workout-summary-list">
            {workouts.map((block, index) => (
              <div key={block.id} className="workout-summary">
                <div className="workout-summary__top">
                  <div>
                    <p className="eyebrow">Bloc {index + 1}</p>
                    <h3>{block.day}</h3>
                    <p className="workout-summary__focus">{block.focus}</p>
                  </div>
                  <span className="workout-pill">{block.exercises.length} exos</span>
                </div>
                {block.notes && <p className="workout-summary__notes">{block.notes}</p>}
                <ul className="workout-summary__list">
                  {block.exercises.slice(0, 3).map((exercise) => (
                    <li key={exercise.id}>
                      <strong>{exercise.name || "Exercice"}</strong>
                      <span>
                        {exercise.sets} x {exercise.reps}
                        {exercise.tempo ? ` • tempo ${exercise.tempo}` : ""}
                        {exercise.rest ? ` • repos ${exercise.rest}` : ""}
                      </span>
                    </li>
                  ))}
                  {block.exercises.length > 3 && <li className="workout-summary__more">+ {block.exercises.length - 3} exercices supplémentaires</li>}
                </ul>
                <div className="workout-summary__actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => startEditWorkout(block.id)}>
                    Modifier
                  </button>
                  <button type="button" className="btn btn--ghost btn--small" onClick={() => duplicateWorkout(block)}>
                    Dupliquer
                  </button>
                  <button type="button" className="btn btn--outline btn--small" onClick={() => removeWorkout(block.id)}>
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
            {workouts.length === 0 && <div className="workout-summary workout-summary--empty">Aucun bloc configuré pour l&apos;instant.</div>}
            <button type="button" className="btn btn--ghost btn--block workout-summary__add" onClick={addWorkout}>
              + Ajouter un bloc
            </button>
          </div>
        </section>

        <section className="dashboard-card share-panel">
          <div className="dashboard-card__title">Diffusion & assignation</div>
          <p>Enregistre ton plan puis ouvre le panneau de partage pour générer un lien public, un QR code ou un texte prêt à envoyer.</p>
          <div className="form-actions">
            <button className="btn" type="button" onClick={() => setShareModalOpen(true)} disabled={!selectedPlanId}>
              Ouvrir le panneau de partage
            </button>
            {!selectedPlanId && <span className="member-hint">Sauvegarde ton plan pour activer le partage.</span>}
          </div>
          <div className="assign-panel">
            <h4>Assigner à un adhérent</h4>
            <div className="assign-panel__form">
              <select value={assignMemberId} onChange={(e) => setAssignMemberId(e.target.value)}>
                <option value="">Choisir un adhérent</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName ?? member.user?.email ?? "Sans nom"}
                  </option>
                ))}
              </select>
              <button className="btn" type="button" onClick={handleAssign} disabled={!assignMemberId || !selectedPlanId || assigning}>
                {assigning ? "Assignation..." : "Envoyer"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal open={Boolean(editingBlock)} onClose={closeEditor} title={editingBlock ? `Bloc ${editingBlock.day}` : "Bloc"} width="wide">
        {editingBlock && (
          <form
            className="workout-modal"
            onSubmit={(e) => {
              e.preventDefault();
              persistEditingBlock();
            }}
          >
            <div className="workout-modal__grid">
              <label>
                Jour / nom
                <input value={editingBlock.day} onChange={(e) => updateEditingBlock({ day: e.target.value })} />
              </label>
              <label>
                Focus
                <input value={editingBlock.focus} onChange={(e) => updateEditingBlock({ focus: e.target.value })} />
              </label>
            </div>
            <label>
              Notes bloc
              <textarea value={editingBlock.notes ?? ""} onChange={(e) => updateEditingBlock({ notes: e.target.value })} placeholder="Tempo cible, charge, outils..." />
            </label>
            <div className="exercise-form">
              <div className="exercise-form__header">
                <strong>Exercices</strong>
                <button className="btn btn--ghost btn--small" type="button" onClick={addExerciseInEditor}>
                  + Exercice
                </button>
              </div>
              {editingBlock.exercises.map((exercise) => (
                <div key={exercise.id} className="exercise-form__row">
                  <input value={exercise.name} onChange={(e) => updateEditorExercise(exercise.id, { name: e.target.value })} placeholder="Exercice" />
                  <input value={exercise.sets} onChange={(e) => updateEditorExercise(exercise.id, { sets: e.target.value })} placeholder="Séries" />
                  <input value={exercise.reps} onChange={(e) => updateEditorExercise(exercise.id, { reps: e.target.value })} placeholder="Rép" />
                  <input value={exercise.tempo ?? ""} onChange={(e) => updateEditorExercise(exercise.id, { tempo: e.target.value })} placeholder="Tempo" />
                  <input value={exercise.rest ?? ""} onChange={(e) => updateEditorExercise(exercise.id, { rest: e.target.value })} placeholder="Repos" />
                  <input value={exercise.notes ?? ""} onChange={(e) => updateEditorExercise(exercise.id, { notes: e.target.value })} placeholder="Notes" />
                  <button type="button" className="cms-remove" onClick={() => removeEditorExercise(exercise.id)}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" type="submit">
                Enregistrer le bloc
              </button>
              <button className="btn btn--ghost" type="button" onClick={closeEditor}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="Partager / exporter" width="wide">
        {selectedPlanId ? (
          <>
            <div className="form-actions" style={{ marginBottom: 8 }}>
              <button className="btn btn--ghost btn--small" type="button" onClick={() => loadShareInfo(selectedPlanId)} disabled={shareLoading}>
                {shareLoading ? "Génération..." : "Rafraîchir le lien"}
              </button>
              {shareError && <span className="member-hint member-hint--error">{shareError}</span>}
              {!shareError && !shareLoading && !shareInfo && <span className="member-hint">Sauvegarde ton plan puis relance le partage.</span>}
            </div>
            {shareLoading && <p style={{ opacity: 0.7 }}>Préparation des liens...</p>}
            <div className="share-actions">
              <button className="btn btn--ghost" type="button" onClick={() => window.open(mailLink, "_self")} disabled={!shareInfo || shareLoading}>
                Email
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => window.open(whatsappLink, "_blank", "noopener")} disabled={!shareInfo || shareLoading}>
                WhatsApp
              </button>
              <button className="btn btn--ghost" type="button" onClick={downloadPlan} disabled={!shareInfo || shareLoading}>
                Imprimer / PDF
              </button>
              <button className="btn btn--ghost" type="button" onClick={copyShareText} disabled={!shareInfo || shareLoading}>
                Copier le texte
              </button>
            </div>
            <div className="program-share-link">
              <input value={shareLink || "Enregistre ton plan pour générer un lien public."} readOnly />
              <button className="btn btn--outline btn--small" type="button" onClick={() => shareInfo && shareLink && navigator.clipboard.writeText(shareLink)} disabled={!shareInfo}>
                Copier le lien
              </button>
            </div>
            <div className="share-preview">
              <textarea value={shareText} readOnly />
              {shareInfo ? <img src={qrLink} alt="QR plan" /> : <div style={{ border: "1px dashed rgba(15,23,42,0.2)", padding: 16, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>QR dispo après génération</div>}
            </div>
          </>
        ) : (
          <p>Enregistre ton programme avant de le partager.</p>
        )}
      </Modal>
    </>
  );
}
