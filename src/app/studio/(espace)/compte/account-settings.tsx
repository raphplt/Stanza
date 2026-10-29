"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changeEmailAction,
  changePasswordAction,
  deactivateAccountAction,
  deleteAccountAction,
  revokeOtherSessionsAction,
  updatePreferencesAction,
} from "@/app/studio/account-actions";
import { emptyTrashAction } from "@/app/studio/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Field,
  inputClass,
  SaveStatus,
  Section,
  secondaryButtonClass,
  useSaver,
} from "@/components/ui/field";
import type { UserTheme } from "@/db/schema";
import { applyTheme } from "@/lib/theme";

type Account = {
  email: string;
  username: string;
  isSuperAdmin: boolean;
  reactionsEnabled: boolean;
  frenchTypography: boolean;
  theme: UserTheme;
  trashed: number;
};

type SessionRow = { id: string; device: string; lastActive: string; current: boolean };

export function AccountSettings({ account, sessions }: { account: Account; sessions: SessionRow[] }) {
  return (
    <div>
      <Section title="Connexion">
        <EmailForm email={account.email} />
        <PasswordForm />
      </Section>
      <Section title="Préférences">
        <Preferences account={account} />
      </Section>
      <Section title="Sessions actives">
        <Sessions sessions={sessions} />
      </Section>
      <Section title="Mes données">
        <DataTools trashed={account.trashed} />
      </Section>
      <Section title="Zone sensible">
        <DangerZone username={account.username} isSuperAdmin={account.isSuperAdmin} />
      </Section>
    </div>
  );
}

function EmailForm({ email }: { email: string }) {
  const [current, setCurrent] = useState(email);
  const [value, setValue] = useState(email);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const changed = value.trim().toLowerCase() !== current;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await changeEmailAction({ email: value, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrent(res.email);
      setValue(res.email);
      setPassword("");
      toast("Adresse email modifiée");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field id="email" label="Email">
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
        />
      </Field>
      {changed && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            aria-label="Mot de passe actuel"
            placeholder="Mot de passe actuel pour confirmer"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" disabled={pending || !password} className={secondaryButtonClass}>
            Modifier l'email
          </button>
        </div>
      )}
    </form>
  );
}

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast("Mot de passe modifié");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field id="current-password" label="Mot de passe">
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          placeholder="Mot de passe actuel"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          aria-label="Nouveau mot de passe"
          autoComplete="new-password"
          placeholder="Nouveau (12 caractères min.)"
          minLength={12}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={pending || !currentPassword || newPassword.length < 12}
          className={secondaryButtonClass}
        >
          Changer
        </button>
      </div>
    </form>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-6">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-paper after:transition-transform peer-checked:after:translate-x-4"
      />
    </label>
  );
}

