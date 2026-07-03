"use client";

import { useTransition } from "react";
import { markMessageRead } from "@/lib/actions/messages";

export function MarkMessageRead({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markMessageRead(id))}
      className="shrink-0 rounded-lg border border-cyan/30 px-2.5 py-1 text-[11px] font-semibold text-cyan hover:bg-cyan/10 disabled:opacity-50"
    >
      Mark read
    </button>
  );
}
