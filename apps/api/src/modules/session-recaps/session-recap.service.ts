import { prisma } from "../../db/prisma";
import { buildPagination, buildMeta, PaginatedResult } from "../../utils/pagination";

export type SessionRecapExercise = {
  name: string;
  sets?: string;
  reps?: string;
  rest?: string;
  tempo?: string;
  cues?: string;
};

export type SessionRecapPayload = {
  sessionDate?: string;
  focus?: string;
  intensity?: string;
  notes?: string;
  exercises: SessionRecapExercise[];
};

function normalize<T extends { exercisesJson: string | null }>(recap: T) {
  return {
    ...recap,
    exercises: recap.exercisesJson ? (JSON.parse(recap.exercisesJson) as SessionRecapExercise[]) : [],
    exercisesJson: undefined
  };
}

async function getMemberIdByUser(userId: string) {
  const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!member) throw Object.assign(new Error("Profil membre introuvable"), { status: 404 });
  return member.id;
}

export const sessionRecapService = {
  async create(memberId: string, payload: SessionRecapPayload, authorRole: "COACH" | "MEMBER" = "COACH") {
    const member = await prisma.memberProfile.findUnique({ where: { id: memberId } });
    if (!member) throw Object.assign(new Error("Member introuvable"), { status: 404 });
    const sessionDate = payload.sessionDate ? new Date(payload.sessionDate) : new Date();
    const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
    const recap = await prisma.sessionRecap.create({
      data: {
        memberId,
        sessionDate,
        focus: payload.focus,
        intensity: payload.intensity,
        notes: payload.notes,
        exercisesJson: JSON.stringify(exercises),
        authorRole
      },
      include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
    });
    return normalize(recap);
  },

  async listForMember(userId: string, params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    const pagination = buildPagination(params);
    if (!member) {
      return { items: [], pagination: buildMeta(pagination.page, pagination.pageSize, 0) };
    }
    const where = { memberId: member.id };
    const [recaps, total] = await prisma.$transaction([
      prisma.sessionRecap.findMany({
        where,
        orderBy: { sessionDate: "desc" },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.sessionRecap.count({ where })
    ]);
    return {
      items: recaps.map(normalize),
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  },

  async listForCoach(memberId: string, params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const pagination = buildPagination(params);
    const where = { memberId };
    const [recaps, total] = await prisma.$transaction([
      prisma.sessionRecap.findMany({
        where,
        orderBy: { sessionDate: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
      }),
      prisma.sessionRecap.count({ where })
    ]);
    return {
      items: recaps.map(normalize),
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  },

  async update(memberId: string, recapId: string, payload: SessionRecapPayload) {
    const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId } });
    if (!recap || recap.memberId !== memberId) throw Object.assign(new Error("Recap introuvable"), { status: 404 });
    const sessionDate = payload.sessionDate ? new Date(payload.sessionDate) : recap.sessionDate;
    const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
    const updated = await prisma.sessionRecap.update({
      where: { id: recapId },
      data: {
        sessionDate,
        focus: payload.focus ?? recap.focus,
        intensity: payload.intensity ?? recap.intensity,
        notes: payload.notes ?? recap.notes,
        exercisesJson: JSON.stringify(exercises)
      },
      include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
    });
    return normalize(updated);
  },

  async remove(memberId: string, recapId: string) {
    const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId }, select: { id: true, memberId: true } });
    if (!recap || recap.memberId !== memberId) throw Object.assign(new Error("Recap introuvable"), { status: 404 });
    await prisma.sessionRecap.delete({ where: { id: recapId } });
  },

  async createForMemberUser(userId: string, payload: SessionRecapPayload) {
    const memberId = await getMemberIdByUser(userId);
    return this.create(memberId, payload, "MEMBER");
  },

  async updateForMemberUser(userId: string, recapId: string, payload: SessionRecapPayload) {
    const memberId = await getMemberIdByUser(userId);
    const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId }, select: { memberId: true, authorRole: true } });
    if (!recap || recap.memberId !== memberId || recap.authorRole !== "MEMBER") throw Object.assign(new Error("Impossible de modifier ce recap"), { status: 403 });
    return this.update(memberId, recapId, payload);
  },

  async removeForMemberUser(userId: string, recapId: string) {
    const memberId = await getMemberIdByUser(userId);
    const recap = await prisma.sessionRecap.findUnique({ where: { id: recapId }, select: { memberId: true, authorRole: true } });
    if (!recap || recap.memberId !== memberId || recap.authorRole !== "MEMBER") throw Object.assign(new Error("Impossible de supprimer ce recap"), { status: 403 });
    await this.remove(memberId, recapId);
  }
};
