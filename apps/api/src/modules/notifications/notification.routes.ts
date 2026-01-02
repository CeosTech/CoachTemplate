import { Router } from "express";
import { notificationController } from "./notification.controller";
import { requireAuth, requireRole } from "../../middlewares/auth";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.post("/", requireRole("COACH"), notificationController.create);
notificationRoutes.get("/coach", requireRole("COACH"), notificationController.listForCoach);
notificationRoutes.get("/member", requireRole("MEMBER"), notificationController.listForMember);
notificationRoutes.patch("/:id", notificationController.updateStatus);
notificationRoutes.delete("/:id", notificationController.remove);
