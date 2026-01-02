import { prisma } from "../../db/prisma";
import { onboardingService } from "../onboarding/onboarding.service";

type GoalPayload = { title: string; targetDate?: string | null; status?: string };
type CheckInPayload = { metric: string; value: string; notes?: string | null };
type VideoNotePayload = { url: string; description?: string | null };

async function ensureMember(memberId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      fullName: true,
      goal: true,
      level: true,
      planUrl: true,
      programNotes: true,
      followUpNotes: true,
      user: { select: { email: true } }
    }
  });
  if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
  return member;
}

async function loadCollections(memberId: string) {
  const [goals, checkIns, videoNotes] = await Promise.all([
    prisma.goal.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } }),
    prisma.checkIn.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } }),
    prisma.videoNote.findMany({ where: { memberId }, orderBy: { createdAt: "desc" } })
  ]);
  return { goals, checkIns, videoNotes };
}

export const memberProgressService = {
  async getForMember(userId: string) {
    const profile = await prisma.memberProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        fullName: true,
        goal: true,
        level: true,
        planUrl: true,
        programNotes: true,
        followUpNotes: true
      }
    });
    if (!profile) throw Object.assign(new Error("Member not found"), { status: 404 });
    const collections = await loadCollections(profile.id);
    const onboardingSteps = await onboardingService.listForCoach(profile.id);
    return { member: profile, onboardingSteps, ...collections };
  },

  async getForCoach(memberId: string) {
    const profile = await ensureMember(memberId);
    const collections = await loadCollections(memberId);
    const onboardingSteps = await onboardingService.listForCoach(memberId);
    return { member: profile, onboardingSteps, ...collections };
  },

  async createGoal(memberId: string, payload: GoalPayload) {
    await ensureMember(memberId);
    return prisma.goal.create({
      data: {
        memberId,
        title: payload.title,
        status: payload.status ?? "PENDING",
        targetDate: payload.targetDate ? new Date(payload.targetDate) : undefined
      }
    });
  },

  async updateGoal(memberId: string, goalId: string, payload: GoalPayload) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.memberId !== memberId) throw Object.assign(new Error("Goal not found"), { status: 404 });
    return prisma.goal.update({
      where: { id: goalId },
      data: {
        title: payload.title ?? undefined,
        status: payload.status,
        targetDate: payload.targetDate === undefined ? undefined : payload.targetDate ? new Date(payload.targetDate) : null
      }
    });
  },

  async deleteGoal(memberId: string, goalId: string) {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal || goal.memberId !== memberId) throw Object.assign(new Error("Goal not found"), { status: 404 });
    await prisma.goal.delete({ where: { id: goalId } });
  },

  async createCheckIn(memberId: string, payload: CheckInPayload) {
    await ensureMember(memberId);
    return prisma.checkIn.create({ data: { memberId, metric: payload.metric, value: payload.value, notes: payload.notes } });
  },

  async deleteCheckIn(memberId: string, checkInId: string) {
    const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
    if (!checkIn || checkIn.memberId !== memberId) throw Object.assign(new Error("Check-in not found"), { status: 404 });
    await prisma.checkIn.delete({ where: { id: checkInId } });
  },

  async createVideoNote(memberId: string, payload: VideoNotePayload) {
    await ensureMember(memberId);
    return prisma.videoNote.create({ data: { memberId, url: payload.url, description: payload.description } });
  },

  async deleteVideoNote(memberId: string, videoNoteId: string) {
    const note = await prisma.videoNote.findUnique({ where: { id: videoNoteId } });
    if (!note || note.memberId !== memberId) throw Object.assign(new Error("Video note not found"), { status: 404 });
    await prisma.videoNote.delete({ where: { id: videoNoteId } });
  }
};
