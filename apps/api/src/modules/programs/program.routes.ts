import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { programController } from "./program.controller";

export const coachProgramRoutes = Router();

coachProgramRoutes.use(requireAuth, requireRole("COACH"));
coachProgramRoutes.get("/", programController.list);
coachProgramRoutes.post("/", programController.create);
coachProgramRoutes.get("/:id", programController.detail);
coachProgramRoutes.patch("/:id", programController.update);
coachProgramRoutes.delete("/:id", programController.remove);
coachProgramRoutes.post("/:id/assign", programController.assign);
coachProgramRoutes.get("/:id/export/share", programController.exportShare);
coachProgramRoutes.get("/:id/export/pdf", programController.exportPdf);
