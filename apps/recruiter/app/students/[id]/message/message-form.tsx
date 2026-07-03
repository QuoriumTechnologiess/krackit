"use client";

import { useActionState } from "react";
import { sendMessage, type SendMessageState } from "./actions";

export function MessageForm({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState<SendMessageState, FormData>(sendMessage.bind(null, studentId), {});

  if (state.sent) {
    return <p className="rounded-xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-[13px] text-success">Message sent.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <textarea
        name="body"
        required
        rows={4}
        placeholder="Introduce your role and why you're reaching out…"
        className="w-full resize-none rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[13.5px] text-ink outline-none placeholder:text-faint focus:border-cyan/50"
      />
      {state.error ? <p className="text-[12px] text-danger">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-xl bg-cyan px-4 py-2 text-[13px] font-semibold text-on-accent hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
