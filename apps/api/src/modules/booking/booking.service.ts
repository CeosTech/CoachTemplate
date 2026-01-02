import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { paymentService } from "../payments/payment.service";
import { memberPackService } from "../packs/member-pack.service";

type BookingStatus = "PENDING" | "CONFIRMED" | "REFUSED";

const BLOCKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];
const SUPPORTED_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "REFUSED"];
const PACK_NONE_FILTER = "none";

type BookingFilters = {
  status?: BookingStatus;
  productId?: string;
};

const BOOKING_STATUS_META: Record<
  BookingStatus,
  {
    label: string;
    color: string;
    background: string;
  }
> = {
  PENDING: { label: "En attente coach", color: "#f97316", background: "rgba(249,115,22,0.15)" },
  CONFIRMED: { label: "Confirmée", color: "#16a34a", background: "rgba(22,163,74,0.15)" },
  REFUSED: { label: "Refusée", color: "#dc2626", background: "rgba(220,38,38,0.15)" }
};

const MEMBER_BOOKING_INCLUDE = {
  pack: {
    select: {
      id: true,
      product: { select: { id: true, title: true } }
    }
  },
  user: {
    select: {
      id: true,
      email: true,
      memberProfile: { select: { id: true, fullName: true } }
    }
  }
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof MEMBER_BOOKING_INCLUDE }>;

async function getSingleCoachProfile() {
  const coach = await prisma.coachProfile.findFirst({ where: { isActive: true } });
  if (!coach) throw Object.assign(new Error("No coach configured"), { status: 500 });
  return coach;
}

async function getMemberProfile(userId: string) {
  const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!member) throw Object.assign(new Error("Member profile not found"), { status: 404 });
  return member;
}

async function getCoachByUser(userId: string) {
  const coach = await prisma.coachProfile.findUnique({ where: { userId } });
  if (!coach) throw Object.assign(new Error("Coach profile not found"), { status: 404 });
  return coach;
}

function buildEventPayload(booking: BookingWithRelations, perspective: "MEMBER" | "COACH") {
  const statusMeta = BOOKING_STATUS_META[booking.status];
  const packTitle = booking.pack?.product?.title ?? undefined;
  const memberName = booking.user?.memberProfile?.fullName ?? booking.user?.email ?? undefined;
  const title = perspective === "COACH" ? memberName ?? "Séance coaching" : packTitle ?? "Séance coaching";
  const subtitle = perspective === "COACH" ? packTitle ?? booking.memberNotes ?? undefined : memberName ?? undefined;
  const tooltipParts: string[] = [
    title,
    new Date(booking.startAt).toLocaleString("fr-FR"),
    statusMeta.label
  ];
  if (packTitle) tooltipParts.push(`Pack: ${packTitle}`);
  if (booking.memberNotes) tooltipParts.push(`Note: ${booking.memberNotes}`);

  return {
    id: booking.id,
    title,
    subtitle,
    status: booking.status,
    statusLabel: statusMeta.label,
    color: statusMeta.color,
    background: statusMeta.background,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    memberName,
    packTitle,
    notes: booking.memberNotes ?? booking.coachNotes ?? undefined,
    tooltip: tooltipParts.join(" • ")
  };
}

function withEventPayload(bookings: BookingWithRelations[], perspective: "MEMBER" | "COACH") {
  return bookings.map((booking) => ({
    ...booking,
    event: buildEventPayload(booking, perspective)
  }));
}

