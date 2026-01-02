import Stripe from "stripe";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { memberPackService } from "../packs/member-pack.service";
import { buildPagination, buildMeta, PaginatedResult } from "../../utils/pagination";

type CheckoutResponse =
  | { type: "REDIRECT"; url: string | null }
  | { type: "WALLET"; payload: Record<string, unknown> }
  | { type: "IN_APP"; instructions: string };

type PaymentMethod = "STRIPE" | "CASH";

export const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" } as Stripe.StripeConfig)
  : null;
const baseClientUrl = (env.CORS_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");

type PaymentMetadata = Record<string, unknown>;

function readMetadata(raw?: string | null): PaymentMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PaymentMetadata;
  } catch {
    return {};
  }
}

function mergeMetadata(raw: string | null | undefined, next: PaymentMetadata) {
  return JSON.stringify({ ...readMetadata(raw), ...next });
}

async function onPaymentPaid(paymentId: string) {
  try {
    await memberPackService.activateFromPayment(paymentId);
  } catch (err) {
    console.error("memberPack activation failed", err);
  }
}

async function getMember(userId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
    select: { id: true, fullName: true, user: { select: { email: true } } }
  });
  if (!member) throw Object.assign(new Error("Member not found"), { status: 404 });
  return member;
}

async function getCoachBrand() {
  return prisma.coachProfile.findFirst({ select: { brandName: true, tagline: true } });
}

