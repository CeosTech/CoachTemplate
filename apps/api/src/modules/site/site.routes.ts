import { Router } from "express";
import { siteController } from "./site.controller";
import { requireAuth, requireRole } from "../../middlewares/auth";

export const coachSiteRoutes = Router();

coachSiteRoutes.use(requireAuth, requireRole("COACH"));
coachSiteRoutes.get("/", siteController.getOwn);
coachSiteRoutes.put("/", siteController.update);
