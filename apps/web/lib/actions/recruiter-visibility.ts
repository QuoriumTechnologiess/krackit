"use server";

import { prisma } from "@studentos/db";
import { requireOnboardedUser } from "@/lib/user";

/**
 * Explicit opt-in/out for recruiter discovery (apps/recruiter's student search). Off by default —
 * mirrors the existing publicHandle "Share Profile" pattern: nothing is shown to recruiters until
 * the student flips this themselves.
 */
export async function setRecruiterVisibility(visible: boolean): Promise<{ visible: boolean }> {
  const user = await requireOnboardedUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { visibleToRecruiters: visible, visibleToRecruitersAt: visible ? new Date() : null },
  });
  return { visible };
}
