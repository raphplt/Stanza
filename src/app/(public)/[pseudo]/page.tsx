import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/reader/json-ld";
import { PostCard } from "@/components/reader/post-card";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";
import {
  getAuthorPosts,
  getPublicProfile,
  getSampleParams,
  parseSort,
  resolveRedirect,
  toPostCardData,
} from "@/lib/public-data";
import { absoluteUrl } from "@/lib/site";
import { ClearSearchButton, MorePosts, ProfileControls } from "./profile-controls";

export const instant = false;

type Props = PageProps<"/[pseudo]">;

export async function generateStaticParams() {
  const rows = await getSampleParams();
  const usernames = [...new Set(rows.map((r) => r.username))];
  return usernames.length > 0 ? usernames.map((pseudo) => ({ pseudo })) : [{ pseudo: "__placeholder__" }];
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { pseudo } = await params;
  const profile = await getPublicProfile(pseudo);
  if (!profile) return {};
  const { author } = profile;
  const description = author.bio || `Les textes de ${author.name} sur Stanza.`;
  return {
    title: `${author.name} (@${author.username})`,
    description,
    alternates: {
      canonical: `/${author.username}`,
      types: { "application/rss+xml": [{ url: `/${author.username}/rss.xml`, title: author.name }] },
    },
    openGraph: {
      type: "profile",
      url: `/${author.username}`,
      title: author.name,
      description,
    },
  };
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function Bio({ text }: { text: string }) {
  return (
    <p className="mt-4 font-serif text-lg whitespace-pre-line text-ink/90">
      {text.split(URL_PATTERN).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            // biome-ignore lint/suspicious/noArrayIndexKey: static split of a short bio
            key={i}
            href={part}
            rel="noopener noreferrer nofollow"
            target="_blank"
            className="underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            {part.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { pseudo } = await params;
  if (pseudo !== pseudo.toLowerCase()) permanentRedirect(`/${pseudo.toLowerCase()}`);
  const profile = await getPublicProfile(pseudo);
  if (!profile) {
    const target = await resolveRedirect([pseudo]);
    if (target) permanentRedirect(target);
    notFound();
  }

  const { author, total } = profile;
  const links = author.links.filter((l) => /^https?:\/\//.test(l.url));

  return (
    <>
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer />
      </Suspense>
      <main className="mx-auto w-full max-w-read flex-1 px-5 pt-12 pb-24 sm:pt-20">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url: absoluteUrl(`/${author.username}`),
            mainEntity: {
              "@type": "Person",
              name: author.name,
              alternateName: `@${author.username}`,
              description: author.bio || undefined,
              image: author.image ?? undefined,
              sameAs: links.map((l) => l.url),
            },
          }}
        />
        <header>
          {author.image ? (
            <Image
              src={author.image}
              alt=""
              width={96}
              height={96}
              priority
              className="size-24 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex size-24 items-center justify-center rounded-full border border-line bg-surface font-serif text-4xl">
              {author.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <h1 className="mt-6 font-serif text-4xl font-medium tracking-tight">{author.name}</h1>
          <p className="mt-1 text-sm text-muted">
            @{author.username} · {total} texte{total > 1 ? "s" : ""}
          </p>
          {author.bio && <Bio text={author.bio} />}
          {links.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    rel="noopener noreferrer me"
                    target="_blank"
                    className="underline decoration-line underline-offset-4 hover:decoration-accent"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </header>

        {total === 0 ? (
          <p className="mt-16 text-center text-muted">
            <span className="block font-serif text-3xl" aria-hidden="true">
              ⁂
            </span>
            <span className="mt-4 block">{author.name} n'a encore rien publié.</span>
          </p>
        ) : (
          <ProfileBody profile={profile} searchParams={searchParams} />
        )}
      </main>
    </>
  );
}

async function ProfileBody({
  profile,
  searchParams,
}: {
  profile: NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;
  searchParams: Props["searchParams"];
}) {
  const { author, pinned } = profile;
  const search = await searchParams;
  const query = typeof search?.q === "string" ? search.q : "";
  const sort = parseSort(search?.tri);
  const page = await getAuthorPosts(author.id, query, sort, null);

  return (
    <>
      {pinned.length > 0 && !query && (
        <section aria-labelledby="pinned" className="mt-14">
          <p id="pinned" className="text-xs font-medium tracking-wide text-muted uppercase">
            Épinglés
          </p>
          <ul className="divide-y divide-line">
            {pinned.map((p) => (
              <li key={p.id}>
                <PostCard post={toPostCardData(p, author.username)} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="Textes" className="mt-14">
        <ProfileControls query={query} sort={sort}>
          {page.posts.length === 0 ? (
            <div className="mt-12 text-center text-sm text-muted">
              <p>Aucun texte ne correspond à « {query} ».</p>
              <ClearSearchButton />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {page.posts.map((p) => (
                <li key={p.id}>
                  <PostCard post={toPostCardData(p, author.username)} />
                </li>
              ))}
              <MorePosts
                key={`${query}|${sort}`}
                username={author.username}
                query={query}
                sort={sort}
                cursor={page.nextCursor}
              />
            </ul>
          )}
        </ProfileControls>
      </section>
    </>
  );
}
