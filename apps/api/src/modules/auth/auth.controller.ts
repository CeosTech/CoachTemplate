import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { hashPassword, verifyPassword } from "../../utils/password";
import { signAccessToken, verifyAccessToken } from "../../utils/jwt";
import { onboardingService, onboardingStepTitles } from "../onboarding/onboarding.service";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../../services/messaging.service";

const clientBaseUrl = (env.CORS_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
const RESET_EXPIRATION_MS = 60 * 60 * 1000;

export const authController = {
  async register(req: Request, res: Response) {
    const { email, password, fullName, goal, level, age, heightCm, weightKg, preferredTraining, limitations } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: "Email already used" });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: "MEMBER",
        memberProfile: {
          create: {
            fullName: fullName ?? "Client",
            goal,
            level,
            age: age ? Number(age) : undefined,
            heightCm: heightCm ? Number(heightCm) : undefined,
            weightKg: weightKg ? Number(weightKg) : undefined,
            preferredTraining,
            limitations
          }
        }
      },
      include: { memberProfile: true }
    });
    const profileId = user.memberProfile?.id;
    if (profileId) {
      await onboardingService.seedForMember(profileId);
      const titles = await onboardingStepTitles();
      await sendWelcomeEmail(email, titles);
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
    res.status(201).json({ user: { id: user.id, email: user.email, role: user.role }, accessToken });
  },

  async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ message: "Missing fields" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const accessToken = signAccessToken({ sub: user.id, role: user.role }, env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);
    res.json({ user: { id: user.id, email: user.email, role: user.role }, accessToken });
  },

  async forgotPassword(req: Request, res: Response) {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ message: "Email requis" });
    const genericResponse = { message: "Si un compte existe, un email vient d'être envoyé." };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json(genericResponse);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + RESET_EXPIRATION_MS);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt }
    });

    const resetLink = `${clientBaseUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(user.email, resetLink);
    res.json(genericResponse);
  },

  async resetPassword(req: Request, res: Response) {
    const { token, password } = req.body ?? {};
    if (!token || !password) return res.status(400).json({ message: "Token et mot de passe requis" });
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt) return res.status(400).json({ message: "Lien invalide" });
    if (record.expiresAt.getTime() < Date.now()) return res.status(400).json({ message: "Lien expiré" });

    const hash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash: hash } });
      await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    });
    res.json({ message: "Mot de passe mis à jour. Tu peux te reconnecter." });
  },

  async me(req: Request, res: Response) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
    try {
      const token = header.slice(7);
      const payload = verifyAccessToken(token, env.JWT_ACCESS_SECRET);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { coachProfile: true, memberProfile: true } });
      res.json(user);
    } catch {
      res.status(401).json({ message: "Invalid token" });
    }
  }
};
