import { desc } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { backup } from "@/db/schema";
import { formatFrenchDateTime } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { PageTitle, TableSkeleton } from "../ui";
import { Backups } from "./backups";

export const metadata: Metadata = { title: "Sauvegardes" };

export default function BackupsPage() {
  return (
    <>
      <PageTitle
        title="Sauvegardes"
        description="Export quotidien automatique de toute la base, conservé 30 jours."
      />
      <Suspense fallback={<TableSkeleton />}>
        <BackupsLoader />
      </Suspense>
      <section className="mt-10 max-w-2xl rounded-xl border border-line p-5 text-sm">
        <h2 className="font-serif text-lg font-medium">Restaurer une sauvegarde</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-muted">
          <li>Téléchargez le fichier .json.gz voulu.</li>
          <li>
            Pointez <code className="text-ink">DATABASE_URL</code> vers la base cible (une branche Neon de
            test d'abord).
          </li>
          <li>
            Lancez <code className="text-ink">pnpm db:restore chemin/vers/fichier.json.gz</code>.
          </li>
          <li>
            La restauration remplace tout le contenu de la base : vérifiez avant de viser la production.
          </li>
        </ol>
      </section>
    </>
  );
}

async function BackupsLoader() {
  await requireSuperAdmin();
  const rows = await db.select().from(backup).orderBy(desc(backup.createdAt)).limit(60);
  return (
    <Backups
      initial={rows.map((r) => ({
        id: r.id,
        sizeBytes: r.sizeBytes,
        status: r.status,
        error: r.error,
        dateLabel: formatFrenchDateTime(r.createdAt),
      }))}
    />
  );
}
