"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "@/app/studio/actions";
import { ShortcutsDialog } from "./editor-dialogs";
import { HistoryPanel } from "./history-panel";
import { PublishPanel, type PublishState } from "./publish-panel";

const RichEditor = dynamic(() => import("./rich-editor").then((m) => m.RichEditor), {
  ssr: false,
  loading: () => <div className="prose-stanza mx-auto min-h-[50vh]" aria-hidden="true" />,
});

export type EditorPost = PublishState & {
  id: string;
  title: string;
  content: JSONContent;
  version: number;
  updatedAt: string;
};

type SaveStatus = "saved" | "pending" | "offline" | "error" | "conflict";
type Backup = { title: string; content: JSONContent; at: number };

const SAVE_DELAY_MS = 1000;
const RETRY_DELAY_MS = 5000;

function countWords(title: string, editor: Editor | null) {
  const text = `${title} ${editor?.getText({ blockSeparator: " " }) ?? ""}`;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function EditorScreen({ post, username }: { post: EditorPost; username: string }) {
  const router = useRouter();
  const backupKey = `stanza:backup:${post.id}`;
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const doc = useRef({
    title: post.title,
    content: post.content,
    version: post.version,
    dirty: false,
    conflict: false,
    locked: false,
    inflight: null as Promise<boolean> | null,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });

  const [title, setTitle] = useState(post.title);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [publishState, setPublishState] = useState<PublishState>({
    status: post.status,
    slug: post.slug,
    shareId: post.shareId,
    hasUnpublishedChanges: post.hasUnpublishedChanges,
  });
  const [backup, setBackup] = useState<Backup | null>(null);
  const [panel, setPanel] = useState<"publish" | "history" | "help" | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [words, setWords] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    router.prefetch("/studio");
  }, [router]);

  useEffect(() => {
    return () => {
      clearTimeout(justSavedTimer.current);
    };
  }, []);

  const writeBackup = useCallback(() => {
    const d = doc.current;
    try {
      localStorage.setItem(backupKey, JSON.stringify({ title: d.title, content: d.content, at: Date.now() }));
    } catch {}
  }, [backupKey]);

  const clearBackup = useCallback(() => {
    try {
      localStorage.removeItem(backupKey);
    } catch {}
  }, [backupKey]);

  const saveOnce = useCallback(
    async (force: boolean): Promise<boolean> => {
      const d = doc.current;
      d.dirty = false;
      setStatus("pending");
      try {
        const res = await saveDraftAction({
          postId: post.id,
          title: d.title,
          content: JSON.stringify(d.content),
          baseVersion: d.version,
          force,
        });
        if (res.ok) {
          d.version = res.version;
          d.conflict = false;
          setPublishState((s) => ({ ...s, hasUnpublishedChanges: res.hasUnpublishedChanges }));
          if (!d.dirty) {
            clearBackup();
            setStatus("saved");
          }
          return true;
        }
        d.dirty = true;
        if (res.conflict) {
          d.conflict = true;
          setStatus("conflict");
          return false;
        }
        setStatus("error");
      } catch {
        d.dirty = true;
        setStatus("offline");
      }
      clearTimeout(d.timer);
      d.timer = setTimeout(() => flushRef.current(), RETRY_DELAY_MS);
      return false;
    },
    [post.id, clearBackup],
  );

  const flush = useCallback(
    async (force = false): Promise<boolean> => {
      const d = doc.current;
      clearTimeout(d.timer);
      while (d.inflight) await d.inflight;
      if (d.locked || (d.conflict && !force)) return false;
      if (!d.dirty && !force) return true;
      d.inflight = saveOnce(force);
      const ok = await d.inflight;
      d.inflight = null;
      if (ok && d.dirty) return flushRef.current();
      return ok;
    },
    [saveOnce],
  );
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const handleManualSave = useCallback(async () => {
    const ok = await flushRef.current(true);
    if (ok) {
      setJustSaved(true);
      clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    }
  }, []);

  const markDirty = useCallback(() => {
    const d = doc.current;
    d.dirty = true;
    writeBackup();
    if (d.conflict) return;
    setStatus(navigator.onLine ? "pending" : "offline");
    clearTimeout(d.timer);
    if (!d.locked) d.timer = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
  }, [writeBackup]);

  const exclusive = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (!(await flushRef.current())) return null;
    const d = doc.current;
    d.locked = true;
    try {
      return await fn();
    } finally {
      d.locked = false;
      if (d.dirty) d.timer = setTimeout(() => flushRef.current(), SAVE_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Backup;
      if (saved.at > Date.parse(post.updatedAt)) setBackup(saved);
      else localStorage.removeItem(backupKey);
    } catch {}
  }, [backupKey, post.updatedAt]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushRef.current();
    };
    const onPageHide = () => flushRef.current();
    const onOnline = () => flushRef.current();
    const onOffline = () => {
      if (doc.current.dirty) setStatus("offline");
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (doc.current.dirty || doc.current.inflight) {
        flushRef.current();
        e.preventDefault();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleManualSave();
        return;
      }
      if (e.key === "Escape" && focusMode && !panel) {
        setFocusMode(false);
        return;
      }
      const target = e.target as HTMLElement;
      if (e.key === "?" && !target.closest("input, textarea, [contenteditable='true']")) {
        e.preventDefault();
        setPanel("help");
      }
    }
    function onMouseMove() {
      setTyping(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [focusMode, panel, handleManualSave]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  });

  function onTyping() {
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 2500);
  }

  function onTitleChange(value: string) {
    const clean = value.replace(/\s*\n\s*/g, " ");
    setTitle(clean);
    doc.current.title = clean;
    setWords(countWords(clean, editorRef.current));
    markDirty();
  }

  const onContentChange = useCallback(
    (content: JSONContent) => {
      doc.current.content = content;
      setWords(countWords(doc.current.title, editorRef.current));
      markDirty();
    },
    [markDirty],
  );

  const onReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
    setWords(countWords(doc.current.title, editor));
    if (!doc.current.title) titleRef.current?.focus();
    else editor.commands.focus("end");
  }, []);

  function resetContent(nextTitle: string, content: JSONContent) {
    const d = doc.current;
    d.title = nextTitle;
    d.content = content;
    d.dirty = false;
    clearTimeout(d.timer);
    setTitle(nextTitle);
    editorRef.current?.commands.setContent(content, { emitUpdate: false });
    setWords(countWords(nextTitle, editorRef.current));
    clearBackup();
    setStatus("saved");
  }

  function restoreBackup() {
    if (!backup) return;
    const d = doc.current;
    d.title = backup.title;
    d.content = backup.content;
    setTitle(backup.title);
    editorRef.current?.commands.setContent(backup.content, { emitUpdate: false });
    setBackup(null);
    markDirty();
  }

  const leave = useCallback(async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      const d = doc.current;
      if (d.dirty || d.inflight) {
        await flushRef.current(false);
      }
      router.push("/studio");
    } catch {
      setIsLeaving(false);
    }
  }, [isLeaving, router]);

  async function openPreview() {
    const win = window.open("about:blank", "_blank");
    await flushRef.current();
    if (win) win.location.href = `/studio/ecrire/${post.id}/apercu`;
  }

  const live = publishState.status !== "draft";
  const publishLabel = !live
    ? "Publier"
    : publishState.hasUnpublishedChanges
      ? "Mettre à jour"
      : publishState.status === "unlisted"
        ? "Non listé"
        : "Publié";
  const chromeHidden = focusMode
    ? "pointer-events-none opacity-0"
    : typing
      ? "opacity-15 hover:opacity-100 focus-within:opacity-100"
      : "opacity-100";

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={`sticky top-0 z-30 bg-paper/95 backdrop-blur transition-opacity duration-200 ${chromeHidden}`}
      >
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-3 sm:px-6">
          <button
            type="button"
            onClick={leave}
            disabled={isLeaving}
            aria-label="Retour au studio"
            title="Retour au studio"
            className="tap flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-60"
          >
            {isLeaving ? (
              <svg
                viewBox="0 0 16 16"
                className="size-4 animate-spin text-muted"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 20 20"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M12.5 4.5L7 10l5.5 5.5" />
              </svg>
            )}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={handleManualSave}
              disabled={status === "pending"}
              title="Enregistrer maintenant (Ctrl+S)"
              className="tap inline-flex items-center gap-1.5 rounded-full border border-line/60 bg-paper px-2.5 py-1 text-xs text-muted transition-colors hover:border-line hover:bg-surface hover:text-ink disabled:opacity-50"
            >
              {status === "pending" ? (
                <>
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3 animate-spin text-muted"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                    <path
                      d="M14 8a6 6 0 0 0-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Enregistrement…</span>
                </>
              ) : justSaved ? (
                <>
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3 text-accent"
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
              ) : (
                <>
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3 text-muted/70"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12.5 13.5H3.5a1 1 0 01-1-1V3.5a1 1 0 011-1h6.5l3.5 3.5v6.5a1 1 0 01-1 1z" />
                    <path d="M5.5 2.5v3h4v-3M5.5 13.5v-4h5v4" />
                  </svg>
                  <span>Enregistrer</span>
                </>
              )}
            </button>
            <p role="status" aria-live="polite" className="min-w-0 truncate text-xs text-muted">
              {isLeaving && (doc.current.dirty || doc.current.inflight) ? (
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3 animate-spin text-muted/70"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                    <path
                      d="M14 8a6 6 0 0 0-6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="hidden sm:inline">Enregistrement avant sortie…</span>
                </span>
              ) : (
                <>
                  {status === "pending" && (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <svg
                        viewBox="0 0 16 16"
                        className="size-3 animate-spin text-muted/70"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeOpacity="0.25"
                        />
                        <path
                          d="M14 8a6 6 0 0 0-6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="hidden sm:inline">En cours d'enregistrement…</span>
                    </span>
                  )}
                  {status === "offline" && (
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <svg
                        viewBox="0 0 16 16"
                        className="size-3 text-muted/70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M2.5 12.5h9a3 3 0 00.5-5.96A4 4 0 004.5 9a2.5 2.5 0 00-2 3.5" />
                        <path d="M2 2l12 12" />
                      </svg>
                      <span>Hors ligne, conservé localement</span>
                    </span>
                  )}
                  {status === "error" && (
                    <span className="inline-flex items-center gap-1.5 text-accent">
                      <svg
                        viewBox="0 0 16 16"
                        className="size-3 text-accent"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="8" cy="8" r="6" />
                        <path d="M8 5v3.5M8 11.5h.01" />
                      </svg>
                      <span>Échec de l'enregistrement, nouvel essai…</span>
                    </span>
                  )}
                  {status === "conflict" && (
                    <span className="inline-flex items-center gap-1.5 text-accent">
                      <svg
                        viewBox="0 0 16 16"
                        className="size-3 text-accent"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M8 2.5l5.5 10H2.5L8 2.5z" />
                        <path d="M8 6.5v3M8 11.5h.01" />
                      </svg>
                      <span>Non enregistré (conflit)</span>
                    </span>
                  )}
                  {status === "saved" && !justSaved && (
                    <span className="inline-flex items-center gap-1.5 text-muted">
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
                      <span className="hidden sm:inline">Enregistré</span>
                    </span>
                  )}
                </>
              )}
              {live && publishState.hasUnpublishedChanges && (
                <span className="ml-2 hidden rounded-full bg-accent/10 px-2 py-0.5 text-accent sm:inline">
                  Modifications non publiées
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFocusMode(true)}
            aria-label="Mode focus"
            title="Mode focus (Ctrl Maj F)"
            className="tap hidden items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink sm:flex"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openPreview}
            className="tap rounded-full px-3 text-sm hover:bg-surface"
          >
            Aperçu
          </button>
          <button
            type="button"
            onClick={() => setPanel("history")}
            className="tap hidden rounded-full px-3 text-sm hover:bg-surface sm:block"
          >
            Historique
          </button>
          <button
            type="button"
            onClick={() => setPanel("publish")}
            className={`tap rounded-full px-4 text-sm font-medium transition-opacity hover:opacity-90 ${
              live && !publishState.hasUnpublishedChanges
                ? "border border-line text-ink"
                : "bg-ink text-paper"
            }`}
          >
            {publishLabel}
          </button>
        </div>
      </header>

      {status === "conflict" && (
        <div role="alert" className="border-y border-accent/30 bg-accent/5 px-4 py-3 text-sm">
          <div className="mx-auto flex max-w-read flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex-1">Ce texte a été modifié ailleurs (autre onglet ou appareil).</p>
            <button
              type="button"
              onClick={() => {
                clearBackup();
                window.location.reload();
              }}
              className="underline underline-offset-4"
            >
              Recharger
            </button>
            <button
              type="button"
              onClick={() => flushRef.current(true)}
              className="font-medium underline underline-offset-4"
            >
              Écraser avec cette version
            </button>
          </div>
        </div>
      )}

      {backup && (
        <div role="alert" className="border-y border-line bg-surface px-4 py-3 text-sm">
          <div className="mx-auto flex max-w-read flex-wrap items-center gap-x-4 gap-y-2">
            <p className="flex-1">
              Une copie locale plus récente de ce texte a été trouvée sur cet appareil.
            </p>
            <button
              type="button"
              onClick={() => {
                clearBackup();
                setBackup(null);
              }}
              className="underline underline-offset-4"
            >
              Ignorer
            </button>
            <button
              type="button"
              onClick={restoreBackup}
              className="font-medium underline underline-offset-4"
            >
              Restaurer
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-read flex-1 px-5 pt-10 pb-40 sm:pt-16">
        <label htmlFor="post-title" className="sr-only">
          Titre
        </label>
        <textarea
          id="post-title"
          ref={titleRef}
          value={title}
          rows={1}
          maxLength={300}
          placeholder="Titre"
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            onTyping();
            if (
              e.key === "Enter" ||
              (e.key === "ArrowDown" && e.currentTarget.selectionStart === title.length)
            ) {
              e.preventDefault();
              const editor = editorRef.current;
              if (editor) {
                editor.commands.setTextSelection(1);
                editor.view.focus();
              }
            }
          }}
          className="block w-full resize-none overflow-hidden bg-transparent font-serif text-4xl leading-tight font-medium tracking-tight placeholder:text-muted/50 focus:outline-none sm:text-5xl"
        />
        <div className="mt-8">
          <RichEditor
            initialContent={post.content}
            onChange={onContentChange}
            onReady={onReady}
            onTyping={onTyping}
          />
        </div>
      </main>

      <footer
        className={`fixed right-0 bottom-0 z-20 hidden items-center gap-3 px-5 py-3 text-xs text-muted transition-opacity duration-200 sm:flex ${chromeHidden}`}
      >
        <span className="tabular-nums">
          {words} mot{words > 1 ? "s" : ""} · {Math.max(1, Math.ceil(words / 200))} min de lecture
        </span>
        <button
          type="button"
          onClick={() => setPanel("help")}
          aria-label="Raccourcis clavier"
          className="flex size-6 items-center justify-center rounded-full border border-line hover:text-ink"
        >
          ?
        </button>
      </footer>

      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="fixed top-3 right-3 z-40 rounded-full px-3 py-1.5 text-xs text-muted opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
        >
          Quitter le mode focus (Échap)
        </button>
      )}

      <PublishPanel
        open={panel === "publish"}
        onClose={() => setPanel(null)}
        postId={post.id}
        title={title}
        username={username}
        state={publishState}
        exclusive={exclusive}
        onVersion={(version) => {
          doc.current.version = version;
        }}
        onStateChange={(patch) => setPublishState((s) => ({ ...s, ...patch }))}
        onContentReset={resetContent}
      />

      <HistoryPanel
        open={panel === "history"}
        onClose={() => setPanel(null)}
        postId={post.id}
        flush={flush}
        exclusive={exclusive}
        onRestored={(res) => {
          doc.current.version = res.version;
          resetContent(res.title, res.content);
          setPublishState((s) => ({ ...s, hasUnpublishedChanges: res.hasUnpublishedChanges }));
        }}
      />

      <ShortcutsDialog open={panel === "help"} onClose={() => setPanel(null)} />
    </div>
  );
}
