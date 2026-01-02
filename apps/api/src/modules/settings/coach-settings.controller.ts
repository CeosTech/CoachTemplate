import { AuthedRequest } from "../../middlewares/auth";
import { coachSettingsService } from "./coach-settings.service";

export const coachSettingsController = {
  async profile(req: AuthedRequest, res: any) {
    try {
      const data = await coachSettingsService.getProfile(req.user!.id);
      res.json(data);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Erreur profil coach" });
    }
  },

  async updateProfile(req: AuthedRequest, res: any) {
    try {
      const payload = {
        email: req.body?.email,
        brandName: req.body?.brandName,
        tagline: req.body?.tagline,
        logoUrl: req.body?.logoUrl,
        primaryColor: req.body?.primaryColor
      };
      const updated = await coachSettingsService.updateProfile(req.user!.id, payload);
      res.json(updated);
    } catch (err: any) {
      const status = err?.code === "P2002" ? 409 : err?.status ?? 500;
      const message = err?.code === "P2002" ? "Email déjà utilisé" : err?.message ?? "Impossible de mettre à jour";
      res.status(status).json({ message });
    }
  },

  async integrations(req: AuthedRequest, res: any) {
    try {
      const data = await coachSettingsService.getIntegrations(req.user!.id);
      res.json(data);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Erreur intégrations" });
    }
  },

  async updateIntegrations(req: AuthedRequest, res: any) {
    try {
      const updated = await coachSettingsService.updateIntegrations(req.user!.id, req.body ?? {});
      res.json(updated);
    } catch (err: any) {
      res.status(err?.status ?? 500).json({ message: err?.message ?? "Impossible de sauvegarder les intégrations" });
    }
  }
};
