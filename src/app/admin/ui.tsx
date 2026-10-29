import type React from "react";

export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0 sm:rounded-xl sm:border sm:border-line">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export const thClass =
  "border-b border-line px-4 py-2.5 text-xs font-medium tracking-wide text-muted uppercase";
export const tdClass = "border-b border-line px-4 py-3 align-middle";

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "accent" | "danger" | "ink";
  children: React.ReactNode;
}) {
  const tones = {
    muted: "border-line text-muted",
    accent: "border-accent/40 text-accent",
    danger: "border-danger/40 text-danger",
    ink: "border-ink/30 text-ink",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function TableSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-lg bg-surface/70" />
      ))}
    </div>
  );
}
