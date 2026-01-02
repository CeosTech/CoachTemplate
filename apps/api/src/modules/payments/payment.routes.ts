import { Router } from "express";
import { paymentController } from "./payment.controller";
import { requireAuth, requireRole } from "../../middlewares/auth";

export const paymentRoutes = Router();

paymentRoutes.use(requireAuth);
paymentRoutes.post("/checkout", requireRole("MEMBER"), paymentController.checkout);
paymentRoutes.post("/coach/cash", requireRole("COACH"), paymentController.createCashPayment);
paymentRoutes.get("/member", requireRole("MEMBER"), paymentController.listMember);
paymentRoutes.get("/coach", requireRole("COACH"), paymentController.listCoach);
paymentRoutes.get("/coach/report", requireRole("COACH"), paymentController.report);
paymentRoutes.get("/:id/receipt", paymentController.receipt);
paymentRoutes.patch("/:id", requireRole("COACH"), paymentController.updateStatus);
paymentRoutes.delete("/:id", requireRole("COACH"), paymentController.remove);
