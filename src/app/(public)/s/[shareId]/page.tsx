import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ArticleSkeleton } from "@/components/reader/article-skeleton";
import { PostArticle } from "@/components/reader/post-article";
import { ShareButton } from "@/components/reader/share-button";
import { SiteHeaderFallback, SiteHeaderServer } from "@/components/ui/site-header-server";
import { formatFrenchDate } from "@/lib/dates";
import { getUnlistedPost } from "@/lib/public-data";

type Params = PageProps<"/s/[shareId]">["params"];

export async function generateStaticParams() {
  return [{ shareId: "__placeholder__" }];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { shareId } = await params;
  const row = await getUnlistedPost(shareId);
  return {
    title: row ? (row.title ?? "Sans titre") : undefined,
    description: row?.excerpt ?? undefined,
    robots: { index: false, follow: false },
    openGraph: row?.ogImageUrl ? { images: [row.ogImageUrl] } : undefined,
  };
}

export default function UnlistedPostPage({ params }: PageProps<"/s/[shareId]">) {
  return (
    <>
      <div className="reading-progress fixed inset-x-0 top-0 z-40 h-0.5 bg-accent" aria-hidden="true" />
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer autoHideOnScroll />
      </Suspense>
      <main className="flex-1 pt-12 pb-24 sm:pt-20">
        <Suspense fallback={<ArticleSkeleton />}>
          <UnlistedContent params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function UnlistedContent({ params }: { params: Params }) {
  const { shareId } = await params;
  const row = await getUnlistedPost(shareId);
  if (!row) notFound();
  if (row.status === "published") permanentRedirect(`/${row.author.username}/${row.slug}`);

  return (
    <>
      <PostArticle
        title={row.title ?? ""}
        html={row.html ?? ""}
        author={row.author}
        date={
          row.publishedAt
            ? { iso: row.publishedAt.toISOString(), label: formatFrenchDate(row.publishedAt) }
            : null
        }
        readingMinutes={row.readingMinutes}
      />
      <div className="mx-auto mt-16 flex w-full max-w-read justify-end border-t border-line px-5 pt-8">
        <ShareButton title={row.title ?? ""} path={`/s/${shareId}`} />
      </div>
    </>
  );
}
