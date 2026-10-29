"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { checkUsernameAvailabilityAction } from "@/app/(auth)/actions";
import {
  updateAvatarAction,
  updateBioAction,
  updateLinksAction,
  updateNameAction,
  updateUsernameAction,
} from "@/app/studio/account-actions";
import { AvatarCropDialog } from "@/components/ui/avatar-crop-dialog";
import {
  Field,
  inputClass,
  SaveStatus,
  Section,
  secondaryButtonClass,
  useSaver,
} from "@/components/ui/field";
import type { AuthorLink } from "@/db/schema";

type Profile = {
  id: string;
  name: string;
  username: string;
  bio: string;
  image: string | null;
  links: AuthorLink[];
};

export function ProfileEditor({ initial }: { initial: Profile }) {
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [links, setLinks] = useState<AuthorLink[]>(initial.links);
  const nameSaver = useSaver();
  const bioSaver = useSaver();
  const linksSaver = useSaver();

  async function saveName() {
    if (name.trim() === saved.name) return;
    const res = await nameSaver.save(() => updateNameAction(name));
    if (res.ok) setSaved((s) => ({ ...s, name: res.name }));
    else setName(saved.name);
  }

  async function saveBio() {
    if (bio.trim() === saved.bio) return;
    const res = await bioSaver.save(() => updateBioAction(bio));
    if (res.ok) setSaved((s) => ({ ...s, bio: res.bio }));
  }

  async function saveLinks(next: AuthorLink[]) {
    const complete = next.filter((l) => l.label.trim() || l.url.trim());
    if (JSON.stringify(complete) === JSON.stringify(saved.links)) return;
    if (complete.some((l) => !l.label.trim() || !l.url.trim())) return;
    const res = await linksSaver.save(() => updateLinksAction(complete));
    if (res.ok) setSaved((s) => ({ ...s, links: res.links }));
  }

  function updateLink(index: number, patch: Partial<AuthorLink>) {
    setLinks((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLink(index: number) {
    const next = links.filter((_, i) => i !== index);
    setLinks(next);
    saveLinks(next);
  }

  return (
    <div>
      <Section title="Photo">
        <AvatarField
          name={saved.name}
          image={saved.image}
          onChange={(image) => setSaved((s) => ({ ...s, image }))}
        />
      </Section>

      <Section title="Identité">
        <Field id="name" label="Nom affiché" state={nameSaver.state}>
          <input
            id="name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className={inputClass}
          />
        </Field>
        <UsernameField
          userId={saved.id}
          username={saved.username}
          onChange={(username) => setSaved((s) => ({ ...s, username }))}
        />
      </Section>

      <Section title="Présentation">
        <Field
          id="bio"
          label="Bio"
          state={bioSaver.state}
          hint={`${bio.length}/300 · Les adresses web deviennent des liens.`}
        >
          <textarea
            id="bio"
            value={bio}
            maxLength={300}
            rows={4}
            onChange={(e) => setBio(e.target.value)}
            onBlur={saveBio}
            className={`${inputClass} resize-none font-serif text-lg`}
            placeholder="Quelques mots sur vous et ce que vous écrivez."
          />
        </Field>
        <fieldset>
          <div className="flex items-baseline justify-between">
            <legend className="text-sm font-medium">Liens</legend>
            <SaveStatus state={linksSaver.state} />
          </div>
          <div className="mt-1.5 space-y-3">
            {links.map((link, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id until saved
                key={i}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <input
                  aria-label={`Libellé du lien ${i + 1}`}
                  value={link.label}
                  maxLength={40}
                  placeholder="Instagram"
                  onChange={(e) => updateLink(i, { label: e.target.value })}
                  onBlur={() => saveLinks(links)}
                  className={`${inputClass} sm:w-40`}
                />
                <input
                  aria-label={`Adresse du lien ${i + 1}`}
                  type="url"
                  value={link.url}
                  placeholder="https://"
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  onBlur={() => saveLinks(links)}
                  className={`${inputClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  className="tap rounded-full px-3 text-sm text-muted hover:bg-surface hover:text-danger"
                >
                  Retirer
                </button>
              </div>
            ))}
            {links.length < 3 && (
              <button
                type="button"
                onClick={() => setLinks((l) => [...l, { label: "", url: "" }])}
                className={secondaryButtonClass}
              >
                Ajouter un lien
              </button>
            )}
          </div>
        </fieldset>
      </Section>

      <Section title="Aperçu">
        <div className="rounded-2xl border border-line p-6">
          <Avatar name={saved.name} image={saved.image} size={64} />
          <p className="mt-4 font-serif text-2xl font-medium">{name || saved.name}</p>
          <p className="text-sm text-muted">@{saved.username}</p>
          {bio && <p className="mt-3 font-serif whitespace-pre-line text-ink/90">{bio}</p>}
          {links.some((l) => l.label && l.url) && (
            <p className="mt-3 flex flex-wrap gap-x-4 text-sm underline decoration-line underline-offset-4">
              {links
                .filter((l) => l.label && l.url)
                .map((l) => (
                  <span key={l.url}>{l.label}</span>
                ))}
            </p>
          )}
        </div>
        <Link href={`/${saved.username}`} className="text-sm text-muted underline-offset-4 hover:underline">
          Voir mon profil public
        </Link>
      </Section>
    </div>
  );
}

function Avatar({ name, image, size }: { name: string; image: string | null; size: number }) {
  return image ? (
    <Image
      src={image}
      alt=""
      width={size}
      height={size}
      className="rounded-full border border-line object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex items-center justify-center rounded-full border border-line bg-surface font-serif"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function AvatarField({
  name,
  image,
  onChange,
}: {
  name: string;
  image: string | null;
  onChange: (image: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(blob: Blob) {
    startTransition(async () => {
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      form.append("kind", "avatar");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Envoi impossible.");
        return;
      }
      const saved = await updateAvatarAction(data.url);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      onChange(saved.image);
      setFile(null);
      toast("Photo mise à jour");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await updateAvatarAction(null);
      if (res.ok) onChange(null);
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar name={name} image={image} size={88} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className={secondaryButtonClass}
        >
          {image ? "Changer la photo" : "Ajouter une photo"}
        </button>
        {image && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="tap rounded-full px-4 text-sm text-muted hover:bg-surface"
          >
            Retirer
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            e.target.value = "";
            if (!selected) return;
            if (selected.size > 5 * 1024 * 1024) {
              toast.error("La photo ne peut pas dépasser 5 Mo.");
              return;
            }
            setFile(selected);
          }}
        />
      </div>
      <AvatarCropDialog file={file} pending={pending} onCancel={() => setFile(null)} onConfirm={upload} />
    </div>
  );
}

function UsernameField({
  userId,
  username,
  onChange,
}: {
  userId: string;
  username: string;
  onChange: (username: string) => void;
}) {
  const [value, setValue] = useState(username);
  const [hint, setHint] = useState<{ available: boolean; reason: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const clean = value.trim().toLowerCase();
  const changed = clean !== username;

  useEffect(() => {
    if (!changed || !clean) {
      setHint(null);
      return;
    }
    const timer = setTimeout(async () => setHint(await checkUsernameAvailabilityAction(clean, userId)), 250);
    return () => clearTimeout(timer);
  }, [clean, changed, userId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateUsernameAction(clean);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onChange(res.username);
      setValue(res.username);
      toast("Pseudo modifié. L'ancienne adresse redirige vers la nouvelle.");
    });
  }

  return (
    <form onSubmit={submit}>
      <Field
        id="username"
        label="Pseudo"
        hint={
          hint ? (
            <span className={hint.available ? "text-ink" : "text-danger"}>{hint.reason}</span>
          ) : (
            "Adresse de votre profil. Un changement redirige l'ancienne adresse."
          )
        }
      >
        <div className="flex gap-2">
          <div className="flex flex-1 items-center rounded-lg border border-line bg-paper px-3.5 focus-within:border-accent">
            <span className="text-sm text-muted select-none">stanza/</span>
            <input
              id="username"
              value={value}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setValue(e.target.value)}
              className="tap w-full bg-transparent py-2.5 pl-0.5 text-base focus:outline-none"
            />
          </div>
          {changed && (
            <button
              type="submit"
              disabled={pending || hint?.available === false}
              className={secondaryButtonClass}
            >
              Enregistrer
            </button>
          )}
        </div>
      </Field>
    </form>
  );
}
