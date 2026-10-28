"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { submitAccessRequestAction } from "../actions";

export function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  if (submitted) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface/50 p-6">
        <p className="font-serif text-xl font-medium">Demande enregistrée</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Merci {name}. Votre demande a été transmise à l'éditeur. Si elle est retenue, vous recevrez un lien
          d'invitation personnel.
        </p>
        <Link
          href="/"
          className="tap mt-6 inline-flex items-center rounded-full border border-line px-5 text-sm transition-colors hover:bg-surface"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await submitAccessRequestAction({
        name,
        email,
        message,
        website,
        startedAt: startedAt || Date.now() - 2000,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSubmitted(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Site web</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-ink">
          Votre nom
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="Camille Moreau"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-ink">
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="tap mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="camille@exemple.fr"
        />
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="message" className="block text-sm font-medium text-ink">
            Quelques mots sur vos textes
          </label>
          <span className="text-xs text-muted">{message.length}/600</span>
        </div>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          minLength={10}
          maxLength={600}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
          placeholder="Ce que vous écrivez, pourquoi Stanza vous intéresse…"
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
        {isPending ? "Envoi…" : "Envoyer ma demande"}
      </button>

      <p className="pt-2 text-center text-sm text-muted">
        Déjà invité ?{" "}
        <Link href="/connexion" className="text-ink underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
