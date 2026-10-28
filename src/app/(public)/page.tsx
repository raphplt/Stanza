import type { Metadata } from "next";
import Link from "next/link";
import { formatFrenchDate } from "@/lib/dates";
import { getLatestPosts, getSiteSettings } from "@/lib/public-data";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: { absolute: settings.siteName },
    description: settings.tagline,
    alternates: { canonical: "/" },
  };
}

export default async function Home() {
  const settings = await getSiteSettings();
  const latest = settings.showLatestPostsOnLanding ? await getLatestPosts(5) : [];

  return (
    <main className="mx-auto flex w-full max-w-read flex-1 flex-col justify-center px-6 py-24">
      <h1 className="font-serif text-5xl font-medium tracking-tight">{settings.siteName}</h1>
      <p className="mt-4 font-serif text-xl text-muted">{settings.tagline}</p>
      {settings.landingText && <p className="mt-6 max-w-prose text-ink/80">{settings.landingText}</p>}
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/connexion"
          className="tap inline-flex items-center rounded-full bg-ink px-5 text-sm text-paper transition-opacity hover:opacity-90"
        >
          Se connecter
        </Link>
        {settings.accessRequestsOpen && (
          <Link
            href="/demande-acces"
            className="tap inline-flex items-center rounded-full border border-line px-5 text-sm transition-colors hover:bg-surface"
          >
            Demander un accès
          </Link>
        )}
      </div>
      {latest.length > 0 && (
        <section aria-labelledby="latest" className="mt-20">
          <h2 id="latest" className="text-xs font-medium tracking-wide text-muted uppercase">
            Derniers textes
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {latest.map((p) => (
              <li key={p.id} className="py-4">
                <Link href={`/${p.username}/${p.slug}`} className="group block">
                  <span className="block font-serif text-xl group-hover:underline group-hover:underline-offset-4">
                    {p.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted">
                    {p.authorName} ·{" "}
                    <time dateTime={p.publishedAt.toISOString()}>{formatFrenchDate(p.publishedAt)}</time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
