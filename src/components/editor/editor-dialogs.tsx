"use client";

import { useEffect, useRef, useState } from "react";
import { isAllowedLinkHref } from "@/lib/editor-extensions";

function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
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
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-paper p-6 text-ink backdrop:bg-ink/30"
    >
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      {open && children}
    </dialog>
  );
}

const inputClass =
  "tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none";

function DialogActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="tap rounded-full px-4 text-sm hover:bg-surface">
        Annuler
      </button>
      <button type="submit" className="tap rounded-full bg-ink px-5 text-sm font-medium text-paper">
        {submitLabel}
      </button>
    </div>
  );
}

export type ImageDetails = { alt: string; caption: string };

export function ImageDialog({
  open,
  src,
  initial,
  submitLabel,
  onSubmit,
  onClose,
}: {
  open: boolean;
  src: string | null;
  initial: ImageDetails;
  submitLabel: string;
  onSubmit: (details: ImageDetails) => void;
  onClose: () => void;
}) {
  const [alt, setAlt] = useState(initial.alt);
  const [caption, setCaption] = useState(initial.caption);

  useEffect(() => {
    if (open) {
      setAlt(initial.alt);
      setCaption(initial.caption);
    }
  }, [open, initial.alt, initial.caption]);

  return (
    <Dialog open={open} onClose={onClose} title="Décrire l'image">
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ alt: alt.trim(), caption: caption.trim() });
        }}
      >
        {src && (
          // biome-ignore lint/performance/noImgElement: preview of a just-uploaded image of unknown size
          <img src={src} alt="" className="max-h-48 w-full rounded-lg bg-surface object-contain" />
        )}
        <label className="mt-4 block text-sm font-medium">
          Texte alternatif
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            maxLength={300}
            autoFocus
            placeholder="Ce que montre l'image, pour qui ne la voit pas"
            className={inputClass}
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Légende <span className="font-normal text-muted">(facultative)</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={300}
            className={inputClass}
          />
        </label>
        <DialogActions onCancel={onClose} submitLabel={submitLabel} />
      </form>
    </Dialog>
  );
}

export function normalizeHref(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isAllowedLinkHref(trimmed)) return trimmed;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export function LinkDialog({
  open,
  initialHref,
  onSubmit,
  onClose,
}: {
  open: boolean;
  initialHref: string;
  onSubmit: (href: string) => void;
  onClose: () => void;
}) {
  const [href, setHref] = useState(initialHref);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHref(initialHref);
      setError(null);
    }
  }, [open, initialHref]);

  return (
    <Dialog open={open} onClose={onClose} title={initialHref ? "Modifier le lien" : "Ajouter un lien"}>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const normalized = normalizeHref(href);
          if (normalized === null) {
            setError("Seuls les liens http, https et mailto sont acceptés.");
            return;
          }
          onSubmit(normalized);
        }}
      >
        <label className="block text-sm font-medium">
          Adresse
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            inputMode="url"
            autoFocus
            placeholder="https://…"
            className={inputClass}
          />
        </label>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        {initialHref && <p className="mt-2 text-xs text-muted">Videz le champ pour retirer le lien.</p>}
        <DialogActions onCancel={onClose} submitLabel="Valider" />
      </form>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Gras", "Ctrl B"],
  ["Italique", "Ctrl I"],
  ["Barré", "Ctrl Maj S"],
  ["Lien", "Ctrl K"],
  ["Intertitres", "Ctrl Alt 2 · 3 · 4"],
  ["Citation", "Ctrl Maj B"],
  ["Liste à puces / numérotée", "Ctrl Maj 8 · 7"],
  ["Retour à la ligne simple", "Maj Entrée"],
  ["Annuler / rétablir", "Ctrl Z · Ctrl Maj Z"],
  ["Menu d'insertion", "/ sur une ligne vide"],
  ["Mode focus", "Ctrl Maj F"],
];

const MARKDOWN: [string, string][] = [
  ["## , ### , ####", "Intertitres"],
  ["> ", "Citation"],
  ["- ou 1. ", "Listes"],
  ["**gras**, *italique*, ~~barré~~", "Mise en forme"],
  ["---", "Séparateur ⁂"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Raccourcis">
      <p className="mt-1 text-xs text-muted">Sur Mac, Ctrl correspond à ⌘.</p>
      <dl className="mt-4 space-y-2 text-sm">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd className="text-right text-muted">{keys}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 text-sm font-medium">En tapant</h3>
      <dl className="mt-2 space-y-2 text-sm">
        {MARKDOWN.map(([keys, label]) => (
          <div key={keys} className="flex justify-between gap-4">
            <dt className="font-mono text-xs">{keys}</dt>
            <dd className="text-muted">{label}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className="tap rounded-full px-4 text-sm hover:bg-surface">
          Fermer
        </button>
      </div>
    </Dialog>
  );
}
