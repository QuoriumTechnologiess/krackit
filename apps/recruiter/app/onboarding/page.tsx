import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@studentos/db";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const existing = await prisma.recruiter.findUnique({ where: { clerkId: user.id } });
  if (existing && existing.status !== "DRAFT") redirect("/");

  const clerkName = user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "";

  return (
    <OnboardingForm
      initial={{
        name: existing?.name ?? clerkName,
        phone: existing?.phone ?? "",
        companyName: existing?.companyName ?? "",
        companyEmail: existing?.companyEmail ?? "",
        industry: existing?.industry ?? "",
        designation: existing?.designation ?? "",
        linkedinUrl: existing?.linkedinUrl ?? "",
      }}
    />
  );
}
