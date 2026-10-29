"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Sibling = {
  slug: string;
  title: string | null;
} | null;

export function PostNavigation({
  authorUsername,
  previous,
  next,
}: {
  authorUsername: string;
  previous: Sibling;
  next: Sibling;
}) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true'], dialog")) return;

      if (e.key === "ArrowLeft" && previous) {
        router.push(`/${authorUsername}/${previous.slug}`);
      } else if (e.key === "ArrowRight" && next) {
        router.push(`/${authorUsername}/${next.slug}`);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, authorUsername, previous, next]);

  if (!previous && !next) return null;

  return (
    <nav aria-label="Autres textes" className="mt-12 grid gap-4 sm:grid-cols-2">
      {previous && (
        <Link
          href={`/${authorUsername}/${previous.slug}`}
          className="group rounded-xl border border-line p-4 transition-colors hover:border-ink/20 hover:bg-surface/50"
        >
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
            <span>Texte précédent</span>
          </span>
          <span className="mt-1.5 block font-serif text-lg leading-snug group-hover:text-ink">
            {previous.title || "Sans titre"}
          </span>
        </Link>
      )}
      {next && (
        <Link
          href={`/${authorUsername}/${next.slug}`}
          className="group rounded-xl border border-line p-4 text-right transition-colors hover:border-ink/20 hover:bg-surface/50 sm:col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 text-xs text-muted">
            <span>Texte suivant</span>
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </span>
          <span className="mt-1.5 block font-serif text-lg leading-snug group-hover:text-ink">
            {next.title || "Sans titre"}
          </span>
        </Link>
      )}
    </nav>
  );
}
