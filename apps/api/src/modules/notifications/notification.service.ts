import { prisma } from "../../db/prisma";

export const notificationService = {
  async create(payload: { title: string; body: string; memberId?: string }) {
    return prisma.notification.create({ data: payload });
  },

  async createForAll(title: string, body: string) {
    const members = await prisma.memberProfile.findMany({ select: { id: true } });
    return prisma.$transaction(
      members.map((member) => prisma.notification.create({ data: { title, body, memberId: member.id } }))
    );
  },

  async listForMember(userId: string) {
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!member) return [];
    return prisma.notification.findMany({
      where: { memberId: member.id },
      orderBy: { createdAt: "desc" }
    });
  },

  async listAll() {
    return prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: { member: { select: { fullName: true, user: { select: { email: true } } } } }
    });
  },

  async updateStatusForUser(userId: string, role: "COACH" | "MEMBER", id: string, status: "UNREAD" | "READ") {
    if (role === "COACH") return prisma.notification.update({ where: { id }, data: { status } });
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!member) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.memberId !== member.id) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return prisma.notification.update({ where: { id }, data: { status } });
  },

  async deleteForUser(userId: string, role: "COACH" | "MEMBER", id: string) {
    if (role === "COACH") return prisma.notification.delete({ where: { id } });
    const member = await prisma.memberProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!member) throw Object.assign(new Error("Forbidden"), { status: 403 });
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.memberId !== member.id) throw Object.assign(new Error("Forbidden"), { status: 403 });
    return prisma.notification.delete({ where: { id } });
  }
};
