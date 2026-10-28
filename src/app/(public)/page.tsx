import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-read flex-1 flex-col justify-center px-6 py-24">
      <h1 className="font-serif text-5xl font-medium tracking-tight">Stanza</h1>
      <p className="mt-4 font-serif text-xl text-muted">Des textes, rien que des textes.</p>
      <div className="mt-10 flex gap-3">
        <Link
          href="/connexion"
          className="tap inline-flex items-center rounded-full bg-ink px-5 text-sm text-paper"
        >
          Se connecter
        </Link>
      </div>
    </main>
  );
}
