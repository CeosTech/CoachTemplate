import { randomUUID } from "crypto";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";

type ProgramExercise = {
  id?: string;
  name?: string;
  sets?: string;
  reps?: string;
  tempo?: string;
  rest?: string;
  notes?: string;
};

type ProgramWorkout = {
  id?: string;
  day?: string;
  focus?: string;
  notes?: string;
  exercises?: ProgramExercise[];
};

export type ProgramPayload = {
  title?: string;
  goal?: string | null;
  deliveryNotes?: string | null;
  workouts?: ProgramWorkout[];
  memberId?: string | null;
};

type ProgramPlanRecord = Awaited<ReturnType<typeof prisma.programPlan.findFirst>> & {
  member?: { id: string; fullName?: string | null; user?: { email?: string | null } | null } | null;
};

function normalizeExercises(exercises?: ProgramExercise[]) {
  if (!Array.isArray(exercises)) return [];
  return exercises
    .map((exercise) => ({
      id: exercise.id ?? randomUUID(),
      name: (exercise.name ?? "").trim(),
      sets: exercise.sets ?? "",
      reps: exercise.reps ?? "",
      tempo: exercise.tempo ?? "",
      rest: exercise.rest ?? "",
      notes: exercise.notes ?? ""
    }))
    .filter((exercise) => exercise.name.length > 0 || exercise.sets.length > 0 || exercise.reps.length > 0);
}

function normalizeWorkouts(workouts?: ProgramWorkout[]) {
  if (!Array.isArray(workouts) || workouts.length === 0) return [];
  return workouts
    .map((workout, index) => ({
      id: workout.id ?? randomUUID(),
      day: workout.day?.trim() || `Jour ${index + 1}`,
      focus: workout.focus?.trim() || "Bloc personnalisé",
      notes: workout.notes ?? "",
      exercises: normalizeExercises(workout.exercises)
    }))
    .filter((workout) => workout.exercises.length > 0);
}

function sharePath(token: string) {
  return `/api/programs/share/${token}`;
}

function absoluteShareLink(sharePathValue: string) {
  const base = (env.API_BASE_URL ?? `http://localhost:${env.PORT}`).replace(/\/$/, "");
  return `${base}${sharePathValue.startsWith("/") ? sharePathValue : `/${sharePathValue}`}`;
}

function mapPlan(plan: ProgramPlanRecord) {
  const workouts = plan?.workoutsJson ? (JSON.parse(plan.workoutsJson) as ProgramWorkout[]) : [];
  return {
    id: plan!.id,
    coachId: plan!.coachId,
    memberId: plan!.memberId,
    member: plan!.member,
    title: plan!.title,
    goal: plan!.goal,
    deliveryNotes: plan!.deliveryNotes,
    workouts,
    shareToken: plan!.shareToken,
    sharePath: sharePath(plan!.shareToken),
    shareUrl: sharePath(plan!.shareToken),
    isArchived: plan!.isArchived,
    assignedAt: plan!.assignedAt,
    createdAt: plan!.createdAt,
    updatedAt: plan!.updatedAt
  };
}

function buildShareText(plan: ReturnType<typeof mapPlan>, shareLink: string) {
  const sections: string[] = [];
  sections.push(`Programme: ${plan.title}`);
  if (plan.goal) sections.push(`Objectif: ${plan.goal}`);
  if (plan.deliveryNotes) sections.push(`Notes: ${plan.deliveryNotes}`);
  sections.push("");
  plan.workouts.forEach((workout, index) => {
    const header = `Jour ${index + 1}: ${workout.day ?? `Bloc ${index + 1}`} • ${workout.focus ?? "Focus personnalisé"}`;
    const exercises =
      Array.isArray(workout.exercises) && workout.exercises.length > 0
        ? workout.exercises
            .map((exercise, idx) => {
              const parts = [`${idx + 1}. ${exercise.name ?? "Exercice"}`];
              const details: string[] = [];
              if (exercise.sets || exercise.reps) details.push(`${exercise.sets ?? "?"} x ${exercise.reps ?? "?"}`);
              if (exercise.tempo) details.push(`tempo ${exercise.tempo}`);
              if (exercise.rest) details.push(`repos ${exercise.rest}`);
              if (exercise.notes) details.push(exercise.notes);
              return `${parts.join(" ")}${details.length ? ` — ${details.join(" • ")}` : ""}`;
            })
            .join("\n")
        : "Exercices à définir.";
    sections.push(header);
    sections.push(exercises);
    if (workout.notes) sections.push(`Notes: ${workout.notes}`);
    sections.push("");
  });
  if (shareLink) sections.push(`Lien: ${shareLink}`);
  return sections.filter(Boolean).join("\n");
}

async function getCoach(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!coach) throw Object.assign(new Error("Profil coach introuvable"), { status: 404 });
  return coach;
}

async function ensurePlanAccess(coachId: string, planId: string) {
  const plan = await prisma.programPlan.findUnique({
    where: { id: planId },
    include: { member: { select: { id: true, fullName: true, user: { select: { email: true } } } } }
  });
  if (!plan || plan.coachId !== coachId) throw Object.assign(new Error("Plan introuvable"), { status: 404 });
  return plan;
}

