import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/error";

import { publicRoutes } from "./modules/public/public.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { coachSiteRoutes } from "./modules/site/site.routes";
import { contactRoutes } from "./modules/contact/contact.routes";
import { memberRoutes } from "./modules/member/member.routes";
import { notificationRoutes } from "./modules/notifications/notification.routes";
import { paymentRoutes } from "./modules/payments/payment.routes";
import { paymentController } from "./modules/payments/payment.controller";
import { coachProductRoutes } from "./modules/products/product.routes";
import { coachSettingsRoutes } from "./modules/settings/coach-settings.routes";
import { coachAvailabilityRoutes } from "./modules/availability/coach-availability.routes";
import { coachBookingRoutes } from "./modules/booking/coach-booking.routes";
import { coachProgramRoutes } from "./modules/programs/program.routes";
import { coachExerciseVideoRoutes, memberExerciseVideoRoutes } from "./modules/exercise-videos/exercise-video.routes";

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.post("/api/payments/webhook/stripe", express.raw({ type: "application/json" }), paymentController.stripeWebhook);
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/coach/site", coachSiteRoutes);
  app.use("/api/contact", contactRoutes);
  app.use("/api/member/videos", memberExerciseVideoRoutes);
  app.use("/api/member", memberRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/coach/products", coachProductRoutes);
  app.use("/api/coach/settings", coachSettingsRoutes);
  app.use("/api/coach/availability", coachAvailabilityRoutes);
  app.use("/api/coach/bookings", coachBookingRoutes);
  app.use("/api/coach/programs", coachProgramRoutes);
  app.use("/api/coach/videos", coachExerciseVideoRoutes);

  app.use(errorHandler);
  return app;
}
