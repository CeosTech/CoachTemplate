import { AuthedRequest } from "../../middlewares/auth";
import { productService } from "./product.service";

function normalizeCredits(value: any) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

export const coachProductController = {
  async list(req: AuthedRequest, res: any) {
    const items = await productService.list(req.user!.id);
    res.json(items);
  },

  async create(req: AuthedRequest, res: any) {
    const { title, description, priceCents, billingInterval, checkoutUrl, creditValue } = req.body ?? {};
    if (!title || !priceCents) return res.status(400).json({ message: "Titre et prix requis" });
    const normalizedCredits = normalizeCredits(creditValue);
    if (!normalizedCredits) return res.status(400).json({ message: "Définis un nombre d'heures pour ce pack." });
    const created = await productService.create(req.user!.id, {
      title,
      description,
      priceCents: Number(priceCents),
      billingInterval,
      checkoutUrl,
      creditValue: normalizedCredits
    });
    res.status(201).json(created);
  },

  async update(req: AuthedRequest, res: any) {
    const { title, description, priceCents, billingInterval, checkoutUrl, isActive, creditValue } = req.body ?? {};
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priceCents !== undefined) data.priceCents = Number(priceCents);
    if (billingInterval !== undefined) data.billingInterval = billingInterval;
    if (checkoutUrl !== undefined) data.checkoutUrl = checkoutUrl;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (creditValue !== undefined) {
      const normalizedCredits = normalizeCredits(creditValue);
      if (!normalizedCredits)
        return res.status(400).json({ message: "Le nombre d'heures doit être un entier positif." });
      data.creditValue = normalizedCredits;
    }

    const updated = await productService.update(req.user!.id, req.params.id, data);
    res.json(updated);
  },

  async remove(req: AuthedRequest, res: any) {
    await productService.remove(req.user!.id, req.params.id);
    res.status(204).send();
  }
};
