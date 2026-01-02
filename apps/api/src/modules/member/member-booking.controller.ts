import { AuthedRequest } from "../../middlewares/auth";
import { bookingService } from "../booking/booking.service";
import { parseBookingFilters } from "../booking/booking.controller";

export const memberBookingController = {
  async list(req: AuthedRequest, res: any) {
    const filters = parseBookingFilters(req.query as Record<string, any>);
    const bookings = await bookingService.listForMember(req.user!.id, filters);
    res.json(bookings);
  }
};
