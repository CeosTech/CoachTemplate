import { Router } from "express";
import { contactController } from "./contact.controller";
import { requireAuth, requireRole } from "../../middlewares/auth";

export const contactRoutes = Router();

contactRoutes.post("/", contactController.submit);
contactRoutes.use(requireAuth, requireRole("COACH"));
contactRoutes.get("/", contactController.list);
contactRoutes.patch("/:id", contactController.updateStatus);
