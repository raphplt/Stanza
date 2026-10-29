"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import type { PostStatus } from "@/db/schema";
import { postPublicPath, shareLink } from "@/lib/share";
import { foldForSearch } from "@/lib/slug";
import {
  createDraftPostAction,
  dismissChecklistAction,
  duplicatePostAction,
  emptyTrashAction,
  purgePostAction,
  resetReactionsAction,
  restorePostAction,
  togglePinAction,
  trashPostAction,
  unpublishPostAction,
} from "../actions";

export type StudioPost = {
  id: string;
  title: string;
  snippet: string;
  status: PostStatus;
  slug: string;
  shareId: string;
  hasUnpublishedChanges: boolean;
  pinned: boolean;
  trashed: boolean;
  updatedAt: string;
  dateLabel: string;
  reactions: number;
  views: number;
};

type Checklist = { photo: boolean; bio: boolean; published: boolean } | null;

const TABS = [
  { key: "brouillons", label: "Brouillons" },
  { key: "publies", label: "Publiés" },
  { key: "non-listes", label: "Non listés" },
  { key: "corbeille", label: "Corbeille" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SORTS = [
  { key: "recent", label: "Modifiés récemment" },
  { key: "ancien", label: "Plus anciens" },
  { key: "titre", label: "Titre A à Z" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const EMPTY: Record<TabKey, string> = {
  brouillons: "Aucun brouillon. Une idée ? Commencez un nouveau texte.",
  publies: "Aucun texte publié pour l'instant.",
  "non-listes": "Aucun texte non listé. Ils sont partagés par lien privé, sans apparaître sur votre profil.",
  corbeille: "La corbeille est vide. Les textes supprimés y restent 30 jours.",
};

function tabOf(p: StudioPost): TabKey {
  if (p.trashed) return "corbeille";
  if (p.status === "published") return "publies";
  if (p.status === "unlisted") return "non-listes";
  return "brouillons";
}

function parseTab(value: string | null): TabKey {
  return TABS.some((t) => t.key === value) ? (value as TabKey) : "brouillons";
}

function parseSort(value: string | null): SortKey {
  return SORTS.some((s) => s.key === value) ? (value as SortKey) : "recent";
}

export function StudioList({
  posts: initialPosts,
  username,
  checklist: initialChecklist,
}: {
  posts: StudioPost[];
  username: string;
  checklist: Checklist;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState(initialPosts);
  const [tab, setTab] = useState<TabKey>(parseTab(searchParams.get("onglet")));
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState<SortKey>(parseSort(searchParams.get("tri")));
  const [checklist, setChecklist] = useState(initialChecklist);
  const [purgeTarget, setPurgeTarget] = useState<StudioPost | "all" | null>(null);
  const [creating, startCreating] = useTransition();
  const [purging, startPurging] = useTransition();
  const [resetTarget, setResetTarget] = useState<StudioPost | null>(null);
  const [resetting, startResetting] = useTransition();

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    setChecklist(initialChecklist);
  }, [initialChecklist]);

  useEffect(() => {
    setTab(parseTab(searchParams.get("onglet")));
  }, [searchParams]);

  useEffect(() => {
    function refreshData() {
      router.refresh();
    }
    window.addEventListener("pageshow", refreshData);
    window.addEventListener("focus", refreshData);
    return () => {
      window.removeEventListener("pageshow", refreshData);
      window.removeEventListener("focus", refreshData);
    };
  }, [router]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "brouillons") params.set("onglet", tab);
    if (query.trim()) params.set("q", query.trim());
    if (sort !== "recent") params.set("tri", sort);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `/studio?${qs}` : "/studio");
  }, [tab, query, sort]);

  function createDraft() {
    startCreating(async () => {
      const res = await createDraftPostAction();
      if (res.ok) router.push(`/studio/ecrire/${res.postId}`);
      else toast.error(res.error);
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable='true'], dialog")) return;
      e.preventDefault();
      createDraft();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const counts = useMemo(() => {
    const result: Record<TabKey, number> = { brouillons: 0, publies: 0, "non-listes": 0, corbeille: 0 };
    for (const p of posts) result[tabOf(p)] += 1;
    return result;
  }, [posts]);

  const visible = useMemo(() => {
    const q = foldForSearch(query.trim());
    const list = posts.filter(
      (p) => tabOf(p) === tab && (!q || foldForSearch(`${p.title} ${p.snippet}`).includes(q)),
    );
    return list.sort((a, b) => {
      if (sort === "titre") return a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
      const diff = a.updatedAt.localeCompare(b.updatedAt);
      return sort === "ancien" ? diff : -diff;
    });
  }, [posts, tab, query, sort]);

  function patchPost(id: string, patch: Partial<StudioPost>) {
    setPosts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function optimistic(
    p: StudioPost,
    patch: Partial<StudioPost>,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    patchPost(p.id, patch);
    const res = await action();
    if (!res.ok) {
      patchPost(p.id, p);
      toast.error(res.error);
    }
    return res.ok;
  }

  async function trash(p: StudioPost) {
    const ok = await optimistic(p, { trashed: true, pinned: false }, () => trashPostAction(p.id));
    if (!ok) return;
    toast("Texte placé dans la corbeille", {
      action: {
        label: "Annuler",
        onClick: () =>
          optimistic({ ...p, trashed: true }, { trashed: false }, () =>
            restorePostAction(p.id, { undo: true }),
          ),
      },
    });
  }

  async function restore(p: StudioPost) {
    const ok = await optimistic(p, { trashed: false, status: "draft", hasUnpublishedChanges: false }, () =>
      restorePostAction(p.id),
    );
    if (ok) toast("Texte restauré dans les brouillons");
  }

  async function unpublish(p: StudioPost) {
    const ok = await optimistic(p, { status: "draft", pinned: false, hasUnpublishedChanges: false }, () =>
      unpublishPostAction(p.id),
    );
    if (!ok) return;
    toast("Texte dépublié", {
      action: { label: "Voir", onClick: () => setTab("brouillons") },
    });
  }

  async function togglePin(p: StudioPost) {
    const ok = await optimistic(p, { pinned: !p.pinned }, () => togglePinAction(p.id));
    if (ok) toast(p.pinned ? "Texte désépinglé" : "Texte épinglé sur votre profil");
  }

  async function duplicate(p: StudioPost) {
    const res = await duplicatePostAction(p.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPosts((list) => [
      {
        ...res.post,
        status: "draft",
        slug: res.post.id,
        shareId: "",
        hasUnpublishedChanges: false,
        pinned: false,
        trashed: false,
        dateLabel: "À l'instant",
        reactions: 0,
        views: 0,
      },
      ...list,
    ]);
    toast("Copie créée dans les brouillons", {
      action: { label: "Ouvrir", onClick: () => router.push(`/studio/ecrire/${res.post.id}`) },
    });
  }

  function confirmPurge() {
    const target = purgeTarget;
    if (!target) return;
    startPurging(async () => {
      const res = target === "all" ? await emptyTrashAction() : await purgePostAction(target.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPosts((list) => list.filter((p) => (target === "all" ? !p.trashed : p.id !== target.id)));
      setPurgeTarget(null);
      toast(target === "all" ? "Corbeille vidée" : "Texte supprimé définitivement");
    });
  }

  function confirmReset() {
    const target = resetTarget;
    if (!target) return;
    startResetting(async () => {
      const res = await resetReactionsAction(target.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      patchPost(target.id, { reactions: 0 });
      setResetTarget(null);
      toast("Réactions réinitialisées");
    });
  }

  function menuItems(p: StudioPost): MenuItem[] {
    if (p.trashed) {
      return [
        { label: "Restaurer", onSelect: () => restore(p) },
        { label: "Supprimer définitivement", danger: true, onSelect: () => setPurgeTarget(p) },
      ];
    }
    const live = p.status !== "draft";
    const items: MenuItem[] = [
      { label: "Ouvrir", onSelect: () => router.push(`/studio/ecrire/${p.id}`) },
      { label: "Aperçu", onSelect: () => window.open(`/studio/ecrire/${p.id}/apercu`, "_blank") },
    ];
    if (live) {
      items.push({
        label: "Partager",
        onSelect: () => shareLink(p.title, postPublicPath(p, username)),
      });
    }
    items.push({ label: "Dupliquer", onSelect: () => duplicate(p) });
    if (p.status === "published") {
      items.push({
        label: p.pinned ? "Désépingler" : "Épingler sur le profil",
        onSelect: () => togglePin(p),
      });
    }
    if (p.reactions > 0) {
      items.push({ label: "Réinitialiser les réactions", onSelect: () => setResetTarget(p) });
    }
    if (live) items.push({ label: "Dépublier", onSelect: () => unpublish(p) });
    items.push({ label: "Supprimer", danger: true, onSelect: () => trash(p) });
    return items;
  }

  async function dismissChecklist() {
    setChecklist(null);
    await dismissChecklistAction();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Mes textes</h1>
        <button
          type="button"
          onClick={createDraft}
          disabled={creating}
          aria-keyshortcuts="N"
          className="tap inline-flex items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Nouveau texte
          <kbd className="hidden rounded border border-paper/30 px-1.5 font-sans text-[11px] text-paper/70 sm:inline">
            N
          </kbd>
        </button>
      </div>

      {checklist && (
        <section className="mt-8 rounded-xl border border-line bg-surface/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-lg font-medium">Bienvenue sur Stanza</h2>
            <button
              type="button"
              onClick={dismissChecklist}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Masquer
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <ChecklistItem done={checklist.photo} href="/studio/profil" label="Ajouter une photo" />
            <ChecklistItem done={checklist.bio} href="/studio/profil" label="Écrire une courte bio" />
            <ChecklistItem done={checklist.published} label="Publier un premier texte" />
          </ul>
        </section>
      )}

      <div
        role="tablist"
        aria-label="Statut des textes"
        className="mt-8 -mx-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`tap -mb-px shrink-0 border-b-2 px-3 text-sm transition-colors ${
              tab === t.key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-muted tabular-nums">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher dans mes textes</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="tap w-full rounded-lg border border-line bg-paper px-3.5 text-sm text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">Trier</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="tap rounded-lg border border-line bg-paper px-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tab === "corbeille" && counts.corbeille > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-muted">
          <p>Les textes de la corbeille sont supprimés définitivement après 30 jours.</p>
          <button
            type="button"
            onClick={() => setPurgeTarget("all")}
            className="shrink-0 text-danger underline-offset-4 hover:underline"
          >
            Vider la corbeille
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-serif text-3xl text-muted" aria-hidden="true">
            ⁂
          </p>
          <p className="mx-auto mt-4 max-w-sm text-sm text-muted">
            {query.trim() ? "Aucun texte ne correspond à cette recherche." : EMPTY[tab]}
          </p>
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="tap mt-4 rounded-full border border-line px-4 text-sm hover:bg-surface"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {visible.map((p) => (
            <li key={p.id} className="group relative flex items-start gap-2 py-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-medium leading-snug">
                  {p.trashed ? (
                    <span>{p.title || "Sans titre"}</span>
                  ) : (
                    <Link
                      href={`/studio/ecrire/${p.id}`}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {p.title || <span className="text-muted">Sans titre</span>}
                    </Link>
                  )}
                </h3>
                {p.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.snippet}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span>Modifié le {p.dateLabel}</span>
                  {p.pinned && <span>Épinglé</span>}
                  {p.hasUnpublishedChanges && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                      Modifications non publiées
                    </span>
                  )}
                  {p.views > 0 && (
                    <span>
                      {p.views} lecture{p.views > 1 ? "s" : ""}
                    </span>
                  )}
                  {p.reactions > 0 && (
                    <span>
                      {p.reactions} réaction{p.reactions > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
              <div className="relative z-10 flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {p.trashed && (
                  <button
                    type="button"
                    onClick={() => restore(p)}
                    className="tap rounded-full px-3 text-sm text-ink hover:bg-surface"
                  >
                    Restaurer
                  </button>
                )}
                <Menu label={`Actions pour ${p.title || "Sans titre"}`} items={menuItems(p)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={purgeTarget !== null}
        title={purgeTarget === "all" ? "Vider la corbeille ?" : "Supprimer définitivement ?"}
        confirmLabel="Supprimer définitivement"
        pending={purging}
        onConfirm={confirmPurge}
        onClose={() => setPurgeTarget(null)}
      >
        {purgeTarget === "all"
          ? "Tous les textes de la corbeille et leur historique seront effacés. Cette action est irréversible."
          : "Ce texte et son historique seront effacés. Cette action est irréversible."}
      </ConfirmDialog>
      <ConfirmDialog
        open={resetTarget !== null}
        title="Réinitialiser les réactions ?"
        confirmLabel="Réinitialiser"
        pending={resetting}
        onConfirm={confirmReset}
        onClose={() => setResetTarget(null)}
      >
        Les {resetTarget?.reactions} réactions de ce texte seront effacées. Cette action est irréversible.
      </ConfirmDialog>
    </div>
  );
}

function ChecklistItem({ done, href, label }: { done: boolean; href?: string; label: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`flex size-5 items-center justify-center rounded-full border text-[11px] ${
          done ? "border-ink bg-ink text-paper" : "border-line"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      {href && !done ? (
        <Link href={href} className="underline-offset-4 hover:underline">
          {label}
        </Link>
      ) : (
        <span className={done ? "text-muted line-through" : ""}>
          {label}
          <span className="sr-only">{done ? " (fait)" : ""}</span>
        </span>
      )}
    </li>
  );
}
