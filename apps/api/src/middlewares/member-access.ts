import type { NextFunction, Response } from "express";
import { prisma } from "../db/prisma";
import type { AuthedRequest } from "./auth";

export async function requireActiveMember(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "MEMBER") {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Accès libre : on laisse les membres explorer le dashboard même sans pack actif.
  // L'achat peut être réalisé directement depuis l'espace membre.
  await prisma.memberProfile.findUnique({ where: { userId: req.user.id }, select: { isActivated: true } });

  next();
}
