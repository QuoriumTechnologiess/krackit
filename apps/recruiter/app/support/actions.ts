"use server";

import { prisma } from "@studentos/db";
import { requireRecruiter } from "@/lib/recruiter";

export type CreateTicketResult = { ok: true } | { ok: false; error: string };

export async function createSupportTicket(subject: string, message: string): Promise<CreateTicketResult> {
  const guard = await requireRecruiter();
  if (!guard.ok) return { ok: false, error: "Not authorized." };

  const cleanSubject = subject.trim();
  const cleanMessage = message.trim();
  if (!cleanSubject) return { ok: false, error: "Please add a subject." };
  if (!cleanMessage) return { ok: false, error: "Please describe your issue." };

  await prisma.supportTicket.create({
    data: { requesterType: "RECRUITER", recruiterId: guard.recruiter.id, subject: cleanSubject, message: cleanMessage },
  });
  return { ok: true };
}
