import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-read flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-serif text-5xl text-muted" aria-hidden="true">
        ⁂
      </p>
      <h1 className="mt-6 font-serif text-3xl font-medium tracking-tight">Page introuvable</h1>
      <p className="mt-3 max-w-sm text-muted">
        Ce texte n'existe pas, n'existe plus, ou n'a jamais été écrit.
      </p>
      <Link
        href="/"
        className="tap mt-8 inline-flex items-center rounded-full border border-line px-5 text-sm transition-colors hover:bg-surface"
      >
        Retour à l'accueil
      </Link>
    </main>
  );
}
