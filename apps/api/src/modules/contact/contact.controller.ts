import { Request, Response } from "express";
import { contactService } from "./contact.service";

export const contactController = {
  async submit(req: Request, res: Response) {
    const { fullName, email, subject, message } = req.body ?? {};
    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const created = await contactService.submitMessage({ fullName, email, subject, message });
    res.status(201).json(created);
  },

  async list(_req: Request, res: Response) {
    res.json(await contactService.listMessages());
  },

  async updateStatus(req: Request, res: Response) {
    const { status } = req.body ?? {};
    const { id } = req.params;
    if (!status || !["NEW", "READ", "ARCHIVED"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const updated = await contactService.updateStatus(id, status);
    res.json(updated);
  }
};
