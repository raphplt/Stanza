"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { loginWithPasswordAction } from "../actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await loginWithPasswordAction({ email, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const nextUrl = searchParams.get("retour");
      const destination = nextUrl?.startsWith("/") ? nextUrl : "/studio";
      router.push(destination);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
          placeholder="vous@exemple.fr"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-ink">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
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
        {isPending ? "Connexion…" : "Se connecter"}
      </button>

      <p className="pt-2 text-center text-sm text-muted">
        Pas encore de compte ?{" "}
        <Link href="/demande-acces" className="text-ink underline underline-offset-4">
          Demander un accès
        </Link>
      </p>
    </form>
  );
}
