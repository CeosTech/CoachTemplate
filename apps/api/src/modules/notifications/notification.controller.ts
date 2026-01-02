import { Request, Response } from "express";
import { notificationService } from "./notification.service";
import { AuthedRequest } from "../../middlewares/auth";

export const notificationController = {
  async create(req: AuthedRequest, res: Response) {
    const { title, body, memberId, audience } = req.body ?? {};
    if (!title || !body) return res.status(400).json({ message: "Missing fields" });
    if (audience === "ALL") {
      await notificationService.createForAll(title, body);
      return res.status(201).json({ ok: true });
    }
    const created = await notificationService.create({ title, body, memberId });
    res.status(201).json(created);
  },

  async listForCoach(_req: AuthedRequest, res: Response) {
    res.json(await notificationService.listAll());
  },

  async listForMember(req: AuthedRequest, res: Response) {
    res.json(await notificationService.listForMember(req.user!.id));
  },

  async updateStatus(req: AuthedRequest, res: Response) {
    const { status } = req.body ?? {};
    if (!status || !["UNREAD", "READ"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const updated = await notificationService.updateStatusForUser(req.user!.id, req.user!.role as "COACH" | "MEMBER", req.params.id, status);
    res.json(updated);
  },

  async remove(req: AuthedRequest, res: Response) {
    await notificationService.deleteForUser(req.user!.id, req.user!.role as "COACH" | "MEMBER", req.params.id);
    res.status(204).end();
  }
};
