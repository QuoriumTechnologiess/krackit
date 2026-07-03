"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@studentos/db";
import { requireOnboardedUser } from "@/lib/user";

/** Marks a recruiter message as read. Scoped to the signed-in student — can't mark others' mail. */
export async function markMessageRead(id: string): Promise<void> {
  const user = await requireOnboardedUser();
  await prisma.recruiterMessage.updateMany({
    where: { id, studentId: user.id },
    data: { readAt: new Date() },
  });
  revalidatePath("/messages");
}
