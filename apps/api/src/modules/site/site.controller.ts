import { Request, Response } from "express";
import { siteService } from "./site.service";
import { AuthedRequest } from "../../middlewares/auth";

export const siteController = {
  async publicSite(_req: Request, res: Response) {
    res.json(await siteService.getPublicSite());
  },

  async getOwn(req: AuthedRequest, res: Response) {
    res.json(await siteService.getCoachSite(req.user!.id));
  },

  async update(req: AuthedRequest, res: Response) {
    const updated = await siteService.updateCoachSite(req.user!.id, req.body);
    res.json(updated);
  }
};
