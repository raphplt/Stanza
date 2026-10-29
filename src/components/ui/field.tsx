"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

export const inputClass =
  "tap w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none disabled:opacity-60";

export const primaryButtonClass =
  "tap inline-flex items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50";

export const secondaryButtonClass =
  "tap inline-flex items-center justify-center rounded-full border border-line px-5 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-50";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSaver() {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function save<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>): Promise<T> {
    clearTimeout(timer.current);
    setState("saving");
    const res = await fn();
    if (res.ok) {
      setState("saved");
      timer.current = setTimeout(() => setState("idle"), 2000);
    } else {
      setState("error");
      toast.error(res.error ?? "Enregistrement impossible.");
    }
    return res;
  }

  return { state, save };
}

export function SaveStatus({ state }: { state: SaveState }) {
  if (!state) return null;
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1.5 text-xs text-muted">
      {state === "saving" && (
        <>
          <svg
            viewBox="0 0 16 16"
            className="size-3 animate-spin text-muted/70"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Enregistrement…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <svg
            viewBox="0 0 16 16"
            className="size-3 text-muted/70"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          <span>Enregistré</span>
        </>
      )}
    </span>
  );
}

export function Field({
  id,
  label,
  hint,
  state,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  state?: SaveState;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {state && <SaveStatus state={state} />}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}
