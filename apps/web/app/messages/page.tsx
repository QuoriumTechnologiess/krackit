import { prisma } from "@studentos/db";
import { AppShell } from "@/components/app-shell";
import { requireOnboardedUser, shellUserFrom } from "@/lib/user";
import { ChatIcon } from "@/components/icons";
import { MarkMessageRead } from "@/components/messages/mark-read";

export const metadata = { title: "Messages — Vidyas OS" };

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default async function MessagesPage() {
  const user = await requireOnboardedUser();

  const messages = await prisma.recruiterMessage.findMany({
    where: { studentId: user.id },
    orderBy: { createdAt: "desc" },
    include: { recruiter: { select: { name: true, companyName: true } } },
  });

  return (
    <AppShell user={shellUserFrom(user)}>
      <div className="mx-auto max-w-[760px]">
        <header className="mb-6">
          <h1 className="font-display text-[26px] font-bold text-ink">Messages</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            Messages from recruiters who matched to your profile. This only appears if you&apos;ve turned on
            &quot;Visible to recruiters&quot; in your profile.
          </p>
        </header>

        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-card p-12 text-center">
            <ChatIcon size={28} className="text-faint" />
            <p className="text-[13.5px] text-muted">No messages yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-4 ${m.readAt ? "border-line bg-card" : "border-cyan/30 bg-cyan/[0.04]"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">
                      {m.recruiter.companyName ?? "A recruiter"}
                      {m.recruiter.name ? <span className="font-normal text-muted"> · {m.recruiter.name}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-faint">{fmtDateTime(m.createdAt)}</p>
                  </div>
                  {!m.readAt && <MarkMessageRead id={m.id} />}
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] text-soft">{m.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