export const bookingService = {
  async createBookingSingleCoach(memberUserId: string, input: { startAt?: string; endAt?: string; notes?: string; paymentId?: string; packId?: string }) {
    const [coach, member] = await Promise.all([getSingleCoachProfile(), getMemberProfile(memberUserId)]);
    if (!input.startAt || !input.endAt) throw Object.assign(new Error("Missing startAt/endAt"), { status: 400 });
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (endAt <= startAt) throw Object.assign(new Error("Invalid range"), { status: 400 });

    // dispo couvre le slot ?
    const avail = await prisma.availability.findMany({
      where: { coachId: coach.id, startAt: { lte: startAt }, endAt: { gte: endAt } }
    });
    if (avail.length === 0) throw Object.assign(new Error("Slot not available"), { status: 409 });

    // collision bookings (pending or confirmed)
    const existing = await prisma.booking.findMany({
      where: { coachId: coach.id, status: { in: BLOCKING_STATUSES } }
    });
    const collision = existing.some((b) => startAt < b.endAt && b.startAt < endAt);
    if (collision) throw Object.assign(new Error("Slot already booked"), { status: 409 });

    let paymentId: string | undefined;
    if (input.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: input.paymentId } });
      if (!payment) throw Object.assign(new Error("Paiement introuvable"), { status: 404 });
      if (payment.memberId !== member.id) throw Object.assign(new Error("Paiement non lié à ce membre"), { status: 403 });
      const alreadyLinked = await prisma.booking.findFirst({ where: { paymentId: payment.id } });
      if (alreadyLinked) throw Object.assign(new Error("Paiement déjà lié à une réservation"), { status: 409 });
      paymentId = payment.id;
    }

    const pack = await memberPackService.requirePackForBooking(member.id, input.packId);

    return prisma.booking.create({
      data: {
        coachId: coach.id,
        userId: memberUserId,
        startAt,
        endAt,
        notes: input.notes,
        memberNotes: input.notes,
        paymentId,
        status: "PENDING",
        packId: pack.id
      }
    });
  },

  async listForMember(userId: string, filters?: BookingFilters) {
    const where: Prisma.BookingWhereInput = { userId };
    if (filters?.status && SUPPORTED_STATUSES.includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters?.productId) {
      if (filters.productId.toLowerCase() === PACK_NONE_FILTER) {
        where.packId = null;
      } else {
        where.pack = { productId: filters.productId };
      }
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: MEMBER_BOOKING_INCLUDE,
      orderBy: { startAt: "asc" }
    });
    return withEventPayload(bookings, "MEMBER");
  },

  async listForCoach(userId: string, filters?: BookingFilters) {
    const coach = await getCoachByUser(userId);
    const where: Prisma.BookingWhereInput = { coachId: coach.id };
    if (filters?.status && SUPPORTED_STATUSES.includes(filters.status)) {
      where.status = filters.status;
    }
    if (filters?.productId) {
      if (filters.productId.toLowerCase() === PACK_NONE_FILTER) {
        where.packId = null;
      } else {
        where.pack = { productId: filters.productId };
      }
    }
    const bookings = await prisma.booking.findMany({
      where,
      include: MEMBER_BOOKING_INCLUDE,
      orderBy: { startAt: "asc" }
    });
    return withEventPayload(bookings, "COACH");
  },

  async updateStatusByCoach(userId: string, bookingId: string, status: BookingStatus, coachNotes?: string) {
    if (!["PENDING", "CONFIRMED", "REFUSED"].includes(status)) throw Object.assign(new Error("Statut invalide"), { status: 400 });
    const coach = await getCoachByUser(userId);
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.coachId !== coach.id) throw Object.assign(new Error("Booking not found"), { status: 404 });
    if (booking.status === status && (!coachNotes || coachNotes === booking.coachNotes)) {
      return booking;
    }

    const now = new Date();
    const data: any = {
      status,
      coachNotes: coachNotes ?? booking.coachNotes
    };
    if (status === "CONFIRMED") data.confirmedAt = now;
    if (status === "REFUSED") data.cancelledAt = now;

    const wasConfirmed = booking.status === "CONFIRMED";
    const willConfirm = status === "CONFIRMED" && !wasConfirmed;
    const revertConfirmation = status === "REFUSED" && wasConfirmed;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({ where: { id: bookingId }, data });
      if (booking.paymentId) {
        if (status === "REFUSED" && booking.status !== "REFUSED") {
          await paymentService.refundBookingPayment(booking.paymentId, "Séance refusée par le coach");
        } else if (status === "CONFIRMED" && booking.status !== "CONFIRMED") {
          await paymentService.markBookingAsPaid(booking.paymentId);
        }
      }
      if (booking.packId) {
        if (willConfirm) {
          await memberPackService.debitPack(booking.packId, tx);
        } else if (revertConfirmation) {
          await memberPackService.creditPack(booking.packId, tx);
        }
      }
      return updated;
    });
  }
};
