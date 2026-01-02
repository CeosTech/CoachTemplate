import type { NextFunction, Response } from "express";
import { prisma } from "../db/prisma";
import type { AuthedRequest } from "./auth";

export async function requireActiveMember(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "MEMBER") {
    return res.status(403).json({ message: "Forbidden" });
  }

  const profile = await prisma.memberProfile.findUnique({ where: { userId: req.user.id }, select: { isActivated: true } });
  if (!profile?.isActivated) {
    return res.status(402).json({ message: "Paiement requis pour accéder au dashboard." });
  }

  next();
}
