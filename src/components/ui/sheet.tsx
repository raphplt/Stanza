"use client";

import { useEffect, useRef } from "react";

export function Sheet({
  open,
  onClose,
  title,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click only; Escape is handled natively by <dialog>
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`m-0 ml-auto h-dvh max-h-dvh w-full border-l border-line bg-paper p-0 text-ink backdrop:bg-ink/20 ${
        wide ? "max-w-3xl" : "max-w-md"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-serif text-xl font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="tap flex items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{open && children}</div>
      </div>
    </dialog>
  );
}
