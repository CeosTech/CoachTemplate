import { AuthedRequest } from "../../middlewares/auth";
import { memberService } from "./member.service";

export const memberController = {
  async dashboard(req: AuthedRequest, res: any) {
    const data = await memberService.getDashboard(req.user!.id);
    res.json(data);
  },

  async listMembers(req: AuthedRequest, res: any) {
    const { search, level } = req.query ?? {};
    res.json(await memberService.listMembers({ search: typeof search === "string" ? search : undefined, level: typeof level === "string" ? level : undefined }));
  },

  async packs(req: AuthedRequest, res: any) {
    const packs = await memberService.listOwnPacks(req.user!.id);
    res.json(packs);
  },

  async detail(req: AuthedRequest, res: any) {
    res.json(await memberService.getMemberDetail(req.params.id));
  },

  async create(req: AuthedRequest, res: any) {
    try {
      const created = await memberService.createMember({
        email: req.body?.email,
        fullName: req.body?.fullName,
        goal: req.body?.goal,
        level: req.body?.level,
        age: req.body?.age ? Number(req.body.age) : undefined,
        heightCm: req.body?.heightCm ? Number(req.body.heightCm) : undefined,
        weightKg: req.body?.weightKg ? Number(req.body.weightKg) : undefined,
        preferredTraining: req.body?.preferredTraining,
        limitations: req.body?.limitations
      });
      res.status(201).json(created);
    } catch (err: any) {
      const status = err?.status ?? 500;
      res.status(status).json({ message: err?.message ?? "Erreur création membre" });
    }
  },

  async getOwnProfile(req: AuthedRequest, res: any) {
    try {
      const profile = await memberService.getOwnProfile(req.user!.id);
      res.json(profile);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Erreur profil" });
    }
  },

  async updateOwnProfile(req: AuthedRequest, res: any) {
    try {
      const payload = {
        email: req.body?.email,
        fullName: req.body?.fullName,
        goal: req.body?.goal,
        level: req.body?.level,
        age: req.body?.age !== undefined ? Number(req.body.age) : undefined,
        heightCm: req.body?.heightCm !== undefined ? Number(req.body.heightCm) : undefined,
        weightKg: req.body?.weightKg !== undefined ? Number(req.body.weightKg) : undefined,
        preferredTraining: req.body?.preferredTraining,
        limitations: req.body?.limitations
      };
      const updated = await memberService.updateOwnProfile(req.user!.id, payload);
      res.json(updated);
    } catch (err: any) {
      const status = err?.code === "P2002" ? 409 : err?.status ?? 500;
      const message =
        err?.code === "P2002" ? "Email déjà utilisé" : err?.message ?? "Impossible de mettre à jour le profil";
      res.status(status).json({ message });
    }
  },

  async updateCoachNotes(req: AuthedRequest, res: any) {
    try {
      const { programNotes, followUpNotes } = req.body ?? {};
      const updated = await memberService.updateCoachNotes(req.params.id, {
        programNotes: programNotes ?? undefined,
        followUpNotes: followUpNotes ?? undefined
      });
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de mettre à jour les notes coach" });
    }
  }
};
