import { prisma } from "../../db/prisma";

async function getCoach(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId } });
  if (!coach) throw Object.assign(new Error("Profil coach introuvable"), { status: 404 });
  return coach;
}

function validateRange(start?: string, end?: string) {
  if (!start || !end) throw Object.assign(new Error("startAt et endAt requis"), { status: 400 });
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) throw Object.assign(new Error("Dates invalides"), { status: 400 });
  if (endAt <= startAt) throw Object.assign(new Error("La fin doit être après le début"), { status: 400 });
  return { startAt, endAt };
}

export const coachAvailabilityService = {
  async list(userId: string) {
    const coach = await getCoach(userId);
    return prisma.availability.findMany({
      where: { coachId: coach.id },
      orderBy: { startAt: "asc" }
    });
  },

  async create(userId: string, payload: { startAt?: string; endAt?: string }) {
    const coach = await getCoach(userId);
    const { startAt, endAt } = validateRange(payload.startAt, payload.endAt);
    return prisma.availability.create({
      data: {
        coachId: coach.id,
        startAt,
        endAt
      }
    });
  },

  async update(userId: string, id: string, payload: { startAt?: string; endAt?: string }) {
    const coach = await getCoach(userId);
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing || existing.coachId !== coach.id) throw Object.assign(new Error("Disponibilité introuvable"), { status: 404 });
    const { startAt, endAt } = validateRange(payload.startAt ?? existing.startAt.toISOString(), payload.endAt ?? existing.endAt.toISOString());
    return prisma.availability.update({
      where: { id },
      data: {
        startAt,
        endAt
      }
    });
  },

  async remove(userId: string, id: string) {
    const coach = await getCoach(userId);
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing || existing.coachId !== coach.id) throw Object.assign(new Error("Disponibilité introuvable"), { status: 404 });
    await prisma.availability.delete({ where: { id } });
  }
};
