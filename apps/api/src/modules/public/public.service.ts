import { prisma } from "../../db/prisma";
import { siteService } from "../site/site.service";

async function getSingleCoach() {
  const coach = await prisma.coachProfile.findFirst({ where: { isActive: true } });
  if (!coach) throw Object.assign(new Error("No coach configured"), { status: 500 });
  return coach;
}

export const publicService = {
  async getBrand() {
    const site = await siteService.getPublicSite();
    return site.brand;
  },

  async getProducts() {
    const coach = await getSingleCoach();
    return prisma.product.findMany({
      where: { coachId: coach.id, isActive: true },
      orderBy: { createdAt: "desc" }
    });
  },

  async getAvailability() {
    const coach = await getSingleCoach();
    const now = new Date();

    const [availabilities, bookedSlots] = await Promise.all([
      prisma.availability.findMany({
        where: { coachId: coach.id, endAt: { gt: now } },
        orderBy: { startAt: "asc" }
      }),
      prisma.booking.findMany({
        where: { coachId: coach.id, endAt: { gt: now }, status: { in: ["PENDING", "CONFIRMED"] } },
        select: { startAt: true, endAt: true }
      })
    ]);

    return { availabilities, bookedSlots };
  }
};
