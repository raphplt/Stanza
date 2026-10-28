"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { resetPasswordWithTokenAction } from "../../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface/50 p-6">
        <p className="font-serif text-xl font-medium">Mot de passe mis à jour</p>
        <p className="mt-2 text-sm text-muted">
          Votre nouveau mot de passe a été enregistré. Vous pouvez maintenant vous connecter.
        </p>
        <Link
          href="/connexion"
          className="tap mt-6 inline-flex items-center rounded-full bg-ink px-5 text-sm font-medium text-paper"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    startTransition(async () => {
      const res = await resetPasswordWithTokenAction({ token, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Nouveau mot de passe (12 caractères minimum)
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
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink focus:border-accent focus:outline-none"
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
        {isPending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
