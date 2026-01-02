import { AuthedRequest } from "../../middlewares/auth";
import { onboardingService } from "./onboarding.service";

const VALID_STATUSES = ["PENDING", "COMPLETED", "SKIPPED"];

export const onboardingController = {
  async memberList(req: AuthedRequest, res: any) {
    const steps = await onboardingService.listForMember(req.user!.id);
    res.json(steps);
  },

  async memberUpdate(req: AuthedRequest, res: any) {
    const { status } = req.body ?? {};
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ message: "Statut invalide" });
    const step = await onboardingService.updateStatusForMember(req.user!.id, req.params.stepId, status);
    res.json(step);
  },

  async coachList(req: AuthedRequest, res: any) {
    const steps = await onboardingService.listForCoach(req.params.id);
    res.json(steps);
  },

  async alerts(_req: AuthedRequest, res: any) {
    const alerts = await onboardingService.coachAlerts();
    res.json(alerts);
  },

  async coachCreate(req: AuthedRequest, res: any) {
    const { title, description, dueDate, status } = req.body ?? {};
    if (!title) return res.status(400).json({ message: "Titre requis" });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ message: "Statut invalide" });
    try {
      const created = await onboardingService.createStepForCoach(req.params.id, {
        title,
        description,
        dueDate,
        status
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'ajouter l'étape" });
    }
  },

  async coachUpdate(req: AuthedRequest, res: any) {
    const { title, description, dueDate, status } = req.body ?? {};
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ message: "Statut invalide" });
    try {
      const updated = await onboardingService.updateStepForCoach(req.params.id, req.params.stepId, {
        title,
        description,
        dueDate,
        status
      });
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour l'étape" });
    }
  },

  async coachDelete(req: AuthedRequest, res: any) {
    try {
      await onboardingService.deleteStepForCoach(req.params.id, req.params.stepId);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de supprimer l'étape" });
    }
  },

  async templateList(req: AuthedRequest, res: any) {
    const templates = await onboardingService.listTemplates(req.user!.id);
    res.json(templates);
  },

  async templateCreate(req: AuthedRequest, res: any) {
    try {
      const template = await onboardingService.createTemplate(req.user!.id, req.body ?? {});
      res.status(201).json(template);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de créer le template" });
    }
  },

  async templateUpdate(req: AuthedRequest, res: any) {
    try {
      const template = await onboardingService.updateTemplate(req.user!.id, req.params.templateId, req.body ?? {});
      res.json(template);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour le template" });
    }
  },

  async templateDelete(req: AuthedRequest, res: any) {
    try {
      await onboardingService.deleteTemplate(req.user!.id, req.params.templateId);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de supprimer le template" });
    }
  },

  async applyTemplate(req: AuthedRequest, res: any) {
    try {
      const steps = await onboardingService.applyTemplate(req.user!.id, req.params.id, req.params.templateId);
      res.json(steps);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'appliquer le template" });
    }
  }
};
