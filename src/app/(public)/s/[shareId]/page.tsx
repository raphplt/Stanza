import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { PostArticle } from "@/components/reader/post-article";
import { Reactions } from "@/components/reader/reactions";
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

export default async function UnlistedPostPage({ params }: PageProps<"/s/[shareId]">) {
  const { shareId } = await params;
  const row = await getUnlistedPost(shareId);
  if (!row) notFound();
  if (row.status === "published") permanentRedirect(`/${row.author.username}/${row.slug}`);

  return (
    <>
      <div className="reading-progress fixed inset-x-0 top-0 z-40 h-0.5 bg-accent" aria-hidden="true" />
      <Suspense fallback={<SiteHeaderFallback />}>
        <SiteHeaderServer autoHideOnScroll />
      </Suspense>
      <main className="flex-1 pt-12 pb-24 sm:pt-20">
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
        <div className="mx-auto mt-16 w-full max-w-read px-5">
          {row.author.reactionsEnabled && (
            <div className="mb-10">
              <Reactions postId={row.id} />
            </div>
          )}
          <div className="flex justify-end border-t border-line pt-8">
            <ShareButton title={row.title ?? ""} path={`/s/${shareId}`} />
          </div>
        </div>
      </main>
    </>
  );
}
