import { randomUUID } from "crypto";
import { prisma } from "../../db/prisma";

export type OnboardingStepRecord = {
  id: string;
  memberId: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: Date | null;
  orderIndex: number;
  completedAt?: Date | null;
  createdAt?: Date;
};

type TemplateStepInput = {
  title: string;
  description?: string | null;
  dueOffsetDays?: number | null;
  autoEmail?: boolean;
  autoSms?: boolean;
};

const defaultSteps: Array<{ title: string; description: string; dueInDays: number }> = [
  { title: "Questionnaire détaillé", description: "Remplir le formulaire habitudes + historique blessures.", dueInDays: 1 },
  { title: "Photos / mesures", description: "Envoyer 3 photos + mensurations clés.", dueInDays: 2 },
  { title: "Connexion outils", description: "Partager calendrier, app de tracking ou Google Sheet.", dueInDays: 3 }
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
let tableReady: Promise<void> | null = null;

async function ensureTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OnboardingStep" (
          "id" TEXT PRIMARY KEY,
          "memberId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "dueDate" TIMESTAMPTZ,
          "orderIndex" INTEGER DEFAULT 0,
          "completedAt" TIMESTAMPTZ,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE
        )
      `)
      .then(() => undefined);
  }
  await tableReady;
}

async function listByMemberId(memberId: string) {
  await ensureTable();
  return prisma.$queryRaw<OnboardingStepRecord[]>`
    SELECT "id", "memberId", "title", "description", "status", "dueDate", "orderIndex", "completedAt", "createdAt"
    FROM "OnboardingStep"
    WHERE "memberId" = ${memberId}
    ORDER BY "orderIndex" ASC
  `;
}

function normalize(step: OnboardingStepRecord) {
  return {
    ...step,
    dueDate: step.dueDate ? new Date(step.dueDate) : null,
    completedAt: step.completedAt ? new Date(step.completedAt) : null,
    createdAt: step.createdAt ? new Date(step.createdAt) : undefined
  } as OnboardingStepRecord;
}

async function ensureMemberExists(memberId: string) {
  const member = await prisma.memberProfile.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) throw Object.assign(new Error("Membre introuvable"), { status: 404 });
  return member;
}

async function fetchStep(stepId: string) {
  await ensureTable();
  const [step] = await prisma.$queryRaw<OnboardingStepRecord[]>`
    SELECT "id", "memberId", "title", "description", "status", "dueDate", "orderIndex", "completedAt", "createdAt"
    FROM "OnboardingStep"
    WHERE "id" = ${stepId}
  `;
  return step ? normalize(step) : null;
}

async function getCoach(userId?: string) {
  if (!userId) return prisma.coachProfile.findFirst({ select: { id: true } });
  const coach = await prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!coach) throw Object.assign(new Error("Profil coach introuvable"), { status: 404 });
  return coach;
}

async function loadTemplateBlueprints(coachId?: string | null) {
  const targetCoachId = coachId ?? (await prisma.coachProfile.findFirst({ select: { id: true } }))?.id;
  if (!targetCoachId) return [];
  const templates = await prisma.onboardingTemplate.findMany({
    where: { coachId: targetCoachId },
    orderBy: { createdAt: "asc" },
    include: { steps: { orderBy: { orderIndex: "asc" } } }
  });
  return templates.flatMap((template) =>
    template.steps.map((step, index) => ({
      templateId: template.id,
      title: step.title,
      description: step.description ?? template.description ?? null,
      dueOffsetDays: step.dueOffsetDays ?? index + 1,
      autoEmail: step.autoEmail,
      autoSms: step.autoSms
    }))
  );
}

async function insertBlueprints(memberId: string, steps: TemplateStepInput[]) {
  await ensureTable();
  await ensureMemberExists(memberId);
  const filtered = steps.filter((step) => step.title && step.title.trim().length > 0);
  if (filtered.length === 0) return;
  const [orderInfo] = await prisma.$queryRaw<Array<{ nextIndex: number | null }>>`
    SELECT COALESCE(MAX("orderIndex"), -1) + 1 as nextIndex FROM "OnboardingStep" WHERE "memberId" = ${memberId}
  `;
  let index = orderInfo?.nextIndex ?? 0;
  const now = Date.now();
  await Promise.all(
    filtered.map((step) => {
      const dueOffset = step.dueOffsetDays ?? null;
      const dueDate = dueOffset ? new Date(now + dueOffset * DAY_IN_MS) : null;
      const id = randomUUID();
      const orderIndex = index++;
      return prisma.$executeRaw`
        INSERT INTO "OnboardingStep" ("id", "memberId", "title", "description", "status", "dueDate", "orderIndex")
        VALUES (${id}, ${memberId}, ${step.title}, ${step.description ?? null}, 'PENDING', ${dueDate ?? null}, ${orderIndex})
      `;
    })
  );
}

async function replaceTemplateSteps(templateId: string, steps?: TemplateStepInput[]) {
  await prisma.onboardingTemplateStep.deleteMany({ where: { templateId } });
  if (!steps || steps.length === 0) return [];
  const data = steps
    .filter((step) => step.title && step.title.trim().length > 0)
    .map((step, idx) => ({
      templateId,
      title: step.title!.trim(),
      description: step.description ?? null,
      dueOffsetDays: step.dueOffsetDays ?? null,
      autoEmail: Boolean(step.autoEmail),
      autoSms: Boolean(step.autoSms),
      orderIndex: idx
    }));
  if (data.length === 0) return [];
  await prisma.onboardingTemplateStep.createMany({ data });
  return prisma.onboardingTemplateStep.findMany({ where: { templateId }, orderBy: { orderIndex: "asc" } });
}

export const onboardingService = {
  async seedForMember(memberId: string) {
    await ensureTable();
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "OnboardingStep" WHERE "memberId" = ${memberId}
    `;
    if (existing.length > 0) return;
    const blueprints = await loadTemplateBlueprints();
    if (blueprints.length > 0) {
      await insertBlueprints(memberId, blueprints);
      return;
    }
    const fallback = defaultSteps.map((step) => ({ title: step.title, description: step.description, dueOffsetDays: step.dueInDays }));
    await insertBlueprints(memberId, fallback);
  },

  async listForMember(userId: string) {
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
    const steps = await listByMemberId(member.id);
    return steps.map(normalize);
  },

  async listForCoach(memberId: string) {
    const steps = await listByMemberId(memberId);
    return steps.map(normalize);
  },

  async updateStatusForMember(userId: string, stepId: string, status: "PENDING" | "COMPLETED" | "SKIPPED") {
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
    await ensureTable();
    const [current] = await prisma.$queryRaw<OnboardingStepRecord[]>`
      SELECT * FROM "OnboardingStep" WHERE "id" = ${stepId}
    `;
    if (!current || current.memberId !== member.id) throw Object.assign(new Error("Step not found"), { status: 404 });
    const completedAt = status === "COMPLETED" ? new Date() : null;
    await prisma.$executeRaw`
      UPDATE "OnboardingStep"
      SET "status" = ${status}, "completedAt" = ${completedAt ?? null}
      WHERE "id" = ${stepId}
    `;
    return normalize({ ...current, status, completedAt: completedAt ?? null });
  },

  async coachAlerts() {
    await ensureTable();
    const alerts = await prisma.$queryRaw<Array<OnboardingStepRecord & { fullName?: string | null }>>`
      SELECT s."id", s."memberId", s."title", s."description", s."status", s."dueDate", s."orderIndex", s."completedAt", s."createdAt", m."fullName"
      FROM "OnboardingStep" s
      JOIN "MemberProfile" m ON m."id" = s."memberId"
      WHERE s."status" != 'COMPLETED' AND s."dueDate" IS NOT NULL AND s."dueDate" <= NOW()
      ORDER BY s."dueDate" ASC
      LIMIT 16
    `;
    return alerts.map(normalize);
  },

  async createStepForCoach(memberId: string, payload: { title?: string; description?: string; status?: string; dueDate?: string | null }) {
    await ensureTable();
    await ensureMemberExists(memberId);
    if (!payload.title) throw Object.assign(new Error("Titre requis"), { status: 400 });
    const status = payload.status ?? "PENDING";
    const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    const [order] = await prisma.$queryRaw<Array<{ nextIndex: number | null }>>`
      SELECT COALESCE(MAX("orderIndex"), -1) + 1 as nextIndex FROM "OnboardingStep" WHERE "memberId" = ${memberId}
    `;
    const orderIndex = order?.nextIndex ?? 0;
    const id = randomUUID();
    const completedAt = status === "COMPLETED" ? new Date() : null;
    await prisma.$executeRaw`
      INSERT INTO "OnboardingStep" ("id", "memberId", "title", "description", "status", "dueDate", "orderIndex", "completedAt")
      VALUES (${id}, ${memberId}, ${payload.title}, ${payload.description ?? null}, ${status}, ${dueDate ?? null}, ${orderIndex}, ${
      completedAt ?? null
    })
    `;
    return normalize({
      id,
      memberId,
      title: payload.title,
      description: payload.description ?? null,
      status,
      dueDate,
      orderIndex,
      completedAt,
      createdAt: new Date()
    });
  },

  async updateStepForCoach(
    memberId: string,
    stepId: string,
    payload: { title?: string; description?: string | null; status?: string; dueDate?: string | null }
  ) {
    await ensureTable();
    const current = await fetchStep(stepId);
    if (!current || current.memberId !== memberId) throw Object.assign(new Error("Step introuvable"), { status: 404 });
    const title = payload.title ?? current.title;
    const description = payload.description === undefined ? current.description : payload.description;
    const status = payload.status ?? current.status;
    const dueDate = payload.dueDate === undefined ? current.dueDate : payload.dueDate ? new Date(payload.dueDate) : null;
    const completedAt = status === "COMPLETED" ? current.completedAt ?? new Date() : status === "PENDING" ? null : current.completedAt;
    await prisma.$executeRaw`
      UPDATE "OnboardingStep"
      SET "title" = ${title},
          "description" = ${description ?? null},
          "status" = ${status},
          "dueDate" = ${dueDate ?? null},
          "completedAt" = ${completedAt ?? null}
      WHERE "id" = ${stepId}
    `;
    return normalize({
      ...current,
      title,
      description,
      status,
      dueDate,
      completedAt: completedAt ?? null
    });
  },

  async deleteStepForCoach(memberId: string, stepId: string) {
    await ensureTable();
    const current = await fetchStep(stepId);
    if (!current || current.memberId !== memberId) throw Object.assign(new Error("Step introuvable"), { status: 404 });
    await prisma.$executeRaw`
      DELETE FROM "OnboardingStep" WHERE "id" = ${stepId}
    `;
  },

  async listTemplates(userId: string) {
    const coach = await getCoach(userId);
    if (!coach) return [];
    const templates = await prisma.onboardingTemplate.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "asc" },
      include: { steps: { orderBy: { orderIndex: "asc" } } }
    });
    return templates;
  },

  async createTemplate(userId: string, payload: { title?: string; description?: string; steps?: TemplateStepInput[] }) {
    const coach = await getCoach(userId);
    if (!payload.title) throw Object.assign(new Error("Titre requis"), { status: 400 });
    const template = await prisma.onboardingTemplate.create({
      data: { coachId: coach!.id, title: payload.title, description: payload.description }
    });
    const steps = await replaceTemplateSteps(template.id, payload.steps);
    return { ...template, steps };
  },

  async updateTemplate(userId: string, templateId: string, payload: { title?: string; description?: string; steps?: TemplateStepInput[] }) {
    const coach = await getCoach(userId);
    const template = await prisma.onboardingTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.coachId !== coach?.id) throw Object.assign(new Error("Template introuvable"), { status: 404 });
    const updated = await prisma.onboardingTemplate.update({
      where: { id: templateId },
      data: {
        title: payload.title ?? template.title,
        description: payload.description ?? template.description
      }
    });
    const steps = payload.steps ? await replaceTemplateSteps(templateId, payload.steps) : await prisma.onboardingTemplateStep.findMany({ where: { templateId }, orderBy: { orderIndex: "asc" } });
    return { ...updated, steps };
  },

  async deleteTemplate(userId: string, templateId: string) {
    const coach = await getCoach(userId);
    const template = await prisma.onboardingTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.coachId !== coach?.id) throw Object.assign(new Error("Template introuvable"), { status: 404 });
    await prisma.onboardingTemplate.delete({ where: { id: templateId } });
  },

  async applyTemplate(userId: string, memberId: string, templateId: string) {
    const coach = await getCoach(userId);
    const template = await prisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { steps: { orderBy: { orderIndex: "asc" } } }
    });
    if (!template || template.coachId !== coach?.id) throw Object.assign(new Error("Template introuvable"), { status: 404 });
    await insertBlueprints(
      memberId,
      template.steps.map((step) => ({
        title: step.title,
        description: step.description,
        dueOffsetDays: step.dueOffsetDays
      }))
    );
    const steps = await listByMemberId(memberId);
    return steps.map(normalize);
  }
};

export async function onboardingStepTitles() {
  const blueprints = await loadTemplateBlueprints();
  if (blueprints.length === 0) return defaultSteps.map((step) => step.title);
  return blueprints.map((step) => step.title);
}
