"use server";

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma, assertPhoneAvailable } from "@studentos/db";
import { DEPARTMENTS } from "@/lib/constants";

export type OnboardingState = { error?: string };

// Loose "10+ digits, optional leading +" check — real validation (OTP delivery) happens once
// Clerk phone verification is wired up; this just keeps obviously-malformed input out of the
// uniqueness check.
const PHONE_RE = /^\+?[0-9]{10,15}$/;

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const { userId } = await auth();
  if (!userId) return { error: "You must be signed in." };

  const department = String(formData.get("department") ?? "").trim();
  const college = String(formData.get("college") ?? "").trim();
  const semester = String(formData.get("semester") ?? "").trim();
  const careerGoal = String(formData.get("careerGoal") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const codingEnabled = formData.get("codingEnabled") === "on";
  const acceptedLegal = formData.get("acceptedLegal") === "on";

  if (!DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number]))
    return { error: "Please choose your department." };
  if (college.length < 2) return { error: "Please enter your college name." };
  if (!semester) return { error: "Please choose your semester." };
  if (!PHONE_RE.test(phone)) return { error: "Please enter a valid phone number." };
  if (!acceptedLegal) return { error: "Please accept the Terms and Privacy Policy to continue." };

  const me = await prisma.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
  if (!me) return { error: "Account not found — please refresh and try again." };

  try {
    await assertPhoneAvailable(phone, { userId: me.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "That phone number is already in use." };
  }

  // Find-or-create the institution (college), then attach to the user.
  let institution = await prisma.institution.findFirst({ where: { name: college } });
  institution ??= await prisma.institution.create({ data: { name: college } });

  // One submit sets academic context, coding track, AND legal acceptance — no separate gate.
  await prisma.user.update({
    where: { clerkId: userId },
    data: {
      department,
      semester,
      careerGoal: careerGoal || null,
      phone,
      institutionId: institution.id,
      codingEnabled,
      acceptedLegalAt: new Date(),
      onboardedAt: new Date(),
    },
  });

  redirect("/dashboard");
}
