import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import { AuthedRequest } from "../../middlewares/auth";
import { programService } from "./program.service";

export const programController = {
  async list(req: AuthedRequest, res: Response) {
    const plans = await programService.list(req.user!.id);
    res.json(plans);
  },

  async detail(req: AuthedRequest, res: Response) {
    try {
      const plan = await programService.detail(req.user!.id, req.params.id);
      res.json(plan);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Plan introuvable" });
    }
  },

  async create(req: AuthedRequest, res: Response) {
    try {
      const plan = await programService.create(req.user!.id, req.body ?? {});
      res.status(201).json(plan);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de créer le plan" });
    }
  },

  async update(req: AuthedRequest, res: Response) {
    try {
      const plan = await programService.update(req.user!.id, req.params.id, req.body ?? {});
      res.json(plan);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour le plan" });
    }
  },

  async remove(req: AuthedRequest, res: Response) {
    try {
      await programService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Suppression impossible" });
    }
  },

  async assign(req: AuthedRequest, res: Response) {
    try {
      const { memberId } = req.body ?? {};
      if (!memberId) return res.status(400).json({ message: "memberId requis" });
      const plan = await programService.assign(req.user!.id, req.params.id, memberId);
      res.json(plan);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'assigner ce plan" });
    }
  },

  async share(req: Request, res: Response) {
    const plan = await programService.share(req.params.token);
    if (!plan) return res.status(404).json({ message: "Plan introuvable" });
    res.json(plan);
  },

  async exportShare(req: AuthedRequest, res: Response) {
    try {
      const payload = await programService.exportShare(req.user!.id, req.params.id);
      res.json(payload);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de générer le partage." });
    }
  },

  async exportPdf(req: AuthedRequest, res: Response) {
    try {
      const payload = await programService.exportShare(req.user!.id, req.params.id);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="programme-${payload.plan.id}.pdf"`);
      const doc = new PDFDocument({ size: "A4", margin: 48 });
      doc.pipe(res);
      doc.fontSize(20).fillColor("#111").text(payload.plan.title, { underline: true });
      if (payload.plan.goal) {
        doc.moveDown(0.5).fontSize(14).fillColor("#333").text(`Objectif: ${payload.plan.goal}`);
      }
      if (payload.plan.deliveryNotes) {
        doc.moveDown(0.5).text(payload.plan.deliveryNotes);
      }
      doc.moveDown();
      payload.plan.workouts.forEach((workout, index) => {
        doc
          .fontSize(16)
          .fillColor("#111")
          .text(`Bloc ${index + 1}: ${workout.day ?? `Jour ${index + 1}`}`, { continued: false });
        doc.fontSize(12).fillColor("#333").text(workout.focus ?? "Focus personnalisé");
        doc.moveDown(0.3);
        (workout.exercises ?? []).forEach((exercise, idx) => {
          const parts: string[] = [];
          if (exercise.sets || exercise.reps) parts.push(`${exercise.sets ?? "?"} x ${exercise.reps ?? "?"}`);
          if (exercise.tempo) parts.push(`tempo ${exercise.tempo}`);
          if (exercise.rest) parts.push(`repos ${exercise.rest}`);
          if (exercise.notes) parts.push(exercise.notes);
          doc
            .fontSize(11)
            .fillColor("#111")
            .text(`${idx + 1}. ${exercise.name ?? "Exercice"}`, { indent: 18 });
          if (parts.length) {
            doc.fontSize(10).fillColor("#555").text(parts.join(" • "), { indent: 36 });
          }
        });
        if (workout.notes) {
          doc.moveDown(0.2).fontSize(10).fillColor("#777").text(`Notes: ${workout.notes}`, { indent: 18 });
        }
        doc.moveDown();
      });
      doc
        .fontSize(10)
        .fillColor("#555")
        .text("Partage direct:", { continued: true })
        .fillColor("#111")
        .text(` ${payload.shareLink}`);
      doc.end();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'exporter le PDF." });
    }
  }
};
