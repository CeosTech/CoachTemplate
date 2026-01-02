import { Request, Response } from "express";
import { publicService } from "./public.service";
import { bookingService } from "../booking/booking.service";
import { AuthedRequest } from "../../middlewares/auth";
import { contactService } from "../contact/contact.service";

export const publicController = {
  async brand(_req: Request, res: Response) {
    res.json(await publicService.getBrand());
  },

  async products(_req: Request, res: Response) {
    res.json(await publicService.getProducts());
  },

  async availability(_req: Request, res: Response) {
    res.json(await publicService.getAvailability());
  },

  async book(req: AuthedRequest, res: Response) {
    const created = await bookingService.createBookingSingleCoach(req.user!.id, req.body);
    res.status(201).json(created);
  },

  async contact(req: Request, res: Response) {
    const { fullName, email, subject, message } = req.body ?? {};
    if (!fullName || !email || !subject || !message) return res.status(400).json({ message: "Missing fields" });
    const created = await contactService.submitMessage({ fullName, email, subject, message });
    res.status(201).json(created);
  }
};
