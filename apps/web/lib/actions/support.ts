"use server";

import { prisma } from "@studentos/db";
import { requireOnboardedUser } from "@/lib/user";

export type CreateTicketResult = { ok: true } | { ok: false; error: string };

export async function createSupportTicket(subject: string, message: string): Promise<CreateTicketResult> {
  const user = await requireOnboardedUser();

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
  if (!cleanSubject) return { ok: false, error: "Please add a subject." };
  if (!cleanMessage) return { ok: false, error: "Please describe your issue." };

  await prisma.supportTicket.create({
    data: { requesterType: "STUDENT", studentId: user.id, subject: cleanSubject, message: cleanMessage },
  });
  return { ok: true };
}