const THEMES: { value: UserTheme; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

function Preferences({ account }: { account: Account }) {
  const [prefs, setPrefs] = useState({
    reactionsEnabled: account.reactionsEnabled,
    frenchTypography: account.frenchTypography,
    theme: account.theme,
  });
  const saver = useSaver();

  async function update(patch: Partial<typeof prefs>) {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    if (patch.theme) applyTheme(patch.theme);
    const res = await saver.save(() => updatePreferencesAction(patch));
    if (!res.ok) {
      setPrefs(previous);
      applyTheme(previous.theme);
    }
  }

  return (
    <>
      <div className="-mt-2 flex justify-end">
        <SaveStatus state={saver.state} />
      </div>
      <Toggle
        label="Réactions"
        description="Les lecteurs peuvent réagir à vos textes. Désactiver les masque sans les effacer."
        checked={prefs.reactionsEnabled}
        onChange={(v) => update({ reactionsEnabled: v })}
      />
      <Toggle
        label="Typographie française"
        description="Espaces insécables et guillemets corrigés à la publication."
        checked={prefs.frenchTypography}
        onChange={(v) => update({ frenchTypography: v })}
      />
      <fieldset>
        <legend className="text-sm font-medium">Thème</legend>
        <div className="mt-2 inline-flex rounded-full border border-line p-1">
          {THEMES.map((t) => (
            <label
              key={t.value}
              className={`tap flex cursor-pointer items-center rounded-full px-4 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent/50 ${
                prefs.theme === t.value ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={prefs.theme === t.value}
                onChange={() => update({ theme: t.value })}
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function Sessions({ sessions }: { sessions: SessionRow[] }) {
  const [list, setList] = useState(sessions);
  const [pending, startTransition] = useTransition();
  const others = list.filter((s) => !s.current).length;

  function revoke() {
    startTransition(async () => {
      const res = await revokeOtherSessionsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setList((l) => l.filter((s) => s.current));
      toast(res.count > 0 ? "Déconnecté des autres appareils" : "Aucune autre session");
    });
  }

  return (
    <>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {list.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span>
              {s.device}
              {s.current && <span className="ml-2 text-xs text-accent">Cet appareil</span>}
            </span>
            <span className="text-xs text-muted">{s.lastActive}</span>
          </li>
        ))}
      </ul>
      {others > 0 && (
        <button type="button" onClick={revoke} disabled={pending} className={secondaryButtonClass}>
          Se déconnecter partout ailleurs
        </button>
      )}
    </>
  );
}

function DataTools({ trashed }: { trashed: number }) {
  const [count, setCount] = useState(trashed);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function empty() {
    startTransition(async () => {
      const res = await emptyTrashAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCount(0);
      setConfirming(false);
      toast("Corbeille vidée");
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm">
          <span className="block font-medium">Exporter mes textes</span>
          <span className="mt-0.5 block text-xs text-muted">
            Une archive ZIP avec un fichier Markdown par texte et toutes vos données en JSON.
          </span>
        </p>
        <a href="/studio/export" download className={`${secondaryButtonClass} shrink-0`}>
          Exporter
        </a>
      </div>
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm">
          <span className="block font-medium">Vider la corbeille</span>
          <span className="mt-0.5 block text-xs text-muted">
            {count > 0
              ? `${count} texte${count > 1 ? "s" : ""} dans la corbeille.`
              : "La corbeille est vide."}
          </span>
        </p>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => setConfirming(true)}
          className={`${secondaryButtonClass} shrink-0`}
        >
          Vider
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Vider la corbeille ?"
        confirmLabel="Supprimer définitivement"
        pending={pending}
        onConfirm={empty}
        onClose={() => setConfirming(false)}
      >
        Tous les textes de la corbeille et leur historique seront effacés. Cette action est irréversible.
      </ConfirmDialog>
    </>
  );
}

function DangerZone({ username, isSuperAdmin }: { username: string; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"deactivate" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function close() {
    setMode(null);
    setTyped("");
    setPassword("");
  }

  function confirm() {
    startTransition(async () => {
      const res =
        mode === "delete"
          ? await deleteAccountAction({ username: typed, password })
          : await deactivateAccountAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm">
          <span className="block font-medium">Désactiver mon compte</span>
          <span className="mt-0.5 block text-xs text-muted">
            Votre profil et vos textes deviennent invisibles. Reconnectez-vous pour tout réactiver.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setMode("deactivate")}
          className={`${secondaryButtonClass} shrink-0`}
        >
          Désactiver
        </button>
      </div>
      {!isSuperAdmin && (
        <div className="flex items-start justify-between gap-6">
          <p className="text-sm">
            <span className="block font-medium text-danger">Supprimer mon compte</span>
            <span className="mt-0.5 block text-xs text-muted">
              Vos données sont effacées définitivement après 30 jours.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setMode("delete")}
            className="tap shrink-0 rounded-full border border-danger/40 px-5 text-sm text-danger hover:bg-danger/10"
          >
            Supprimer
          </button>
        </div>
      )}
      <ConfirmDialog
        open={mode !== null}
        title={mode === "delete" ? "Supprimer votre compte ?" : "Désactiver votre compte ?"}
        confirmLabel={mode === "delete" ? "Supprimer mon compte" : "Désactiver"}
        pending={pending || (mode === "delete" && (typed !== username || !password))}
        onConfirm={confirm}
        onClose={close}
      >
        {mode === "delete" ? (
          <div className="space-y-3">
            <p>
              Votre profil et vos textes disparaissent immédiatement. Pour confirmer, saisissez votre pseudo{" "}
              <strong className="text-ink">{username}</strong> et votre mot de passe.
            </p>
            <input
              aria-label="Pseudo"
              value={typed}
              autoCapitalize="none"
              onChange={(e) => setTyped(e.target.value)}
              className={inputClass}
            />
            <input
              aria-label="Mot de passe"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        ) : (
          "Vous serez déconnecté. Votre profil et vos textes renverront une page introuvable jusqu'à votre prochaine connexion."
        )}
      </ConfirmDialog>
    </>
  );
}
