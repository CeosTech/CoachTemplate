import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { buildPagination, buildMeta, PaginatedResult } from "../../utils/pagination";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

function fileUrl(fileKey: string) {
  const base = (env.API_BASE_URL ?? `http://localhost:${env.PORT ?? 4000}`).replace(/\/$/, "");
  const normalizedKey = fileKey.replace(/^\/+/, "").replace(/\\/g, "/");
  return `${base}/uploads/${normalizedKey}`.replace(/([^:]\/)\/+/g, "$1");
}

function normalizeExternalUrl(raw?: string) {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("URL vidéo invalide");
    }
    return parsed.toString();
  } catch {
    throw Object.assign(new Error("URL vidéo invalide"), { status: 400 });
  }
}

async function getCoachProfileByUser(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!coach) throw Object.assign(new Error("Coach introuvable"), { status: 404 });
  return coach;
}

async function resolveCoachIdForMember(userId: string) {
  const member = await prisma.memberProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      assignedPrograms: { select: { coachId: true }, orderBy: { createdAt: "desc" }, take: 1 }
    }
  });
  if (!member) throw Object.assign(new Error("Profil membre introuvable"), { status: 404 });
  const coachId = member.assignedPrograms[0]?.coachId;
  if (coachId) return coachId;
  const fallbackCoach = await prisma.coachProfile.findFirst({ select: { id: true } });
  if (!fallbackCoach) throw Object.assign(new Error("Aucun coach configuré"), { status: 404 });
  return fallbackCoach.id;
}

export const exerciseVideoService = {
  async listForCoach(userId: string, params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const coach = await getCoachProfileByUser(userId);
    const pagination = buildPagination(params);
    const where = { coachId: coach.id };
    const [videos, total] = await prisma.$transaction([
      prisma.exerciseVideo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.exerciseVideo.count({ where })
    ]);
    return {
      items: videos,
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  },

  async create(
    userId: string,
    payload: { title?: string; description?: string; category?: string; fileKey?: string; externalUrl?: string }
  ) {
    if (!payload?.title) throw Object.assign(new Error("Titre requis"), { status: 400 });
    if (!payload.fileKey && !payload.externalUrl) {
      throw Object.assign(new Error("Ajoute un fichier ou un lien vidéo."), { status: 400 });
    }
    const coach = await getCoachProfileByUser(userId);
    const normalizedCategory = payload.category?.trim() || "Général";
    const finalUrl = payload.fileKey ? fileUrl(payload.fileKey) : normalizeExternalUrl(payload.externalUrl)!;
    return prisma.exerciseVideo.create({
      data: {
        coachId: coach.id,
        title: payload.title,
        description: payload.description,
        category: normalizedCategory,
        fileKey: payload.fileKey,
        videoUrl: finalUrl
      }
    });
  },

  async remove(userId: string, id: string) {
    const coach = await getCoachProfileByUser(userId);
    const video = await prisma.exerciseVideo.findUnique({ where: { id } });
    if (!video || video.coachId !== coach.id) throw Object.assign(new Error("Vidéo introuvable"), { status: 404 });
    await prisma.exerciseVideo.delete({ where: { id } });
    if (video.fileKey) {
      const absolutePath = path.join(UPLOAD_ROOT, video.fileKey);
      await fs.unlink(absolutePath).catch(() => {});
    }
    return video;
  },

  async listForMember(userId: string, params?: { page?: number | string; pageSize?: number | string }): Promise<PaginatedResult<any>> {
    const coachId = await resolveCoachIdForMember(userId);
    const pagination = buildPagination(params);
    const where = { coachId };
    const [videos, total] = await prisma.$transaction([
      prisma.exerciseVideo.findMany({
        where,
        orderBy: [
          { category: "asc" },
          { createdAt: "desc" }
        ],
        skip: pagination.skip,
        take: pagination.take
      }),
      prisma.exerciseVideo.count({ where })
    ]);
    return {
      items: videos,
      pagination: buildMeta(pagination.page, pagination.pageSize, total)
    };
  }
};
