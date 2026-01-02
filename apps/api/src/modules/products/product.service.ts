import { prisma } from "../../db/prisma";
import type { Prisma } from "@prisma/client";

async function getCoachByUser(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId } });
  if (!coach) throw Object.assign(new Error("Coach profile not found"), { status: 404 });
  return coach;
}

export const productService = {
  async list(userId: string) {
    const coach = await getCoachByUser(userId);
    return prisma.product.findMany({
      where: { coachId: coach.id },
      orderBy: { createdAt: "desc" }
    });
  },

  async create(
    userId: string,
    payload: {
      title: string;
      description?: string;
      priceCents: number;
      billingInterval?: string | null;
      checkoutUrl?: string | null;
      creditValue: number;
    }
  ) {
    const coach = await getCoachByUser(userId);
    if (!payload.title || !payload.priceCents) throw Object.assign(new Error("Titre et prix requis"), { status: 400 });
    return prisma.product.create({
      data: {
        coachId: coach.id,
        title: payload.title,
        description: payload.description,
        priceCents: payload.priceCents,
        billingInterval: payload.billingInterval,
        checkoutUrl: payload.checkoutUrl,
        creditValue: payload.creditValue,
        isActive: true
      }
    });
  },

  async update(userId: string, productId: string, payload: Prisma.ProductUpdateInput) {
    const coach = await getCoachByUser(userId);
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing || existing.coachId !== coach.id) throw Object.assign(new Error("Produit introuvable"), { status: 404 });
    return prisma.product.update({
      where: { id: productId },
      data: payload
    });
  },

  async remove(userId: string, productId: string) {
    const coach = await getCoachByUser(userId);
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing || existing.coachId !== coach.id) throw Object.assign(new Error("Produit introuvable"), { status: 404 });
    await prisma.product.delete({ where: { id: productId } });
  }
};
