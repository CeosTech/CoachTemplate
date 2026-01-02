import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";

export type AuthedRequest = Request & { user?: { id: string; role: "COACH" | "MEMBER" } };

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(role: "COACH" | "MEMBER") {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== role) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
