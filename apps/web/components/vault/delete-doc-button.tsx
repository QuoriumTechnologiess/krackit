"use client";

import { useState, useTransition } from "react";
import { TrashIcon } from "@/components/icons";
import { deleteVaultDocument } from "@/lib/actions/documents";

/**
 * Floating delete control for a Vault card. Hidden until the card is hovered
 * (parent must carry `group/card`). Click reveals an inline confirm so we never
 * fire a native dialog; confirming deletes the document (DB + storage) in place.
 */
export function DeleteDocButton({ docId }: { docId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-line-strong bg-card p-1 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await deleteVaultDocument(docId); })}
          className="rounded-md bg-danger px-2 py-1 text-[11px] font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label="Delete"
      title="Delete"
      onClick={() => setConfirming(true)}
      className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-lg border border-line-strong bg-card text-muted opacity-0 shadow-sm transition-all hover:border-danger/40 hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover/card:opacity-100"
    >
      <TrashIcon size={14} />
    </button>
  );
}
