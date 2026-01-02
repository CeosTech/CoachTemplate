import { AuthedRequest } from "../../middlewares/auth";
import { availabilityRuleService } from "./availability-rule.service";

export const availabilityRuleController = {
  async list(req: AuthedRequest, res: any) {
    const rules = await availabilityRuleService.list(req.user!.id);
    res.json(rules);
  },

  async create(req: AuthedRequest, res: any) {
    try {
      const { weekday, startTime, endTime } = req.body ?? {};
      const created = await availabilityRuleService.create(req.user!.id, { weekday: Number(weekday), startTime, endTime });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'ajouter l'horaire." });
    }
  },

  async update(req: AuthedRequest, res: any) {
    try {
      const { weekday, startTime, endTime } = req.body ?? {};
      const updated = await availabilityRuleService.update(req.user!.id, req.params.id, {
        weekday: weekday !== undefined ? Number(weekday) : undefined,
        startTime,
        endTime
      });
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour l'horaire." });
    }
  },

  async remove(req: AuthedRequest, res: any) {
    try {
      await availabilityRuleService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Suppression impossible." });
    }
  },

  async apply(req: AuthedRequest, res: any) {
    try {
      const { days, startDate } = req.body ?? {};
      const result = await availabilityRuleService.apply(req.user!.id, {
        days: days !== undefined ? Number(days) : undefined,
        startDate
      });
      res.json(result);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de générer les créneaux." });
    }
  }
};
