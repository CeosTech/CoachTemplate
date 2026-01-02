import { Router } from "express";
import { publicController } from "./public.controller";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireActiveMember } from "../../middlewares/member-access";
import { siteController } from "../site/site.controller";
import { programController } from "../programs/program.controller";

export const publicRoutes = Router();

publicRoutes.get("/brand", publicController.brand);
publicRoutes.get("/site", siteController.publicSite);
publicRoutes.get("/products", publicController.products);
publicRoutes.get("/availability", publicController.availability);
publicRoutes.post("/contact", publicController.contact);
publicRoutes.get("/programs/share/:token", programController.share);

// réservation (adhérent connecté)
publicRoutes.post("/book", requireAuth, requireRole("MEMBER"), requireActiveMember, publicController.book);
