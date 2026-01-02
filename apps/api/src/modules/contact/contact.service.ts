import { prisma } from "../../db/prisma";

export const contactService = {
  async submitMessage(payload: { fullName: string; email: string; subject: string; message: string }) {
    return prisma.contactMessage.create({ data: payload });
  },

  async listMessages() {
    return prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" }
    });
  },

  async updateStatus(id: string, status: "NEW" | "READ" | "ARCHIVED") {
    return prisma.contactMessage.update({ where: { id }, data: { status } });
  }
};
