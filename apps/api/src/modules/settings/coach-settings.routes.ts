import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { coachSettingsController } from "./coach-settings.controller";

export const coachSettingsRoutes = Router();

coachSettingsRoutes.use(requireAuth, requireRole("COACH"));

coachSettingsRoutes.get("/profile", coachSettingsController.profile);
coachSettingsRoutes.patch("/profile", coachSettingsController.updateProfile);
coachSettingsRoutes.get("/integrations", coachSettingsController.integrations);
coachSettingsRoutes.patch("/integrations", coachSettingsController.updateIntegrations);
