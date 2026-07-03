"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@studentos/db";
import { requireRecruiter } from "@/lib/recruiter";

export type SendMessageState = { error?: string; sent?: boolean };

export async function sendMessage(studentId: string, _prev: SendMessageState, formData: FormData): Promise<SendMessageState> {
  const guard = await requireRecruiter();
  if (!guard.ok) return { error: "Not authorized." };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Message can't be empty." };
  if (body.length > 2000) return { error: "Message is too long." };

  const student = await prisma.user.findUnique({ where: { id: studentId }, select: { visibleToRecruiters: true } });
  if (!student?.visibleToRecruiters) return { error: "This student is no longer visible to recruiters." };

  await prisma.recruiterMessage.create({
    data: { recruiterId: guard.recruiter.id, studentId, body },
  });

  revalidatePath(`/students/${studentId}`);
  return { sent: true };
}
