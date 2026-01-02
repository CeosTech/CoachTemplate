import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { bookingController } from "./booking.controller";

export const coachBookingRoutes = Router();

coachBookingRoutes.use(requireAuth, requireRole("COACH"));
coachBookingRoutes.get("/", bookingController.coachList);
coachBookingRoutes.patch("/:id", bookingController.coachUpdate);
