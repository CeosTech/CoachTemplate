import { AuthedRequest } from "../../middlewares/auth";
import { coachAvailabilityService } from "./coach-availability.service";

export const coachAvailabilityController = {
  async list(req: AuthedRequest, res: any) {
    const slots = await coachAvailabilityService.list(req.user!.id);
    res.json(slots);
  },

  async create(req: AuthedRequest, res: any) {
    try {
      const created = await coachAvailabilityService.create(req.user!.id, req.body ?? {});
      res.status(201).json(created);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de créer le créneau" });
    }
  },

  async update(req: AuthedRequest, res: any) {
    try {
      const updated = await coachAvailabilityService.update(req.user!.id, req.params.id, req.body ?? {});
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour le créneau" });
    }
  },

  async remove(req: AuthedRequest, res: any) {
    try {
      await coachAvailabilityService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de supprimer le créneau" });
    }
  }
};
