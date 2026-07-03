import type { Prisma } from "@prisma/client";

/**
 * v1 industry match: a recruiter with no `industry` set sees everyone (opt-in-only students
 * already narrow the pool). Otherwise, keyword-overlap match against the student's free-text
 * `careerGoal` — the two lists (apps/recruiter's INDUSTRIES, apps/web's CAREER_GOALS) are worded
 * differently ("Software / IT Services" vs "Software Engineer"), so a whole-string `contains`
 * would never match. Instead, split the industry into words (≥3 letters, so "IT"/"AI" alone
 * don't cause noise) and match if ANY of them appears in careerGoal. Kept as one function so the
 * match rule can change later (e.g. a real mapping table) without touching UI code.
 */
export function studentMatchesIndustryWhere(industry: string | null | undefined): Prisma.UserWhereInput {
  if (!industry || !industry.trim()) return {};
  const words = industry
    .split(/[^a-zA-Z]+/)
    .filter((w) => w.length >= 3);
  if (words.length === 0) return {};
  return { OR: words.map((w) => ({ careerGoal: { contains: w, mode: "insensitive" as const } })) };
}
