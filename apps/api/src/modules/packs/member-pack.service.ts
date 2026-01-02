import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

function client(db?: DbClient) {
  return db ?? prisma;
}

function parseMetadata(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {};
  }
}

function resolveCredits(pack: { totalCredits: number | null; creditsRemaining: number | null }) {
  if (pack.totalCredits == null) return { capped: null, remaining: null };
  const remaining = typeof pack.creditsRemaining === "number" ? pack.creditsRemaining : pack.totalCredits;
  return { capped: pack.totalCredits, remaining };
}

function hasCredits(pack: { totalCredits: number | null; creditsRemaining: number | null }) {
  if (pack.totalCredits == null) return true;
  const { remaining } = resolveCredits(pack);
  return (remaining ?? 0) > 0;
}

export const memberPackService = {
  async activateFromPayment(paymentId: string, db?: DbClient) {
    const cx = client(db);
    const payment = await cx.payment.findUnique({
      where: { id: paymentId },
      include: { member: { select: { id: true } } }
    });
    if (!payment) return null;
    const existing = await cx.memberPack.findFirst({ where: { paymentId } });
    if (existing) return existing;

    const metadata = parseMetadata(payment.metadata);
    const productId = metadata.productId ?? metadata.product_id ?? null;
    if (!productId) return null;

    const product = await cx.product.findUnique({ where: { id: productId } });
    if (!product) return null;

    const totalCredits = product.creditValue ?? null;
    const pack = await cx.memberPack.create({
      data: {
        memberId: payment.memberId,
        productId,
        paymentId: payment.id,
        totalCredits,
        creditsRemaining: totalCredits,
        metadata: payment.metadata
      }
    });

    await cx.memberProfile.update({
      where: { id: payment.memberId },
      data: { isActivated: true }
    });

    return pack;
  },

  async requirePackForBooking(memberId: string, packId?: string) {
    if (packId) {
      const pack = await prisma.memberPack.findFirst({
        where: { id: packId, memberId, status: "ACTIVE" }
      });
      if (!pack) throw Object.assign(new Error("Pack indisponible"), { status: 404 });
      if (!hasCredits(pack)) throw Object.assign(new Error("Plus de crédits sur ce pack."), { status: 402 });
      return pack;
    }
    const packs = await prisma.memberPack.findMany({
      where: { memberId, status: "ACTIVE" },
      orderBy: { activatedAt: "asc" }
    });
    const pack = packs.find(hasCredits);
    if (!pack) throw Object.assign(new Error("Aucun pack actif ou crédits épuisés"), { status: 402 });
    return pack;
  },

  async debitPack(packId: string, db?: DbClient) {
    const cx = client(db);
    const pack = await cx.memberPack.findUnique({ where: { id: packId } });
    if (!pack) throw Object.assign(new Error("Pack introuvable"), { status: 404 });
    if (pack.totalCredits == null) return pack;
    const { remaining } = resolveCredits(pack);
    const current = remaining ?? pack.totalCredits;
    if (current <= 0) throw Object.assign(new Error("Plus de crédits disponibles"), { status: 402 });
    const next = current - 1;
    return cx.memberPack.update({
      where: { id: packId },
      data: { creditsRemaining: next, status: next <= 0 ? "USED" : pack.status ?? "ACTIVE" }
    });
  },

  async creditPack(packId: string, db?: DbClient) {
    const cx = client(db);
    const pack = await cx.memberPack.findUnique({ where: { id: packId } });
    if (!pack) throw Object.assign(new Error("Pack introuvable"), { status: 404 });
    if (pack.totalCredits == null) return pack;
    const { remaining } = resolveCredits(pack);
    const baseline = remaining ?? pack.totalCredits ?? 0;
    const ceiling = pack.totalCredits ?? baseline;
    const next = Math.min(ceiling, baseline + 1);
    return cx.memberPack.update({
      where: { id: packId },
      data: { creditsRemaining: next, status: "ACTIVE" }
    });
  }
};
