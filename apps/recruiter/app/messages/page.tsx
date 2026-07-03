import Link from "next/link";
import { prisma } from "@studentos/db";
import { requireRecruiter } from "@/lib/recruiter";
import { NotAuthorized } from "@/components/not-authorized";
import { RecruiterShell } from "@/components/shell";

export const metadata = { title: "Messages — Recruiter" };

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function MessagesPage() {
  const guard = await requireRecruiter();
  if (!guard.ok) return <NotAuthorized reason={guard.reason} />;

  const messages = await prisma.recruiterMessage.findMany({
    where: { recruiterId: guard.recruiter.id },
    orderBy: { createdAt: "desc" },
    include: { student: { select: { id: true, name: true } } },
  });

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-[760px]">
        <h1 className="mb-5 font-display text-[24px] font-bold text-ink">Sent messages</h1>
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-card p-10 text-center text-[13.5px] text-muted">
            You haven&apos;t messaged any students yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <Link key={m.id} href={`/students/${m.student.id}`} className="block rounded-2xl border border-line bg-card p-4 hover:border-cyan/40">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-semibold text-ink">{m.student.name ?? "Student"}</p>
                  <p className="text-[11px] text-faint">{fmtDateTime(m.createdAt)}</p>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{m.body}</p>
                <p className="mt-1 text-[11px] text-faint">{m.readAt ? "Read" : "Unread by student"}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}
