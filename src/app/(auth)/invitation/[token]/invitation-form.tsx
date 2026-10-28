"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { acceptInvitationAction, checkUsernameAvailabilityAction } from "../../actions";

export function InvitationForm({ token, defaultEmail }: { token: string; defaultEmail?: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [usernameHint, setUsernameHint] = useState<{
    available?: boolean;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameHint(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await checkUsernameAvailabilityAction(clean);
      setUsernameHint(res);
    }, 250);
    return () => clearTimeout(timer);
  }, [username]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await acceptInvitationAction({
        token,
        name,
        username,
        email,
        password,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/studio");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          Nom affiché
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="Camille Moreau"
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-ink">
          Pseudo (URL de votre profil)
        </label>
        <div className="mt-1.5 flex items-center rounded-lg border border-line bg-paper px-3.5 focus-within:border-accent">
          <span className="select-none text-sm text-muted">stanza/</span>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={3}
            maxLength={30}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="tap w-full bg-transparent py-2.5 pl-1 text-base text-ink placeholder:text-muted/60 focus:outline-none"
            placeholder="camille"
          />
        </div>
        {usernameHint && (
          <p className={`mt-1 text-xs ${usernameHint.available ? "text-muted" : "text-danger"}`}>
            {usernameHint.reason}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="camille@exemple.fr"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Mot de passe (12 caractères minimum)
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

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
        disabled={isPending}
        className="tap w-full rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Création du compte…" : "Créer mon compte d'auteur"}
      </button>
    </form>
  );
}