function centsToEuro(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

async function createPaymentRecord(memberId: string, payload: { amountCents: number; method: PaymentMethod; notes?: string; metadata?: any }) {
  return prisma.payment.create({
    data: {
      memberId,
      amountCents: payload.amountCents,
      currency: "EUR",
      status: "PENDING",
      method: payload.method,
      notes: payload.notes,
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : undefined
    }
  });
}

async function attachProviderRef(paymentId: string, providerRef: string | null, metadata: Record<string, unknown>) {
  const current = await prisma.payment.findUnique({ where: { id: paymentId }, select: { metadata: true } });
  return prisma.payment.update({
    where: { id: paymentId },
    data: { providerRef: providerRef ?? undefined, metadata: mergeMetadata(current?.metadata, metadata) }
  });
}

export const paymentService = {
  async initialize(userId: string, payload: { method: PaymentMethod; productId?: string; amountCents?: number; notes?: string; description?: string }) {
    const member = await getMember(userId);
    let amountCents = payload.amountCents;
    let description = payload.description ?? "Paiement coaching";

    if (payload.productId) {
      const product = await prisma.product.findFirst({ where: { id: payload.productId, isActive: true } });
      if (!product) throw Object.assign(new Error("Produit introuvable"), { status: 404 });
      amountCents = product.priceCents;
      description = product.title;
    }

    if (!amountCents) throw Object.assign(new Error("Montant manquant"), { status: 400 });
    const totalCents = amountCents;

    const baseMetadata: Record<string, unknown> = { description };
    if (payload.productId) baseMetadata.productId = payload.productId;

    const payment = await createPaymentRecord(member.id, {
      amountCents: totalCents,
      method: payload.method,
      notes: payload.notes,
      metadata: baseMetadata
    });

    switch (payload.method) {
      case "STRIPE": {
        if (!stripeClient) throw Object.assign(new Error("Stripe non configuré"), { status: 503 });
        const session = await stripeClient.checkout.sessions.create({
          mode: "payment",
          customer_email: member.user?.email ?? undefined,
          success_url: `${baseClientUrl}/payment?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseClientUrl}/payment?status=cancel`,
          payment_intent_data: {
            metadata: { paymentId: payment.id, memberId: member.id, productId: payload.productId ?? undefined }
          },
          line_items: [
            {
              price_data: {
                currency: "EUR",
                unit_amount: totalCents,
                product_data: { name: description }
              },
              quantity: 1
            }
          ],
          metadata: { paymentId: payment.id, memberId: member.id, productId: payload.productId ?? undefined }
        });
        const updated = await attachProviderRef(payment.id, session.id, {
          description,
          checkoutUrl: session.url,
          provider: "STRIPE",
          sessionId: session.id
        });
        return { payment: updated, next: { type: "REDIRECT", url: session.url } as CheckoutResponse };
      }
      case "CASH":
      default: {
        const updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            metadata: mergeMetadata(payment.metadata, { description, provider: "CASH" }),
            status: "PENDING"
          }
        });
        return {
          payment: updated,
          next: { type: "IN_APP", instructions: "Règlement en cash enregistré. Le coach confirmera manuellement." } as CheckoutResponse
        };
      }
    }
  },

  async listForMember(userId: string, params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    const pagination = buildPagination(params);
    if (!member) {
      return { items: [], pagination: buildMeta(pagination.page, pagination.pageSize, 0) };
    }
    const where = { memberId: member.id };
    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: pagination.skip, take: pagination.take }),
      prisma.payment.count({ where })
    ]);
    return {
      items,
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  },

  async listForCoach(params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const pagination = buildPagination(params);
    const [items, total] = await prisma.$transaction([
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
      }),
      prisma.payment.count()
    ]);
    return {
      items,
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  },

  async updateStatus(id: string, status: "PENDING" | "PAID" | "FAILED" | "REFUNDED", notes?: string) {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw Object.assign(new Error("Paiement introuvable"), { status: 404 });
    const mergedNotes = notes ? (payment.notes ? `${payment.notes}\n${notes}` : notes) : payment.notes ?? undefined;
    const updated = await prisma.payment.update({ where: { id }, data: { status, notes: mergedNotes } });
    if (status === "PAID") await onPaymentPaid(updated.id);
    return updated;
  },

  async delete(id: string) {
    return prisma.payment.delete({ where: { id } });
  },

  async monthlyReport() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: firstDay } },
      orderBy: { createdAt: "desc" },
      include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
    });
    const totals: Record<string, number> = {};
    let paidVolume = 0;
    let pendingVolume = 0;
    payments.forEach((payment) => {
      totals[payment.method] = (totals[payment.method] ?? 0) + payment.amountCents;
      if (payment.status === "PAID") paidVolume += payment.amountCents;
      if (payment.status !== "PAID") pendingVolume += payment.amountCents;
    });
    const cashPending = payments.filter((p) => p.method === "CASH" && p.status !== "PAID");
    const cashPaid = payments.filter((p) => p.method === "CASH" && p.status === "PAID");
    const totalsEuro: Record<string, number> = {};
    Object.entries(totals).forEach(([method, cents]) => {
      totalsEuro[method] = (cents ?? 0) / 100;
    });
    return {
      totals: totalsEuro,
      summary: {
        paid: paidVolume / 100,
        outstanding: pendingVolume / 100
      },
      cash: {
        pending: cashPending,
        paid: cashPaid
      }
    };
  },

  async syncStripeEvent(event: Stripe.Event) {
    if (!event?.type) return;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.metadata?.paymentId;
      if (!paymentId) return;
      const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) return;
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : payment.providerRef ?? session.id;
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: "PAID",
          providerRef: paymentIntentId ?? undefined,
          metadata: mergeMetadata(payment.metadata, { sessionId: session.id, paymentIntent: session.payment_intent, provider: "STRIPE" })
        }
      });
      await onPaymentPaid(paymentId);
    }
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = (intent.metadata as any)?.paymentId;
      if (!paymentId) return;
      await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
    }
  },

  async markBookingAsPaid(paymentId: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;
    if (payment.status === "PAID" || payment.status === "REFUNDED") return payment;
    const updated = await prisma.payment.update({ where: { id: paymentId }, data: { status: "PAID" } });
    await onPaymentPaid(paymentId);
    return updated;
  },

  async refundBookingPayment(paymentId: string, reason?: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;
    if (payment.status === "REFUNDED") return payment;

    const metadata = readMetadata(payment.metadata);

    if (payment.method === "STRIPE" && stripeClient) {
      let paymentIntentId = payment.providerRef ?? (typeof metadata.paymentIntent === "string" ? metadata.paymentIntent : undefined);
      if (!paymentIntentId && typeof metadata.sessionId === "string") {
        try {
          const session = await stripeClient.checkout.sessions.retrieve(metadata.sessionId as string);
          if (session.payment_intent && typeof session.payment_intent === "string") {
            paymentIntentId = session.payment_intent;
          }
        } catch (err) {
          console.error("Stripe session lookup failed", err);
        }
      }
      if (!paymentIntentId) throw Object.assign(new Error("Référence Stripe introuvable pour le remboursement"), { status: 409 });
      try {
        await stripeClient.refunds.create({
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
          metadata: { bookingRefund: "true", paymentId }
        });
      } catch (err) {
        console.error("Stripe refund failed", err);
        throw Object.assign(new Error("Refund Stripe impossible"), { status: 502 });
      }
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "REFUNDED",
        notes: reason ? `${reason}${payment.notes ? ` • ${payment.notes}` : ""}` : payment.notes
      }
    });
  },

  async getPaymentWithMember(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            userId: true,
            user: { select: { email: true } }
          }
        }
      }
    });
  },

  async createCashPayment(payload: { memberId: string; amountCents: number; description?: string; notes?: string }) {
    const member = await prisma.memberProfile.findUnique({ where: { id: payload.memberId } });
    if (!member) throw Object.assign(new Error("Adhérent introuvable"), { status: 404 });
    if (!payload.amountCents || payload.amountCents <= 0) throw Object.assign(new Error("Montant invalide"), { status: 400 });
    const metadata: PaymentMetadata = { provider: "CASH" };
    if (payload.description) metadata.description = payload.description;
    metadata.origin = "COACH_MANUAL";
    return prisma.payment.create({
      data: {
        memberId: member.id,
        amountCents: payload.amountCents,
        currency: "EUR",
        method: "CASH",
        status: "PENDING",
        notes: payload.notes,
        metadata: JSON.stringify(metadata)
      }
    });
  }
};
