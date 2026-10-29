"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, inputClass, primaryButtonClass } from "@/components/ui/field";
import { updateSettingsAction } from "../actions";

type Settings = {
  siteName: string;
  tagline: string;
  landingText: string;
  accessRequestsOpen: boolean;
  showLatestPostsOnLanding: boolean;
  readOnlyMode: boolean;
  legalNotice: string;
};

const TOGGLES: {
  key: "accessRequestsOpen" | "showLatestPostsOnLanding" | "readOnlyMode";
  label: string;
  hint: string;
}[] = [
  {
    key: "accessRequestsOpen",
    label: "Demandes d'accès ouvertes",
    hint: "Affiche le bouton « Demander un accès » et accepte le formulaire.",
  },
  {
    key: "showLatestPostsOnLanding",
    label: "Derniers textes sur l'accueil",
    hint: "Les cinq derniers textes publiés apparaissent sur la page d'accueil.",
  },
  {
    key: "readOnlyMode",
    label: "Mode lecture seule",
    hint: "Maintenance : toute écriture est refusée et une bannière s'affiche.",
  },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateSettingsAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(values);
      toast("Réglages enregistrés");
    });
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <Field id="siteName" label="Nom du site">
        <input
          id="siteName"
          required
          maxLength={60}
          value={values.siteName}
          onChange={(e) => set("siteName", e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field id="tagline" label="Slogan">
        <input
          id="tagline"
          maxLength={160}
          value={values.tagline}
          onChange={(e) => set("tagline", e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field id="landingText" label="Texte de l'accueil">
        <textarea
          id="landingText"
          rows={3}
          maxLength={600}
          value={values.landingText}
          onChange={(e) => set("landingText", e.target.value)}
          className={`${inputClass} resize-y`}
        />
      </Field>
      <fieldset className="space-y-4 rounded-xl border border-line p-5">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={values[t.key]}
              onChange={(e) => set(t.key, e.target.checked)}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted">{t.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field
        id="legalNotice"
        label="Mentions légales et confidentialité"
        hint="Texte brut, une ligne vide sépare les paragraphes."
      >
        <textarea
          id="legalNotice"
          rows={12}
          value={values.legalNotice}
          onChange={(e) => set("legalNotice", e.target.value)}
          className={`${inputClass} resize-y font-mono text-sm`}
        />
      </Field>
      <div className="sticky bottom-4 flex justify-end">
        <button type="submit" disabled={pending || !dirty} className={primaryButtonClass}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
