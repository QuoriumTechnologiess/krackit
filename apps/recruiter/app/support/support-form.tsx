"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket } from "./actions";

const fieldBox =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors focus:border-cyan/50";

export function SupportForm() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await createSupportTicket(subject, message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubject("");
      setMessage("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-line bg-card p-5">
      <h3 className="text-[14px] font-semibold text-ink">Raise a ticket</h3>
      <p className="mt-1 text-[12.5px] text-muted">Tell us what&apos;s wrong — an admin will review it and follow up.</p>

      <div className="mt-4 space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className={fieldBox}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe the issue…"
          rows={4}
          className={fieldBox}
        />
      </div>

      {error ? <p className="mt-3 text-[12.5px] text-danger">{error}</p> : null}
      {saved ? <p className="mt-3 text-[12.5px] text-teal">Ticket submitted.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-cyan px-5 py-2.5 text-[13px] font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
