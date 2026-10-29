"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleReactionAction } from "@/app/(public)/reaction-actions";
import type { ReactionKind } from "@/db/schema";
import { applyToggle, REACTIONS, type ReactionState } from "@/lib/reactions";

export function ReactionBar({ postId, initial }: { postId: string; initial: ReactionState }) {
  const [state, setState] = useState(initial);
  const [optimistic, toggleOptimistic] = useOptimistic(state, applyToggle);
  const [, startTransition] = useTransition();

  function toggle(kind: ReactionKind) {
    startTransition(async () => {
      toggleOptimistic(kind);
      const res = await toggleReactionAction({ postId, kind });
      if (res.ok) setState(res.state);
      else toast.error(res.error);
    });
  }

  return (
    <ul aria-label="Réactions" className="flex flex-wrap gap-2">
      {REACTIONS.map((r) => {
        const active = optimistic.mine.includes(r.kind);
        const total = optimistic.counts[r.kind];
        return (
          <li key={r.kind}>
            <button
              type="button"
              aria-label={`${r.label}${total ? ` (${total})` : ""}`}
              aria-pressed={active}
              title={r.label}
              onClick={() => toggle(r.kind)}
              className={`tap inline-flex min-w-11 items-center justify-center gap-1.5 rounded-full border px-3 text-sm tabular-nums transition-colors ${
                active ? "border-accent/60 bg-accent/10 text-ink" : "border-line text-muted hover:bg-surface"
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                {r.emoji}
              </span>
              {total > 0 && <span aria-hidden="true">{total}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ReactionBarSkeleton() {
  return (
    <ul aria-hidden="true" className="flex flex-wrap gap-2">
      {REACTIONS.map((r) => (
        <li key={r.kind} className="h-11 w-14 rounded-full border border-line" />
      ))}
    </ul>
  );
}
