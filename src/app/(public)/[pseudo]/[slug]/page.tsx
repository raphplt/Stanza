import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { JsonLd } from "@/components/reader/json-ld";
import { PostArticle } from "@/components/reader/post-article";
import { Reactions } from "@/components/reader/reactions";
import { ShareButton } from "@/components/reader/share-button";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";
import { formatFrenchDate, shouldShowModifiedDate } from "@/lib/dates";
import { getPublishedPost, getSampleParams, resolveRedirect } from "@/lib/public-data";
import { absoluteUrl } from "@/lib/site";

type Params = PageProps<"/[pseudo]/[slug]">["params"];

export async function generateStaticParams() {
  const rows = await getSampleParams();
  return rows.length > 0
    ? rows.map((r) => ({ pseudo: r.username, slug: r.slug }))
    : [{ pseudo: "__placeholder__", slug: "__placeholder__" }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { pseudo, slug } = await params;
  const data = await getPublishedPost(pseudo, slug);
  if (!data) return {};
  const { post, author } = data;
  const path = `/${author.username}/${post.slug}`;
  return {
    title: `${post.title} · ${author.name}`,
    description: post.excerpt,
    alternates: { canonical: path },
    authors: [{ name: author.name, url: absoluteUrl(`/${author.username}`) }],
    openGraph: {
      type: "article",
      url: path,
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.lastPublishedAt?.toISOString(),
      authors: [author.name],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function PostPage({ params }: PageProps<"/[pseudo]/[slug]">) {
  const { pseudo, slug } = await params;
  if (pseudo !== pseudo.toLowerCase()) permanentRedirect(`/${pseudo.toLowerCase()}/${slug}`);
  const data = await getPublishedPost(pseudo, slug);
  if (!data) {
    const target = await resolveRedirect([pseudo, slug]);
    if (target) permanentRedirect(target);
    notFound();
  }

  const { post, author, previous, next } = data;
  const path = `/${author.username}/${post.slug}`;
  const modified =
    post.lastPublishedAt && shouldShowModifiedDate(post.publishedAt, post.lastPublishedAt)
      ? { iso: post.lastPublishedAt.toISOString(), label: formatFrenchDate(post.lastPublishedAt) }
      : null;

  return (
    <>
      <div className="reading-progress fixed inset-x-0 top-0 z-40 h-0.5 bg-accent" aria-hidden="true" />
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer autoHideOnScroll />
      </Suspense>
      <main className="flex-1 pt-12 pb-24 sm:pt-20">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.publishedAt.toISOString(),
            dateModified: (post.lastPublishedAt ?? post.publishedAt).toISOString(),
            url: absoluteUrl(path),
            image: post.ogImageUrl ?? undefined,
            author: { "@type": "Person", name: author.name, url: absoluteUrl(`/${author.username}`) },
          }}
        />
        <PostArticle
          title={post.title}
          html={post.html}
          author={author}
          date={{ iso: post.publishedAt.toISOString(), label: formatFrenchDate(post.publishedAt) }}
          modified={modified}
          readingMinutes={post.readingMinutes}
        />
        <div className="mx-auto mt-16 w-full max-w-read px-5">
          {author.reactionsEnabled && (
            <div className="mb-10">
              <Reactions postId={post.id} />
            </div>
          )}
          <div className="flex items-center justify-between gap-4 border-t border-line pt-8">
            <Link
              href={`/${author.username}`}
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Tous les textes de {author.name}
            </Link>
            <ShareButton title={post.title} path={path} />
          </div>
          {(previous || next) && (
            <nav aria-label="Autres textes" className="mt-10 grid gap-4 sm:grid-cols-2">
              {previous && (
                <Link
                  href={`/${author.username}/${previous.slug}`}
                  className="rounded-xl border border-line p-4 transition-colors hover:bg-surface"
                >
                  <span className="block text-xs text-muted">Texte précédent</span>
                  <span className="mt-1 block font-serif text-lg leading-snug">{previous.title}</span>
                </Link>
              )}
              {next && (
                <Link
                  href={`/${author.username}/${next.slug}`}
                  className="rounded-xl border border-line p-4 text-right transition-colors hover:bg-surface sm:col-start-2"
                >
                  <span className="block text-xs text-muted">Texte suivant</span>
                  <span className="mt-1 block font-serif text-lg leading-snug">{next.title}</span>
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>
    </>
  );
}
