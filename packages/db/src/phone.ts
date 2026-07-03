import { prisma } from "./index";

/**
 * Phone numbers must be unique across BOTH `User` (students) and `Recruiter` — Prisma's
 * per-table `@unique` can't see across tables, so any onboarding path that collects a phone
 * number (student onboarding, recruiter onboarding) must call this first and reject on a hit.
 * `excludeId` skips the caller's own row (id of the same table being written to) so re-saving an
 * unchanged phone during onboarding doesn't false-positive against itself.
 */
export async function assertPhoneAvailable(
  phone: string,
  exclude?: { userId?: string; recruiterId?: string },
): Promise<void> {
  const [asUser, asRecruiter] = await Promise.all([
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
    prisma.recruiter.findUnique({ where: { phone }, select: { id: true } }),
  ]);

  if (asUser && asUser.id !== exclude?.userId) throw new Error("This phone number is already registered.");
  if (asRecruiter && asRecruiter.id !== exclude?.recruiterId) throw new Error("This phone number is already registered.");
}
