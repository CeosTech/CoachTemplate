import { prisma } from "../../db/prisma";
import { hashPassword } from "../../utils/password";
import { onboardingService } from "../onboarding/onboarding.service";
import type { Prisma } from "@prisma/client";

function generateTempPassword() {
  return `Coach${Math.random().toString(36).slice(2, 8)}!`;
}

export const memberService = {
  async getDashboard(userId: string) {
    const profile = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true, level: true, weightKg: true } });

    const quickStats = [
      { label: "Séances ce mois", value: profile?.level === "Avancé" ? "10/14" : "8/12", helper: "Dernière semaine +2" },
      { label: "Charge moyenne", value: "7.1", helper: "Zone optimale" },
      { label: "Sommeil", value: "7h32", helper: "+24 min" }
    ];

    const focusBlocks = [
      { title: "Bloc Force", detail: "Semaine 3/4 • 85% - 92%", tag: "Actif" },
      { title: "Conditioning", detail: "2 x EMOM 18' / zone 3", tag: "Cardio" }
    ];

    const timeline = [
      { day: "Mercredi", title: "Lower - Force", meta: "Back Squat + Front Foot Elevated Split Squat" },
      { day: "Vendredi", title: "Upper - Volume", meta: "Bench tempo + accessoires push/pull" },
      { day: "Samedi", title: "Conditioning", meta: "Partner WOD + core finisher" }
    ];

    const programTimeline = [
      { phase: "Bloc intensif", weeks: "Sem. 1-4", focus: "Progressions force + volume", status: "En cours" },
      { phase: "Deload", weeks: "Sem. 5", focus: "Volume -40% + mobilité", status: "À venir" },
      { phase: "Nouveau cycle", weeks: "Sem. 6-9", focus: "Hybrid conditioning + PR test", status: "Planifié" }
    ];

    const snapshots = [
      {
        label: "Semaine 1",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=60",
        weight: profile?.weightKg ? `${profile.weightKg} kg` : "78 kg",
        metric: "-",
        notes: "Kickoff + tests initiaux"
      },
      {
        label: "Semaine 8",
        image: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=60",
        weight: profile?.weightKg ? `${Math.max(profile.weightKg - 4, 0)} kg` : "73 kg",
        metric: "-5 kg / +10% force",
        notes: "Photos + mesures envoyées"
      }
    ];

    const notifications = profile
      ? await prisma.notification.findMany({
          where: { OR: [{ memberId: null }, { memberId: profile.id }] },
          orderBy: { createdAt: "desc" }
        })
      : [];

    return { quickStats, focusBlocks, timeline, programTimeline, snapshots, notifications };
  },

  async listMembers(params?: { search?: string; level?: string }) {
    const where: Prisma.MemberProfileWhereInput = {};
    if (params?.level) where.level = params.level;
    if (params?.search) {
      where.OR = [
        { fullName: { contains: params.search, mode: "insensitive" } },
        { goal: { contains: params.search, mode: "insensitive" } },
        { user: { email: { contains: params.search, mode: "insensitive" } } }
      ];
    }
    const rows = await prisma.memberProfile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        goal: true,
        level: true,
        isActivated: true,
        user: { select: { email: true, createdAt: true } },
        memberPacks: {
          select: { status: true, creditsRemaining: true, totalCredits: true, product: { select: { title: true } } },
          orderBy: { activatedAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((member) => {
      const activePacks = member.memberPacks.filter((pack) => pack.status === "ACTIVE");
      const totalCreditsRemaining = activePacks.reduce((sum, pack) => sum + (pack.creditsRemaining ?? pack.totalCredits ?? 0), 0);
      const latestPack = member.memberPacks[0];
      return {
        id: member.id,
        fullName: member.fullName,
        goal: member.goal,
        level: member.level,
        isActivated: member.isActivated,
        user: member.user,
        activePackCount: activePacks.length,
        hasActiveCredits: totalCreditsRemaining > 0,
        totalCreditsRemaining,
        lastPackTitle: latestPack?.product?.title ?? null,
        lastPackStatus: latestPack?.status ?? null
      };
    });
  },

  async getMemberDetail(memberId: string) {
    const profile = await prisma.memberProfile.findUnique({
      where: { id: memberId },
      include: {
        user: { select: { email: true, createdAt: true } },
        payments: { orderBy: { createdAt: "desc" } },
        notifications: { orderBy: { createdAt: "desc" } },
        goals: { orderBy: { createdAt: "desc" } },
        checkIns: { orderBy: { createdAt: "desc" }, take: 12 },
        videoNotes: { orderBy: { createdAt: "desc" } },
        memberPacks: {
          include: {
            product: { select: { id: true, title: true, creditValue: true, priceCents: true } }
          },
          orderBy: { activatedAt: "desc" }
        }
      }
    });
    if (!profile) throw Object.assign(new Error("Not found"), { status: 404 });
    return profile;
  },

  async createMember(payload: {
    email: string;
    fullName?: string;
    goal?: string;
    level?: string;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    preferredTraining?: string;
    limitations?: string;
  }) {
    if (!payload.email) throw Object.assign(new Error("Email requis"), { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email: payload.email } });
    if (exists) throw Object.assign(new Error("Email déjà utilisé"), { status: 409 });

    const tempPassword = generateTempPassword();
    const user = await prisma.user.create({
      data: {
        email: payload.email,
        passwordHash: await hashPassword(tempPassword),
        role: "MEMBER",
        memberProfile: {
          create: {
            fullName: payload.fullName ?? "Nouveau membre",
            goal: payload.goal,
            level: payload.level,
            age: payload.age,
            heightCm: payload.heightCm,
            weightKg: payload.weightKg,
            preferredTraining: payload.preferredTraining,
            limitations: payload.limitations
          }
        }
      },
      include: { memberProfile: true }
    });

    if (user.memberProfile?.id) {
      await onboardingService.seedForMember(user.memberProfile.id);
    }

    return {
      member: {
        id: user.memberProfile?.id,
        fullName: user.memberProfile?.fullName,
        goal: user.memberProfile?.goal,
        level: user.memberProfile?.level,
        user: { email: user.email }
      },
      temporaryPassword: tempPassword
    };
  },

  async listOwnPacks(userId: string) {
    const member = await prisma.memberProfile.findUnique({
      where: { userId },
      select: { id: true }
    });
    if (!member) throw Object.assign(new Error("Profil introuvable"), { status: 404 });
    return prisma.memberPack.findMany({
      where: { memberId: member.id },
      include: {
        product: { select: { id: true, title: true, description: true, priceCents: true, creditValue: true } }
      },
      orderBy: [
        { status: "asc" },
        { activatedAt: "desc" }
      ]
    });
  },

  async getOwnProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        memberProfile: {
          select: {
            fullName: true,
            goal: true,
            level: true,
            age: true,
            heightCm: true,
            weightKg: true,
            preferredTraining: true,
            limitations: true
          }
        }
      }
    });
    if (!user?.memberProfile) throw Object.assign(new Error("Profil introuvable"), { status: 404 });
    return {
      email: user.email,
      ...user.memberProfile
    };
  },

  async updateOwnProfile(
    userId: string,
    payload: {
      email?: string;
      fullName?: string;
      goal?: string;
      level?: string;
      age?: number | null;
      heightCm?: number | null;
      weightKg?: number | null;
      preferredTraining?: string | null;
      limitations?: string | null;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, memberProfile: { select: { id: true } } }
    });
    if (!user?.memberProfile) throw Object.assign(new Error("Profil introuvable"), { status: 404 });

    const profileData: Prisma.MemberProfileUpdateInput = {};
    if (payload.fullName !== undefined) profileData.fullName = payload.fullName;
    if (payload.goal !== undefined) profileData.goal = payload.goal;
    if (payload.level !== undefined) profileData.level = payload.level;
    if (payload.age !== undefined) profileData.age = payload.age ?? null;
    if (payload.heightCm !== undefined) profileData.heightCm = payload.heightCm ?? null;
    if (payload.weightKg !== undefined) profileData.weightKg = payload.weightKg ?? null;
    if (payload.preferredTraining !== undefined) profileData.preferredTraining = payload.preferredTraining ?? null;
    if (payload.limitations !== undefined) profileData.limitations = payload.limitations ?? null;

    return await prisma.$transaction(async (tx) => {
      if (payload.email && payload.email !== user.email) {
        await tx.user.update({
          where: { id: userId },
          data: { email: payload.email }
        });
      }
      if (Object.keys(profileData).length > 0) {
        await tx.memberProfile.update({
          where: { id: user.memberProfile!.id },
          data: profileData
        });
      }
      const refreshed = await tx.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          memberProfile: {
            select: {
              fullName: true,
              goal: true,
              level: true,
              age: true,
              heightCm: true,
              weightKg: true,
              preferredTraining: true,
              limitations: true
            }
          }
        }
      });
      if (!refreshed?.memberProfile) throw Object.assign(new Error("Profil introuvable"), { status: 404 });
      return { email: refreshed.email, ...refreshed.memberProfile };
    });
  },

  async updateCoachNotes(memberId: string, payload: { programNotes?: string | null; followUpNotes?: string | null }) {
    const updates: Prisma.MemberProfileUpdateInput = {};
    if (payload.programNotes !== undefined) updates.programNotes = payload.programNotes;
    if (payload.followUpNotes !== undefined) updates.followUpNotes = payload.followUpNotes;
    if (Object.keys(updates).length === 0) {
      throw Object.assign(new Error("Aucune donnée fournie"), { status: 400 });
    }
    const updated = await prisma.memberProfile.update({
      where: { id: memberId },
      data: updates,
      select: { id: true, programNotes: true, followUpNotes: true, planUrl: true }
    });
    return updated;
  }
};
