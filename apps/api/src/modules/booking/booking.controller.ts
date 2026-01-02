import { AuthedRequest } from "../../middlewares/auth";
import { bookingService } from "./booking.service";

const STATUS_FILTERS = ["PENDING", "CONFIRMED", "REFUSED"];

export function parseBookingFilters(query: Record<string, any>) {
  const filters: { status?: "PENDING" | "CONFIRMED" | "REFUSED"; productId?: string } = {};
  if (typeof query.status === "string" && STATUS_FILTERS.includes(query.status)) {
    filters.status = query.status as "PENDING" | "CONFIRMED" | "REFUSED";
  }
  if (typeof query.productId === "string") {
    const value = query.productId.trim();
    if (value && value.toUpperCase() !== "ALL") {
      filters.productId = value;
    }
  }
  return filters;
}

export const bookingController = {
  async memberList(req: AuthedRequest, res: any) {
    const filters = parseBookingFilters(req.query as Record<string, any>);
    const bookings = await bookingService.listForMember(req.user!.id, filters);
    res.json(bookings);
  },

  async coachList(req: AuthedRequest, res: any) {
    const filters = parseBookingFilters(req.query as Record<string, any>);
    const bookings = await bookingService.listForCoach(req.user!.id, filters);
    res.json(bookings);
  },

  async coachUpdate(req: AuthedRequest, res: any) {
    const { status, coachNotes } = req.body ?? {};
    if (!status) return res.status(400).json({ message: "Statut requis" });
    const updated = await bookingService.updateStatusByCoach(req.user!.id, req.params.id, status, coachNotes);
    res.json(updated);
  }
};
