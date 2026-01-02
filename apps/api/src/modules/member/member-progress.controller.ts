import type { Response } from "express";
import PDFDocument from "pdfkit";
import { AuthedRequest } from "../../middlewares/auth";
import { prisma } from "../../db/prisma";
import { memberProgressService } from "./member-progress.service";

function parseDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "—";
}

function streamRecap(res: Response, payload: Awaited<ReturnType<typeof memberProgressService.getForCoach>>) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="recap-${payload.member?.fullName ?? "member"}.pdf"`);
  const doc = new PDFDocument({ size: "A4", margin: 42 });
  doc.pipe(res);

  doc.fontSize(20).text(payload.member?.fullName ?? "Fiche adhérent");
  doc.fontSize(12).fillColor("#666").text(payload.member?.goal ?? "Objectif personnalisé");
  doc.moveDown();

  doc.fontSize(16).fillColor("#111").text("Checklist onboarding");
  const onboarding = (payload as any).onboardingSteps ?? [];
  if (onboarding.length === 0) {
    doc.fontSize(12).fillColor("#777").text("Toutes les étapes sont à créer.");
  } else {
    onboarding.forEach((step: any) => {
      doc.fontSize(12).fillColor("#111").text(`• ${step.title} — ${step.status}`);
      if (step.dueDate) doc.fontSize(10).fillColor("#555").text(`   Due: ${new Date(step.dueDate).toLocaleDateString("fr-FR")}`);
    });
  }

  doc.moveDown().fontSize(16).fillColor("#111").text("Objectifs court terme");
  if (payload.goals.length === 0) {
    doc.fontSize(12).fillColor("#777").text("Aucun objectif défini.");
  } else {
    payload.goals.forEach((goal) => {
      doc.fontSize(12).fillColor("#111").text(`• ${goal.title} (${goal.status})`);
      if (goal.targetDate) doc.fontSize(10).fillColor("#555").text(`   Cible: ${parseDate(goal.targetDate)}`);
    });
  }

  doc.moveDown().fontSize(16).fillColor("#111").text("Check-ins biométriques");
  if (payload.checkIns.length === 0) {
    doc.fontSize(12).fillColor("#777").text("Aucun check-in enregistré.");
  } else {
    payload.checkIns.slice(0, 6).forEach((checkIn) => {
      doc.fontSize(12).fillColor("#111").text(`• ${checkIn.metric}: ${checkIn.value}`);
      doc.fontSize(10).fillColor("#555").text(`   ${new Date(checkIn.createdAt).toLocaleDateString("fr-FR")} — ${checkIn.notes ?? ""}`);
    });
  }

  doc.moveDown().fontSize(16).fillColor("#111").text("Notes vidéo / feedback");
  if (payload.videoNotes.length === 0) {
    doc.fontSize(12).fillColor("#777").text("Pas encore de note vidéo.");
  } else {
    payload.videoNotes.slice(0, 5).forEach((note) => {
      doc.fontSize(12).fillColor("#111").text(`• ${note.url}`);
      if (note.description) doc.fontSize(10).fillColor("#555").text(`   ${note.description}`);
    });
  }

  doc.moveDown();
  if (payload.member?.programNotes) {
    doc.fontSize(16).fillColor("#111").text("Notes programme");
    doc.fontSize(12).fillColor("#333").text(payload.member.programNotes);
  }
  if (payload.member?.followUpNotes) {
    doc.moveDown();
    doc.fontSize(16).fillColor("#111").text("Suivi coach");
    doc.fontSize(12).fillColor("#333").text(payload.member.followUpNotes);
  }

  doc.end();
}

export const memberProgressController = {
  async memberProgress(req: AuthedRequest, res: Response) {
    const data = await memberProgressService.getForMember(req.user!.id);
    res.json(data);
  },

  async coachProgress(req: AuthedRequest, res: Response) {
    const data = await memberProgressService.getForCoach(req.params.id);
    res.json(data);
  },

  async createGoal(req: AuthedRequest, res: Response) {
    const { title, targetDate, status } = req.body ?? {};
    if (!title) return res.status(400).json({ message: "Titre requis" });
    const goal = await memberProgressService.createGoal(req.params.id, { title, targetDate, status });
    res.status(201).json(goal);
  },

  async updateGoal(req: AuthedRequest, res: Response) {
    const { title, targetDate, status } = req.body ?? {};
    const goal = await memberProgressService.updateGoal(req.params.id, req.params.goalId, { title, targetDate, status });
    res.json(goal);
  },

  async deleteGoal(req: AuthedRequest, res: Response) {
    await memberProgressService.deleteGoal(req.params.id, req.params.goalId);
    res.status(204).end();
  },

  async createCheckIn(req: AuthedRequest, res: Response) {
    const { metric, value, notes } = req.body ?? {};
    if (!metric || !value) return res.status(400).json({ message: "Metric et valeur requis" });
    const checkIn = await memberProgressService.createCheckIn(req.params.id, { metric, value, notes });
    res.status(201).json(checkIn);
  },

  async deleteCheckIn(req: AuthedRequest, res: Response) {
    await memberProgressService.deleteCheckIn(req.params.id, req.params.checkInId);
    res.status(204).end();
  },

  async createVideoNote(req: AuthedRequest, res: Response) {
    const { url, description } = req.body ?? {};
    if (!url) return res.status(400).json({ message: "URL requise" });
    const note = await memberProgressService.createVideoNote(req.params.id, { url, description });
    res.status(201).json(note);
  },

  async deleteVideoNote(req: AuthedRequest, res: Response) {
    await memberProgressService.deleteVideoNote(req.params.id, req.params.videoNoteId);
    res.status(204).end();
  },

  async recapCoach(req: AuthedRequest, res: Response) {
    const data = await memberProgressService.getForCoach(req.params.id);
    streamRecap(res, data);
  },

  async recapMember(req: AuthedRequest, res: Response) {
    const member = await prisma.memberProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
    if (!member) return res.status(404).json({ message: "Member not found" });
    const data = await memberProgressService.getForCoach(member.id);
    streamRecap(res, data);
  }
};
