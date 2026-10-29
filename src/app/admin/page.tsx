import { and, count, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { accessRequest, backup, post, user } from "@/db/schema";
import { formatFrenchDateTime } from "@/lib/dates";
import { requireSuperAdmin } from "@/lib/permissions";
import { Badge, PageTitle } from "./ui";

export default function AdminOverviewPage() {
  return (
    <>
      <PageTitle title="Vue d'ensemble" />
      <Suspense fallback={<div className="h-40 rounded-xl bg-surface/60" aria-hidden="true" />}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  await requireSuperAdmin();
  const [[authors], [published], [pending], [last]] = await Promise.all([
    db
      .select({ total: count() })
      .from(user)
      .where(and(eq(user.status, "active"), eq(user.banned, false), isNull(user.deletedAt))),
    db
      .select({ total: count() })
      .from(post)
      .where(and(eq(post.status, "published"), isNull(post.deletedAt))),
    db.select({ total: count() }).from(accessRequest).where(eq(accessRequest.status, "pending")),
    db.select().from(backup).orderBy(desc(backup.createdAt)).limit(1),
  ]);

  const stats = [
    { label: "Auteurs actifs", value: authors.total, href: "/admin/comptes" },
    { label: "Textes publiés", value: published.total, href: "/admin/textes" },
    { label: "Demandes en attente", value: pending.total, href: "/admin/demandes" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-line p-5 transition-colors hover:bg-surface"
          >
            <span className="block font-serif text-4xl font-medium tabular-nums">{s.value}</span>
            <span className="mt-1 block text-sm text-muted">{s.label}</span>
          </Link>
        ))}
      </div>
      <Link
        href="/admin/sauvegardes"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-5 transition-colors hover:bg-surface"
      >
        <span>
          <span className="block text-sm font-medium">Dernière sauvegarde</span>
          <span className="mt-1 block text-sm text-muted">
            {last ? formatFrenchDateTime(last.createdAt) : "Aucune sauvegarde pour l'instant"}
          </span>
        </span>
        {last && (
          <Badge tone={last.status === "success" ? "accent" : "danger"}>
            {last.status === "success" ? "Réussie" : "Échec"}
          </Badge>
        )}
      </Link>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          href="/admin/invitations"
          className="tap inline-flex items-center rounded-full bg-ink px-5 text-sm font-medium text-paper hover:opacity-90"
        >
          Inviter un auteur
        </Link>
        <Link
          href="/admin/reglages"
          className="tap inline-flex items-center rounded-full border border-line px-5 text-sm hover:bg-surface"
        >
          Réglages du site
        </Link>
      </div>
    </div>
  );
}
