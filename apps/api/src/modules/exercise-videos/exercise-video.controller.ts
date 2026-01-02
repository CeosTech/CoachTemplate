import type { Response } from "express";
import type { AuthedRequest } from "../../middlewares/auth";
import { exerciseVideoService } from "./exercise-video.service";
import path from "node:path";
import fs from "node:fs/promises";

export const exerciseVideoController = {
  async coachList(req: AuthedRequest, res: Response) {
    try {
      const { page, pageSize } = req.query ?? {};
      const list = await exerciseVideoService.listForCoach(req.user!.id, { page, pageSize });
      res.json(list);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de charger les vidéos" });
    }
  },

  async memberList(req: AuthedRequest, res: Response) {
    try {
      const { page, pageSize } = req.query ?? {};
      const list = await exerciseVideoService.listForMember(req.user!.id, { page, pageSize });
      res.json(list);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de charger les vidéos" });
    }
  },

  async create(req: AuthedRequest, res: Response) {
    const { title, description, category } = req.body ?? {};
    const externalUrl =
      typeof req.body?.externalUrl === "string" && req.body.externalUrl.trim().length > 0
        ? req.body.externalUrl.trim()
        : undefined;
    const fileKey = req.file ? path.posix.join("videos", req.file.filename) : undefined;
    if (!fileKey && !externalUrl) {
      return res.status(400).json({ message: "Ajoutez un fichier ou un lien vidéo." });
    }
    try {
      const created = await exerciseVideoService.create(req.user!.id, {
        title,
        description,
        category,
        fileKey,
        externalUrl
      });
      res.status(201).json(created);
    } catch (err: any) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible d'enregistrer la vidéo" });
    }
  },

  async remove(req: AuthedRequest, res: Response) {
    try {
      await exerciseVideoService.remove(req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Suppression impossible" });
    }
  }
};
