import "server-only";
import { prisma } from "@studentos/db";

/** Cloudflare R2 storage price (no egress fee) — used only for a rough cost ESTIMATE, not billing. */
const R2_USD_PER_GB_MONTH = 0.015;

const COST_CAP_SETTING_KEY = "MAX_MONTHLY_AI_COST_CENTS";
const DEFAULT_MAX_MONTHLY_AI_COST_CENTS = 300; // $3.00/user/month — mirrors apps/web/lib/entitlements.ts

/** Admin-configurable per-user monthly AI $ cap (enforced in apps/web via assertWithinCostBudget). */
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

export type GatewayCredits = { balance: number; totalUsed: number } | { error: string };

/** Live balance from the Vercel AI Gateway — the authoritative source for total platform AI spend. */
export async function getGatewayCredits(): Promise<GatewayCredits> {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) return { error: "AI_GATEWAY_API_KEY not configured" };
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { error: `Gateway returned ${res.status}` };
    const data = (await res.json()) as { balance: string; total_used: string };
    return { balance: Number(data.balance), totalUsed: Number(data.total_used) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "fetch failed" };
  }
}

export type PlatformCostSummary = {
  aiSpendCentsThisMonth: number;
  aiSpendCentsAllTime: number;
  storageBytes: number;
  storageCostUsdPerMonth: number;
  concurrentActiveUsers: number;
  gateway: GatewayCredits;
};

function periodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Aggregate platform-wide cost signals for the admin cost dashboard. */
export async function getPlatformCostSummary(): Promise<PlatformCostSummary> {
  const [aiAllTime, aiThisMonth, uploadBytes, exportBytes, gateway, concurrentActiveUsers] = await Promise.all([
    prisma.generationJob.aggregate({ _sum: { costCents: true } }),
    prisma.generationJob.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: periodStart() } } }),
    prisma.upload.aggregate({ _sum: { sizeBytes: true } }),
    prisma.documentExport.aggregate({ _sum: { sizeBytes: true } }),
    getGatewayCredits(),
    prisma.user.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } } }),
  ]);

  const storageBytes = (uploadBytes._sum.sizeBytes ?? 0) + (exportBytes._sum.sizeBytes ?? 0);
  const storageGb = storageBytes / 1024 ** 3;

  return {
    aiSpendCentsAllTime: aiAllTime._sum.costCents ?? 0,
    aiSpendCentsThisMonth: aiThisMonth._sum.costCents ?? 0,
    storageBytes,
    storageCostUsdPerMonth: storageGb * R2_USD_PER_GB_MONTH,
    concurrentActiveUsers,
    gateway,
  };
}

/** Per-user cost breakdown — AI spend attributed via GenerationJob→Document.ownerId, plus storage. */
export async function getUserCostSummary(userId: string): Promise<{
  aiCostCentsAllTime: number;
  aiCostCentsThisMonth: number;
  storageBytes: number;
  storageCostUsdPerMonth: number;
}> {
  const [aiAllTime, aiThisMonth, uploadBytes, exportBytes] = await Promise.all([
    prisma.generationJob.aggregate({
      _sum: { costCents: true },
      where: { document: { ownerId: userId } },
    }),
    prisma.generationJob.aggregate({
      _sum: { costCents: true },
      where: { document: { ownerId: userId }, createdAt: { gte: periodStart() } },
    }),
    prisma.upload.aggregate({ _sum: { sizeBytes: true }, where: { ownerId: userId } }),
    prisma.documentExport.aggregate({ _sum: { sizeBytes: true }, where: { document: { ownerId: userId } } }),
  ]);

  const storageBytes = (uploadBytes._sum.sizeBytes ?? 0) + (exportBytes._sum.sizeBytes ?? 0);
  return {
    aiCostCentsAllTime: aiAllTime._sum.costCents ?? 0,
    aiCostCentsThisMonth: aiThisMonth._sum.costCents ?? 0,
    storageBytes,
    storageCostUsdPerMonth: (storageBytes / 1024 ** 3) * R2_USD_PER_GB_MONTH,
  };
}