async function ensureMember(memberId?: string | null) {
  if (!memberId) return null;
  const member = await prisma.memberProfile.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) throw Object.assign(new Error("Membre introuvable"), { status: 404 });
  return member;
}

export const programService = {
  async list(userId: string) {
    const coach = await getCoach(userId);
    const plans = await prisma.programPlan.findMany({
      where: { coachId: coach.id, isArchived: false },
      orderBy: { updatedAt: "desc" },
      include: { member: { select: { id: true, fullName: true, user: { select: { email: true } } } } }
    });
    return plans.map(mapPlan);
  },

  async detail(userId: string, planId: string) {
    const coach = await getCoach(userId);
    const plan = await ensurePlanAccess(coach.id, planId);
    return mapPlan(plan);
  },

  async create(userId: string, payload: ProgramPayload) {
    const coach = await getCoach(userId);
    if (!payload?.title) throw Object.assign(new Error("Titre requis"), { status: 400 });
    const workouts = normalizeWorkouts(payload.workouts);
    if (workouts.length === 0) throw Object.assign(new Error("Ajoute au moins un bloc avec des exercices"), { status: 400 });
    const shareToken = randomUUID().replace(/-/g, "");
    const plan = await prisma.programPlan.create({
      data: {
        coachId: coach.id,
        title: payload.title,
        goal: payload.goal,
        deliveryNotes: payload.deliveryNotes,
        workoutsJson: JSON.stringify(workouts),
        shareToken
      },
      include: { member: { select: { id: true, fullName: true, user: { select: { email: true } } } } }
    });

    if (payload.memberId) {
      return this.assign(userId, plan.id, payload.memberId);
    }

    return mapPlan(plan);
  },

  async update(userId: string, planId: string, payload: ProgramPayload) {
    const coach = await getCoach(userId);
    const plan = await ensurePlanAccess(coach.id, planId);
    const updates: any = {};
    if (payload.title !== undefined) {
      if (!payload.title.trim()) throw Object.assign(new Error("Titre requis"), { status: 400 });
      updates.title = payload.title.trim();
    }
    if (payload.goal !== undefined) updates.goal = payload.goal;
    if (payload.deliveryNotes !== undefined) updates.deliveryNotes = payload.deliveryNotes;
    if (payload.workouts) {
      const workouts = normalizeWorkouts(payload.workouts);
      if (workouts.length === 0) throw Object.assign(new Error("Impossible d'enregistrer un plan vide"), { status: 400 });
      updates.workoutsJson = JSON.stringify(workouts);
    }
    if (Object.keys(updates).length === 0) return mapPlan(plan);
    const updated = await prisma.programPlan.update({
      where: { id: planId },
      data: updates,
      include: { member: { select: { id: true, fullName: true, user: { select: { email: true } } } } }
    });
    return mapPlan(updated);
  },

  async remove(userId: string, planId: string) {
    const coach = await getCoach(userId);
    const plan = await ensurePlanAccess(coach.id, planId);
    await prisma.programPlan.update({ where: { id: planId }, data: { isArchived: true } });
    if (plan.memberId) {
      await prisma.memberProfile.updateMany({ where: { id: plan.memberId, planUrl: sharePath(plan.shareToken) }, data: { planUrl: null } });
    }
  },

  async assign(userId: string, planId: string, memberId: string) {
    const coach = await getCoach(userId);
    const plan = await ensurePlanAccess(coach.id, planId);
    await ensureMember(memberId);
    if (plan.memberId && plan.memberId !== memberId) {
      await prisma.memberProfile.updateMany({ where: { id: plan.memberId }, data: { planUrl: null } });
    }
    const updated = await prisma.programPlan.update({
      where: { id: planId },
      data: { memberId, assignedAt: new Date() },
      include: { member: { select: { id: true, fullName: true, user: { select: { email: true } } } } }
    });
    await prisma.memberProfile.update({
      where: { id: memberId },
      data: { planUrl: sharePath(updated.shareToken) }
    });
    return mapPlan(updated);
  },

  async share(token: string) {
    if (!token) return null;
    const plan = await prisma.programPlan.findFirst({
      where: { shareToken: token, isArchived: false },
      include: {
        coach: { select: { brandName: true, tagline: true } },
        member: { select: { fullName: true } }
      }
    });
    if (!plan) return null;
    const workouts = plan.workoutsJson ? (JSON.parse(plan.workoutsJson) as ProgramWorkout[]) : [];
    return {
      id: plan.id,
      title: plan.title,
      goal: plan.goal,
      deliveryNotes: plan.deliveryNotes,
      workouts,
      member: plan.member,
      coach: plan.coach,
      shareToken: plan.shareToken
    };
  },

  async exportShare(userId: string, planId: string) {
    const coach = await getCoach(userId);
    const planRecord = await ensurePlanAccess(coach.id, planId);
    const mapped = mapPlan(planRecord);
    const link = absoluteShareLink(mapped.sharePath);
    const text = buildShareText(mapped, link);
    const subject = mapped.title ?? "Programme personnalisé";
    return {
      plan: mapped,
      shareLink: link,
      shareText: text,
      mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      qrPayload: link || text
    };
  }
};
