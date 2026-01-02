import { prisma } from "../../db/prisma";

type RulePayload = {
  weekday?: number;
  startTime?: string;
  endTime?: string;
};

type ApplyPayload = {
  days?: number;
  startDate?: string;
};

function ensureTime(value?: string) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) throw Object.assign(new Error("Format heure invalide (hh:mm)"), { status: 400 });
  const [hh, mm] = value.split(":").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) throw Object.assign(new Error("Heure invalide"), { status: 400 });
  return hh * 60 + mm;
}

function ensureWeekday(value?: number) {
  if (value === undefined || value === null || Number.isNaN(value)) throw Object.assign(new Error("Jour requis"), { status: 400 });
  if (value < 0 || value > 6) throw Object.assign(new Error("Jour invalide"), { status: 400 });
  return value;
}

async function ensureCoach(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!coach) throw Object.assign(new Error("Profil coach introuvable"), { status: 404 });
  return coach;
}

function normalizeApplicationRange(options?: ApplyPayload) {
  const days = Math.max(1, Math.min(options?.days ?? 14, 60));
  const startDate = options?.startDate ? new Date(options.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw Object.assign(new Error("Date de départ invalide"), { status: 400 });
  startDate.setHours(0, 0, 0, 0);
  return { days, startDate };
}

function weekdayFromDate(date: Date) {
  return (date.getDay() + 6) % 7;
}

export const availabilityRuleService = {
  async list(userId: string) {
    const coach = await ensureCoach(userId);
    return prisma.availabilityRule.findMany({
      where: { coachId: coach.id },
      orderBy: [{ weekday: "asc" }, { startMinutes: "asc" }]
    });
  },

  async create(userId: string, payload: RulePayload) {
    const coach = await ensureCoach(userId);
    const weekday = ensureWeekday(payload.weekday);
    const startMinutes = ensureTime(payload.startTime);
    const endMinutes = ensureTime(payload.endTime);
    if (endMinutes <= startMinutes) throw Object.assign(new Error("La fin doit être après le début"), { status: 400 });
    return prisma.availabilityRule.create({
      data: { coachId: coach.id, weekday, startMinutes, endMinutes }
    });
  },

  async update(userId: string, ruleId: string, payload: RulePayload) {
    const coach = await ensureCoach(userId);
    const rule = await prisma.availabilityRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.coachId !== coach.id) throw Object.assign(new Error("Règle introuvable"), { status: 404 });
    const weekday = payload.weekday === undefined ? rule.weekday : ensureWeekday(payload.weekday);
    const startMinutes = payload.startTime === undefined ? rule.startMinutes : ensureTime(payload.startTime);
    const endMinutes = payload.endTime === undefined ? rule.endMinutes : ensureTime(payload.endTime);
    if (endMinutes <= startMinutes) throw Object.assign(new Error("La fin doit être après le début"), { status: 400 });
    return prisma.availabilityRule.update({
      where: { id: ruleId },
      data: { weekday, startMinutes, endMinutes }
    });
  },

  async remove(userId: string, ruleId: string) {
    const coach = await ensureCoach(userId);
    const rule = await prisma.availabilityRule.findUnique({ where: { id: ruleId } });
    if (!rule || rule.coachId !== coach.id) throw Object.assign(new Error("Règle introuvable"), { status: 404 });
    await prisma.availabilityRule.delete({ where: { id: ruleId } });
  },

  async apply(userId: string, payload?: ApplyPayload) {
    const coach = await ensureCoach(userId);
    const rules = await prisma.availabilityRule.findMany({ where: { coachId: coach.id } });
    if (rules.length === 0) return { createdCount: 0 };
    const { days, startDate } = normalizeApplicationRange(payload);
    const slots: Array<{ startAt: Date; endAt: Date }> = [];
    for (let offset = 0; offset < days; offset++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + offset);
      const weekday = weekdayFromDate(targetDate);
      rules.forEach((rule) => {
        if (rule.weekday !== weekday) return;
        const startAt = new Date(targetDate);
        startAt.setHours(0, 0, 0, 0);
        startAt.setMinutes(startAt.getMinutes() + rule.startMinutes);
        const endAt = new Date(targetDate);
        endAt.setHours(0, 0, 0, 0);
        endAt.setMinutes(endAt.getMinutes() + rule.endMinutes);
        if (endAt <= startAt) return;
        slots.push({ startAt, endAt });
      });
    }
    if (slots.length === 0) return { createdCount: 0 };
    const startTimes = slots.map((slot) => slot.startAt);
    const existing = await prisma.availability.findMany({
      where: {
        coachId: coach.id,
        startAt: { in: startTimes }
      },
      select: { startAt: true }
    });
    const existingSet = new Set(existing.map((slot) => slot.startAt.toISOString()));
    const toCreate = slots.filter((slot) => !existingSet.has(slot.startAt.toISOString()));
    if (toCreate.length === 0) return { createdCount: 0 };
    await prisma.$transaction(
      toCreate.map((slot) =>
        prisma.availability.create({
          data: {
            coachId: coach.id,
            startAt: slot.startAt,
            endAt: slot.endAt
          }
        })
      )
    );
    return { createdCount: toCreate.length };
  }
};
