import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EditorScreen } from "@/components/editor/editor-screen";
import { requireUser } from "@/lib/permissions";
import { sanitizeProseMirrorJson } from "@/lib/render";
import { getOwnedPostOrNotFound } from "@/lib/studio-posts";

export const metadata: Metadata = {
  title: "Écrire",
  robots: { index: false, follow: false },
};

export default function WritePage({ params }: PageProps<"/studio/ecrire/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <WriteLoader params={params} />
    </Suspense>
  );
}

async function WriteLoader({ params }: Pick<PageProps<"/studio/ecrire/[id]">, "params">) {
  const { id } = await params;
  const { user } = await requireUser();
  const row = await getOwnedPostOrNotFound(id, user.id);

  if (row.deletedAt) {
    return (
      <main className="mx-auto flex w-full max-w-read flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="font-serif text-3xl font-medium tracking-tight">Ce texte est dans la corbeille</h1>
        <p className="mt-3 text-muted">Restaurez-le depuis la corbeille du studio pour le modifier.</p>
        <Link
          href="/studio?onglet=corbeille"
          className="tap mt-8 inline-flex items-center rounded-full border border-line px-5 text-sm hover:bg-surface"
        >
          Ouvrir la corbeille
        </Link>
      </main>
    );
  }

  return (
    <EditorScreen
      key={row.id}
      username={user.username}
      post={{
        id: row.id,
        title: row.title,
        content: sanitizeProseMirrorJson(row.content),
        version: row.version,
        updatedAt: row.updatedAt.toISOString(),
        status: row.status,
        slug: row.slug,
        shareId: row.shareId,
        hasUnpublishedChanges: row.hasUnpublishedChanges,
      }}
    />
  );
}
