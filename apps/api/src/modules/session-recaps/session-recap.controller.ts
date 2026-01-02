import type { Response } from "express";
import { AuthedRequest } from "../../middlewares/auth";
import { sessionRecapService } from "./session-recap.service";

export const sessionRecapController = {
  async memberList(req: AuthedRequest, res: Response) {
    const { page, pageSize } = req.query ?? {};
    const recaps = await sessionRecapService.listForMember(req.user!.id, { page, pageSize });
    res.json(recaps);
  },

  async memberCreate(req: AuthedRequest, res: Response) {
    const { sessionDate, focus, intensity, notes, exercises } = req.body ?? {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: "Ajoute au moins un exercice" });
    }
    const recap = await sessionRecapService.createForMemberUser(req.user!.id, { sessionDate, focus, intensity, notes, exercises });
    res.status(201).json(recap);
  },

  async memberUpdate(req: AuthedRequest, res: Response) {
    const { sessionDate, focus, intensity, notes, exercises } = req.body ?? {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: "Ajoute au moins un exercice" });
    }
    const recap = await sessionRecapService.updateForMemberUser(req.user!.id, req.params.recapId, {
      sessionDate,
      focus,
      intensity,
      notes,
      exercises
    });
    res.json(recap);
  },

  async memberRemove(req: AuthedRequest, res: Response) {
    await sessionRecapService.removeForMemberUser(req.user!.id, req.params.recapId);
    res.status(204).send();
  },

  async coachList(req: AuthedRequest, res: Response) {
    const { page, pageSize } = req.query ?? {};
    const recaps = await sessionRecapService.listForCoach(req.params.id, { page, pageSize });
    res.json(recaps);
  },

  async create(req: AuthedRequest, res: Response) {
    const { sessionDate, focus, intensity, notes, exercises } = req.body ?? {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: "Ajoute au moins un exercice" });
    }
    const recap = await sessionRecapService.create(req.params.id, { sessionDate, focus, intensity, notes, exercises });
    res.status(201).json(recap);
  },

  async update(req: AuthedRequest, res: Response) {
    const { sessionDate, focus, intensity, notes, exercises } = req.body ?? {};
    if (!Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: "Ajoute au moins un exercice" });
    }
    const recap = await sessionRecapService.update(req.params.id, req.params.recapId, { sessionDate, focus, intensity, notes, exercises });
    res.json(recap);
  },

  async remove(req: AuthedRequest, res: Response) {
    await sessionRecapService.remove(req.params.id, req.params.recapId);
    res.status(204).send();
  }
};
