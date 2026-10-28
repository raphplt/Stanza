"use client";

import { shareLink } from "@/lib/share";

export function ShareButton({ title, path }: { title: string; path: string }) {
  return (
    <button
      type="button"
      onClick={() => shareLink(title, path)}
      className="tap inline-flex items-center gap-2 rounded-full border border-line px-4 text-sm transition-colors hover:bg-surface"
    >
      <svg
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M10 3v10M6 7l4-4 4 4M4 12v4h12v-4" />
      </svg>
      Partager
    </button>
  );
}
