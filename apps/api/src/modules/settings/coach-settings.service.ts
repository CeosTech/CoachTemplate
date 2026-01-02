import { prisma } from "../../db/prisma";
import type { Prisma } from "@prisma/client";

async function getCoachProfile(userId: string) {
  const coach = await prisma.coachProfile.findUnique({
    where: { userId },
    include: { user: true }
  });
  if (!coach) throw Object.assign(new Error("Coach introuvable"), { status: 404 });
  return coach;
}

export const coachSettingsService = {
  async getProfile(userId: string) {
    const coach = await getCoachProfile(userId);
    return {
      email: coach.user.email,
      brandName: coach.brandName,
      tagline: coach.tagline ?? "",
      logoUrl: coach.logoUrl ?? "",
      primaryColor: coach.primaryColor ?? ""
    };
  },

  async updateProfile(
    userId: string,
    payload: { email?: string; brandName?: string; tagline?: string | null; logoUrl?: string | null; primaryColor?: string | null }
  ) {
    const coach = await getCoachProfile(userId);
    const profileData: Prisma.CoachProfileUpdateInput = {};
    if (payload.brandName !== undefined) profileData.brandName = payload.brandName;
    if (payload.tagline !== undefined) profileData.tagline = payload.tagline;
    if (payload.logoUrl !== undefined) profileData.logoUrl = payload.logoUrl;
    if (payload.primaryColor !== undefined) profileData.primaryColor = payload.primaryColor;

    await prisma.$transaction(async (tx) => {
      if (payload.email && payload.email !== coach.user.email) {
        await tx.user.update({ where: { id: coach.userId }, data: { email: payload.email } });
      }
      if (Object.keys(profileData).length > 0) {
        await tx.coachProfile.update({ where: { id: coach.id }, data: profileData });
      }
    });

    return this.getProfile(userId);
  },

  async getIntegrations(userId: string) {
    const coach = await getCoachProfile(userId);
    const integrations = await prisma.coachIntegrationSettings.findUnique({ where: { coachId: coach.id } });
    return integrations ?? { coachId: coach.id };
  },

  async updateIntegrations(
    userId: string,
    payload: {
      stripePublicKey?: string | null;
      stripeSecretKey?: string | null;
      stripeWebhookSecret?: string | null;
    }
  ) {
    const coach = await getCoachProfile(userId);
    const record = await prisma.coachIntegrationSettings.upsert({
      where: { coachId: coach.id },
      update: payload,
      create: { coachId: coach.id, ...payload }
    });
    return record;
  }
};
