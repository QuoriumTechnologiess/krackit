import { prisma } from "@studentos/db";
import type { Plan, UsageKind, User } from "@studentos/db";

/**
 * Plan-gating (PLAN.md §8). The ONE server-side chokepoint that decides whether a
 * generation is allowed. Never trust the client — every generation calls assertWithinQuota
 * before it starts, and recordUsage after it succeeds.
 *
 * `null` = unlimited.
 */
const QUOTAS: Record<Plan, Record<UsageKind, number | null>> = {
  // Limits removed while we're in global testing — everything is unlimited for now.
  // Revisit and set real FREE-tier numbers once the app is finalized.
  FREE: { ASSIGNMENT: null, REPORT: null, PPT: null, LAB_REPORT: null, BRANCH_SOLVER: null },
  PRO: { ASSIGNMENT: null, REPORT: null, PPT: null, LAB_REPORT: null, BRANCH_SOLVER: null },
  PREMIUM: { ASSIGNMENT: null, REPORT: null, PPT: null, LAB_REPORT: null, BRANCH_SOLVER: null },
};

export class QuotaExceededError extends Error {
  constructor(
    public readonly kind: UsageKind,
    public readonly limit: number,
  ) {
    super(`Monthly ${kind.toLowerCase()} limit reached (${limit}).`);
    this.name = "QuotaExceededError";
  }
}

/** Quotas reset on the 1st of each calendar month (until tied to Subscription periods). */
function periodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const COST_CAP_SETTING_KEY = "MAX_MONTHLY_AI_COST_CENTS";
/** Safety-net default while feature quotas above are unlimited — real $ backstop against a single
 *  account looping paid AI calls. Admin-adjustable (see /platform in apps/admin) without a deploy. */
const DEFAULT_MAX_MONTHLY_AI_COST_CENTS = 300; // $3.00/user/month

export class CostBudgetExceededError extends Error {
  constructor(public readonly capCents: number) {
    super(
      `You've reached this month's AI usage limit ($${(capCents / 100).toFixed(2)}). It resets on the 1st — reach out if you need more.`,
    );
    this.name = "CostBudgetExceededError";
  }
}

export async function getMaxMonthlyAiCostCents(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key: COST_CAP_SETTING_KEY } });
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_MONTHLY_AI_COST_CENTS;
}

export async function setMaxMonthlyAiCostCents(cents: number): Promise<void> {
  const value = String(Math.max(0, Math.round(cents)));
  await prisma.platformSetting.upsert({
    where: { key: COST_CAP_SETTING_KEY },
    create: { key: COST_CAP_SETTING_KEY, value },
    update: { value },
  });
}

/** Sum of this user's tracked AI spend (GenerationJob.costCents) so far this calendar month. */
export async function aiCostCentsThisPeriod(userId: string): Promise<number> {
  const agg = await prisma.generationJob.aggregate({
    _sum: { costCents: true },
    where: { document: { ownerId: userId }, createdAt: { gte: periodStart() } },
  });
  return agg._sum.costCents ?? 0;
}

/**
 * Hard $ backstop, independent of the per-feature quotas below (which are currently unlimited).
 * Throws `CostBudgetExceededError` once this user's tracked AI spend this month is at/over the
 * admin-configured cap. Call at the ENTRY of every AI-cost action — even ones whose own feature
 * quota is unlimited — so no single account can run up an unbounded Gateway bill.
 */
export async function assertWithinCostBudget(userId: string): Promise<void> {
  const [cap, used] = await Promise.all([getMaxMonthlyAiCostCents(), aiCostCentsThisPeriod(userId)]);
  if (used >= cap) throw new CostBudgetExceededError(cap);
}

export function quotaFor(plan: Plan, kind: UsageKind): number | null {
  return QUOTAS[plan][kind];
}

export function usageThisPeriod(userId: string, kind: UsageKind): Promise<number> {
  return prisma.usageEvent.count({
    where: { userId, kind, createdAt: { gte: periodStart() } },
  });
}

/** Throws QuotaExceededError if the user has no remaining quota for `kind`, or
 *  CostBudgetExceededError if they've hit the $ backstop regardless of feature quota. */
export async function assertWithinQuota(user: User, kind: UsageKind): Promise<void> {
  await assertWithinCostBudget(user.id);
  const limit = quotaFor(user.plan, kind);
  if (limit === null) return; // unlimited
  const used = await usageThisPeriod(user.id, kind);
  if (used >= limit) throw new QuotaExceededError(kind, limit);
}

export async function recordUsage(
  userId: string,
  kind: UsageKind,
  documentId?: string,
): Promise<void> {
  await prisma.usageEvent.create({ data: { userId, kind, documentId } });
}

export type QuotaStatus = { used: number; limit: number | null; remaining: number | null };

export async function quotaStatus(user: User, kind: UsageKind): Promise<QuotaStatus> {
  const limit = quotaFor(user.plan, kind);
  const used = await usageThisPeriod(user.id, kind);
  return { used, limit, remaining: limit === null ? null : Math.max(0, limit - used) };
}
