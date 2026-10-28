"use client";

import type { JSONContent } from "@tiptap/core";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  discardChangesAction,
  getPublishDraftAction,
  publishPostAction,
  regenerateShareIdAction,
  unpublishPostAction,
} from "@/app/studio/actions";
import { Sheet } from "@/components/ui/sheet";
import type { PostStatus } from "@/db/schema";
import { postPublicPath, shareLink } from "@/lib/share";
import { slugify } from "@/lib/slug";

export type PublishState = {
  status: PostStatus;
  slug: string;
  shareId: string;
  hasUnpublishedChanges: boolean;
};

const SAVE_FIRST_ERROR = "Enregistrement impossible pour le moment. Réessayez dans un instant.";

type Defaults = { slug: string; excerpt: string; images: string[]; ogImageUrl: string | null };

export function PublishPanel({
  open,
  onClose,
  postId,
  title,
  username,
  state,
  exclusive,
  onVersion,
  onStateChange,
  onContentReset,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  title: string;
  username: string;
  state: PublishState;
  exclusive: <T>(fn: () => Promise<T>) => Promise<T | null>;
  onVersion: (version: number) => void;
  onStateChange: (patch: Partial<PublishState>) => void;
  onContentReset: (title: string, content: JSONContent) => void;
}) {
  const live = state.status !== "draft";
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [visibility, setVisibility] = useState<"published" | "unlisted">("published");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setDefaults(null);
    setError(null);
    getPublishDraftAction(postId).then((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDefaults(res);
      setSlug(res.slug);
      setExcerpt(res.excerpt);
      setOgImageUrl(res.ogImageUrl);
      setVisibility(state.status === "unlisted" ? "unlisted" : "published");
    });
  }, [open, postId, state.status]);

  function publish() {
    setError(null);
    startTransition(async () => {
      const res = await exclusive(async () => {
        const res = await publishPostAction({
          postId,
          status: visibility,
          slug: slugify(slug),
          excerpt,
          ogImageUrl,
        });
        if (res.ok) onVersion(res.version);
        return res;
      });
      if (!res) {
        setError(SAVE_FIRST_ERROR);
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onStateChange({
        status: res.status,
        slug: res.slug,
        shareId: res.shareId,
        hasUnpublishedChanges: false,
      });
      onClose();
      const path = postPublicPath(res, username);
      toast(
        live ? "Texte mis à jour" : visibility === "published" ? "Texte publié" : "Texte publié en non listé",
        {
          action: { label: "Partager", onClick: () => shareLink(title, path) },
        },
      );
    });
  }

  function discard() {
    startTransition(async () => {
      const res = await exclusive(async () => {
        const res = await discardChangesAction(postId);
        if (res.ok) onVersion(res.version);
        return res;
      });
      if (!res) {
        setError(SAVE_FIRST_ERROR);
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onContentReset(res.title, res.content);
      onStateChange({ hasUnpublishedChanges: false });
      onClose();
      toast("Modifications annulées");
    });
  }

  function unpublish() {
    startTransition(async () => {
      const res = await exclusive(async () => {
        const res = await unpublishPostAction(postId);
        if (res.ok) onVersion(res.version);
        return res;
      });
      if (!res) {
        setError(SAVE_FIRST_ERROR);
        return;
      }
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onStateChange({ status: "draft", hasUnpublishedChanges: false });
      onClose();
      toast("Texte dépublié, il est revenu dans vos brouillons");
    });
  }

  function regenerate() {
    startTransition(async () => {
      const res = await regenerateShareIdAction(postId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onStateChange({ shareId: res.shareId });
      toast("Nouveau lien privé créé, l'ancien ne fonctionne plus");
    });
  }

  const publicPath = postPublicPath(state, username);

  return (
    <Sheet open={open} onClose={onClose} title={live ? "Publication" : "Publier"}>
      {!defaults ? (
        <div className="space-y-4 p-5" aria-busy="true">
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : (
            [0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-surface" />)
          )}
        </div>
      ) : (
        <form
          className="space-y-6 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            publish();
          }}
        >
          <fieldset>
            <legend className="text-sm font-medium">Visibilité</legend>
            <div className="mt-2 grid gap-2">
              {(
                [
                  [
                    "published",
                    "Public",
                    "Sur votre profil, dans le flux RSS et indexé par les moteurs de recherche.",
                  ],
                  ["unlisted", "Non listé", "Accessible uniquement à qui possède le lien privé."],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 ${
                    visibility === value ? "border-ink" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="mt-1 accent-[var(--ink)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {visibility === "published" && (
            <label className="block text-sm font-medium">
              Adresse
              <span className="mt-1.5 flex items-center rounded-lg border border-line focus-within:border-accent">
                <span className="truncate pl-3.5 text-sm font-normal text-muted">/{username}/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  onBlur={() => setSlug(slugify(slug))}
                  maxLength={80}
                  className="tap min-w-0 flex-1 rounded-r-lg bg-paper pr-3.5 text-base focus:outline-none"
                />
              </span>
              {live && state.status === "published" && slugify(slug) !== state.slug && (
                <span className="mt-1.5 block text-xs font-normal text-muted">
                  L'ancienne adresse redirigera vers la nouvelle.
                </span>
              )}
            </label>
          )}

          <label className="block text-sm font-medium">
            Extrait
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={300}
              rows={4}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base font-normal focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-right text-xs font-normal text-muted tabular-nums">
              {excerpt.length} / 300
            </span>
          </label>

          {defaults.images.length > 0 && (
            <fieldset>
              <legend className="text-sm font-medium">Image de partage</legend>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                <label
                  className={`flex size-20 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-xs text-muted ${
                    ogImageUrl === null ? "border-ink" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="og"
                    className="sr-only"
                    checked={ogImageUrl === null}
                    onChange={() => setOgImageUrl(null)}
                  />
                  Générée
                </label>
                {defaults.images.map((src) => (
                  <label
                    key={src}
                    className={`size-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${
                      ogImageUrl === src ? "border-ink" : "border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="og"
                      className="sr-only"
                      checked={ogImageUrl === src}
                      onChange={() => setOgImageUrl(src)}
                    />
                    {/* biome-ignore lint/performance/noImgElement: small thumbnail of an image already in the text */}
                    <img src={src} alt="" className="size-full object-cover" />
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="tap w-full rounded-full bg-ink px-5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Un instant…" : live ? "Mettre à jour" : "Publier"}
          </button>

          {live && (
            <div className="space-y-3 border-t border-line pt-6 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-muted">{publicPath}</span>
                <button
                  type="button"
                  onClick={() => shareLink(title, publicPath)}
                  className="tap shrink-0 rounded-full border border-line px-4 hover:bg-surface"
                >
                  Partager
                </button>
              </div>
              {state.hasUnpublishedChanges && (
                <button
                  type="button"
                  onClick={discard}
                  disabled={pending}
                  className="block text-left underline-offset-4 hover:underline"
                >
                  Annuler les modifications non publiées
                </button>
              )}
              {state.status === "unlisted" && (
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={pending}
                  className="block text-left underline-offset-4 hover:underline"
                >
                  Régénérer le lien privé
                </button>
              )}
              <button
                type="button"
                onClick={unpublish}
                disabled={pending}
                className="block text-left text-danger underline-offset-4 hover:underline"
              >
                Dépublier
              </button>
            </div>
          )}
        </form>
      )}
    </Sheet>
  );
}
