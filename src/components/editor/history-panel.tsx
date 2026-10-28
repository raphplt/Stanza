"use client";

import type { JSONContent } from "@tiptap/core";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { getRevisionPreviewAction, listRevisionsAction, restoreRevisionAction } from "@/app/studio/actions";
import { Sheet } from "@/components/ui/sheet";
import type { RevisionReason } from "@/db/schema";
import { formatFrenchDateTime } from "@/lib/dates";

type Revision = { id: string; title: string; reason: RevisionReason; createdAt: string };

const REASONS: Record<RevisionReason, string> = {
  publish: "Publication",
  auto: "Enregistrement automatique",
  restore: "Avant restauration",
};

export function HistoryPanel({
  open,
  onClose,
  postId,
  flush,
  exclusive,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  flush: () => Promise<boolean>;
  exclusive: <T>(fn: () => Promise<T>) => Promise<T | null>;
  onRestored: (result: {
    version: number;
    title: string;
    content: JSONContent;
    hasUnpublishedChanges: boolean;
  }) => void;
}) {
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setRevisions(null);
    setSelected(null);
    setPreview(null);
    setError(null);
    flush().then(() =>
      listRevisionsAction(postId).then((res) => {
        if (res.ok) setRevisions(res.revisions);
        else setError(res.error);
      }),
    );
  }, [open, postId, flush]);

  function select(id: string) {
    setSelected(id);
    setPreview(null);
    getRevisionPreviewAction(id).then((res) => {
      if (res.ok) setPreview(res);
      else setError(res.error);
    });
  }

  function restore() {
    if (!selected) return;
    startTransition(async () => {
      const res = await exclusive(async () => {
        const res = await restoreRevisionAction(selected);
        if (res.ok) onRestored(res);
        return res;
      });
      if (!res) {
        setError("Enregistrement impossible pour le moment. Réessayez dans un instant.");
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      toast("Version restaurée");
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Historique" wide>
      <div className="flex h-full flex-col sm:flex-row">
        <ul className="max-h-60 shrink-0 overflow-y-auto border-b border-line sm:max-h-none sm:w-64 sm:border-r sm:border-b-0">
          {revisions === null && !error && (
            <li className="space-y-2 p-4" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-surface" />
              ))}
            </li>
          )}
          {revisions?.length === 0 && (
            <li className="p-5 text-sm text-muted">
              Aucune version enregistrée pour l'instant. Une version est conservée à chaque publication et
              toutes les 10 minutes d'écriture.
            </li>
          )}
          {revisions?.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => select(r.id)}
                aria-current={selected === r.id}
                className={`w-full px-4 py-3 text-left ${selected === r.id ? "bg-surface" : "hover:bg-surface/60"}`}
              >
                <span className="block text-sm">{formatFrenchDateTime(r.createdAt)}</span>
                <span className="block text-xs text-muted">{REASONS[r.reason]}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {!selected && !error && revisions && revisions.length > 0 && (
            <p className="text-sm text-muted">Choisissez une version pour l'afficher.</p>
          )}
          {selected && !preview && !error && <div className="h-64 rounded-lg bg-surface" aria-busy="true" />}
          {preview && (
            <>
              <button
                type="button"
                onClick={restore}
                disabled={pending}
                className="tap mb-6 rounded-full bg-ink px-5 text-sm font-medium text-paper disabled:opacity-50"
              >
                {pending ? "Restauration…" : "Restaurer cette version"}
              </button>
              <h1 className="font-serif text-3xl font-medium tracking-tight">
                {preview.title || "Sans titre"}
              </h1>
              <div
                className="prose-stanza mt-6"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered from sanitized JSON
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
