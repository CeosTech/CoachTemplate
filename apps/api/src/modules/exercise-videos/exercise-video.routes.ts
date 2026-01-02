import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { requireActiveMember } from "../../middlewares/member-access";
import { exerciseVideoController } from "./exercise-video.controller";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const VIDEO_DIR = path.join(UPLOAD_ROOT, "videos");

if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const extension = path.extname(file.originalname);
    const base = path.basename(file.originalname, extension).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-_]/g, "");
    const name = `${timestamp}-${random}-${base || "video"}${extension || ".mp4"}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("video/") && !file.originalname.match(/\.(mp4|mov|m4v|webm|avi)$/i)) {
      cb(new Error("Format vidéo non supporté"));
      return;
    }
    cb(null, true);
  }
});

export const coachExerciseVideoRoutes = Router();
coachExerciseVideoRoutes.use(requireAuth, requireRole("COACH"));
coachExerciseVideoRoutes.get("/", exerciseVideoController.coachList);
coachExerciseVideoRoutes.post("/", upload.single("video"), exerciseVideoController.create);
coachExerciseVideoRoutes.delete("/:id", exerciseVideoController.remove);

export const memberExerciseVideoRoutes = Router();
memberExerciseVideoRoutes.use(requireAuth, requireRole("MEMBER"), requireActiveMember);
memberExerciseVideoRoutes.get("/", exerciseVideoController.memberList);
