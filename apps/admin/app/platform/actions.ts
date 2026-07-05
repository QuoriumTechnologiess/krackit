"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { setMaxConcurrentSessions } from "@/lib/sessions";
import { setMaxMonthlyAiCostCents } from "@/lib/platform-cost";

export async function updateMaxConcurrentSessions(n: number): Promise<void> {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Not authorized");
  if (!Number.isFinite(n) || n < 1) throw new Error("Invalid limit");

  await setMaxConcurrentSessions(n);
  await logAdminAction({
    action: "platform.max_concurrent_sessions.set",
    targetType: "platform",
    targetId: "MAX_CONCURRENT_SESSIONS",
    after: { value: n },
  });

  revalidatePath("/platform");
}

export async function updateMaxMonthlyAiCostCents(cents: number): Promise<void> {
  const guard = await requireAdmin();
  if (!guard.ok) throw new Error("Not authorized");
  if (!Number.isFinite(cents) || cents < 0) throw new Error("Invalid amount");

  await setMaxMonthlyAiCostCents(cents);
  await logAdminAction({
    action: "platform.max_monthly_ai_cost_cents.set",
    targetType: "platform",
    targetId: "MAX_MONTHLY_AI_COST_CENTS",
    after: { value: cents },
  });

  revalidatePath("/platform");
}
