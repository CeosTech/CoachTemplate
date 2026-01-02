import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { AuthedRequest } from "../../middlewares/auth";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { paymentService, stripeClient } from "./payment.service";

function ensurePaymentAccess(req: AuthedRequest, payment: { member?: { userId?: string | null } | null }) {
  if (req.user?.role === "COACH") return;
  if (payment.member?.userId !== req.user?.id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

export const paymentController = {
  async checkout(req: AuthedRequest, res: Response) {
    const { method, productId, amountCents, notes, description } = req.body ?? {};
    if (!method) return res.status(400).json({ message: "Méthode requise" });
    if (!["STRIPE", "CASH"].includes(method)) return res.status(400).json({ message: "Méthode invalide" });
    const created = await paymentService.initialize(req.user!.id, { method, productId, amountCents, notes, description });
    res.status(201).json(created);
  },

  async createCashPayment(req: AuthedRequest, res: Response) {
    const { memberId, amountCents, description, notes } = req.body ?? {};
    if (!memberId || !amountCents) return res.status(400).json({ message: "Membre et montant requis" });
    const cents = Number(amountCents);
    if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ message: "Montant invalide" });
    const created = await paymentService.createCashPayment({
      memberId,
      amountCents: Math.round(cents),
      description,
      notes
    });
    res.status(201).json(created);
  },

  async listMember(req: AuthedRequest, res: Response) {
    const { page, pageSize } = req.query ?? {};
    res.json(await paymentService.listForMember(req.user!.id, { page, pageSize }));
  },

  async listCoach(req: AuthedRequest, res: Response) {
    const { page, pageSize } = req.query ?? {};
    res.json(await paymentService.listForCoach({ page, pageSize }));
  },

  async updateStatus(req: AuthedRequest, res: Response) {
    const { status, notes } = req.body ?? {};
    if (!status || !["PENDING", "PAID", "FAILED", "REFUNDED"].includes(status)) return res.status(400).json({ message: "Statut invalide" });
    const updated = await paymentService.updateStatus(req.params.id, status, notes);
    res.json(updated);
  },

  async remove(_req: AuthedRequest, res: Response) {
    await paymentService.delete(req.params.id);
    res.status(204).end();
  },

  async report(_req: AuthedRequest, res: Response) {
    res.json(await paymentService.monthlyReport());
  },

  async receipt(req: AuthedRequest, res: Response) {
    const payment = await paymentService.getPaymentWithMember(req.params.id);
    if (!payment) return res.status(404).json({ message: "Paiement introuvable" });
    ensurePaymentAccess(req, payment);
    const coach = await prisma.coachProfile.findFirst({ select: { brandName: true, tagline: true } });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="receipt-${payment.id}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    doc.pipe(res);

    doc
      .fontSize(20)
      .fillColor("#111")
      .text(coach?.brandName ?? "Coach", { align: "left" })
      .moveDown(0.25)
      .fontSize(12)
      .fillColor("#555")
      .text(coach?.tagline ?? "Coaching premium");

    doc.moveDown();
    doc.fontSize(16).fillColor("#111").text("Reçu de paiement");
    doc.fontSize(12).fillColor("#333").text(`#${payment.id}`);
    doc.moveDown();

    doc.text(`Membre: ${payment.member?.fullName ?? payment.member?.user?.email ?? ""}`);
    if (payment.member?.user?.email) doc.text(`Email: ${payment.member.user.email}`);
    doc.text(`Méthode: ${payment.method}`);
    doc.text(`Statut: ${payment.status}`);
    doc.text(`Date: ${new Date(payment.createdAt).toLocaleString("fr-FR")}`);
    const description = payment.metadata
      ? (() => {
          try {
            return JSON.parse(payment.metadata!).description as string | undefined;
          } catch {
            return undefined;
          }
        })()
      : undefined;
    if (description) doc.text(`Description: ${description}`);
    doc.moveDown();

    doc.fontSize(14).fillColor("#111").text("Montant total");
    doc.fontSize(24).text(`${(payment.amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: payment.currency })}`);

    doc.moveDown();
    doc.fontSize(10).fillColor("#777").text("Reçu généré automatiquement. Merci pour ta confiance !");
    doc.end();
  },

  async stripeWebhook(req: Request, res: Response) {
    if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) return res.status(200).json({ skipped: true });
    const signature = req.headers["stripe-signature"] as string | undefined;
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(req.body as Buffer, signature ?? "", env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    await paymentService.syncStripeEvent(event);
    res.json({ received: true });
  },

  // Aucun autre webhook requis tant que seules les cartes Stripe et l'espèce sont supportées.
};
