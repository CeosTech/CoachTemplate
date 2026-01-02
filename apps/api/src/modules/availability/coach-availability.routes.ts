import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { coachAvailabilityController } from "./coach-availability.controller";
import { availabilityRuleController } from "./availability-rule.controller";

export const coachAvailabilityRoutes = Router();

coachAvailabilityRoutes.use(requireAuth, requireRole("COACH"));

coachAvailabilityRoutes.get("/", coachAvailabilityController.list);
coachAvailabilityRoutes.post("/", coachAvailabilityController.create);

coachAvailabilityRoutes.get("/rules/all", availabilityRuleController.list);
coachAvailabilityRoutes.post("/rules", availabilityRuleController.create);
coachAvailabilityRoutes.patch("/rules/:id", availabilityRuleController.update);
coachAvailabilityRoutes.delete("/rules/:id", availabilityRuleController.remove);
coachAvailabilityRoutes.post("/rules/apply", availabilityRuleController.apply);

coachAvailabilityRoutes.patch("/:id", coachAvailabilityController.update);
coachAvailabilityRoutes.delete("/:id", coachAvailabilityController.remove);
