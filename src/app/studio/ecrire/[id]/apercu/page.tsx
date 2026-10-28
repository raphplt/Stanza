import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PostArticle } from "@/components/reader/post-article";
import { formatFrenchDate } from "@/lib/dates";
import { requireUser } from "@/lib/permissions";
import { computeReadingStats, renderProseMirrorToHtml } from "@/lib/render";
import { getOwnedPostOrNotFound } from "@/lib/studio-posts";

export const metadata: Metadata = {
  title: "Aperçu",
  robots: { index: false, follow: false },
};

export default function PreviewPage({ params }: PageProps<"/studio/ecrire/[id]/apercu">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <PreviewLoader params={params} />
    </Suspense>
  );
}

async function PreviewLoader({ params }: Pick<PageProps<"/studio/ecrire/[id]/apercu">, "params">) {
  const { id } = await params;
  const { user } = await requireUser();
  const row = await getOwnedPostOrNotFound(id, user.id);
  const date = row.publishedAt ?? new Date();

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 py-2.5 text-sm backdrop-blur">
        <div className="mx-auto flex max-w-read items-center justify-between gap-4">
          <p className="text-muted">Aperçu de la version de travail</p>
          <Link href={`/studio/ecrire/${row.id}`} className="shrink-0 underline underline-offset-4">
            Retour à l'éditeur
          </Link>
        </div>
      </div>
      <main className="flex-1 pt-12 pb-24 sm:pt-20">
        <PostArticle
          title={row.title}
          html={renderProseMirrorToHtml(row.content, { frenchTypography: user.frenchTypography })}
          author={{ name: user.name, username: user.username, image: user.image }}
          date={{ iso: date.toISOString(), label: formatFrenchDate(date) }}
          readingMinutes={computeReadingStats(row.title, row.content).readingMinutes}
        />
      </main>
    </>
  );
}
