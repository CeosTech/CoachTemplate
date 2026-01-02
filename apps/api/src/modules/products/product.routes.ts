import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { coachProductController } from "./product.controller";

export const coachProductRoutes = Router();

coachProductRoutes.use(requireAuth, requireRole("COACH"));

coachProductRoutes.get("/", coachProductController.list);
coachProductRoutes.post("/", coachProductController.create);
coachProductRoutes.patch("/:id", coachProductController.update);
coachProductRoutes.delete("/:id", coachProductController.remove);
