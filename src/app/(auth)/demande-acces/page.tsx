import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { siteSettings } from "@/db/schema";
import { AccessRequestForm } from "./access-request-form";

export const metadata: Metadata = {
  title: "Demander un accès",
};

async function AccessRequestContent() {
  const settings = await db.query.siteSettings.findFirst({
    where: eq(siteSettings.id, 1),
  });

  if (settings && !settings.accessRequestsOpen) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface/50 p-6">
        <p className="font-serif text-xl font-medium">Demandes d'accès fermées</p>
        <p className="mt-2 text-sm text-muted">
          Stanza n'accepte pas de nouvelles demandes d'accès pour le moment.
        </p>
        <Link
          href="/"
          className="tap mt-6 inline-flex items-center rounded-full border border-line px-5 text-sm transition-colors hover:bg-surface"
        >
          Retour à l'accueil
        </Link>
      </div>
    );
  }

  return <AccessRequestForm />;
}

export default function DemandeAccesPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Demander un accès</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Stanza est en bêta fermée. Présentez-vous en quelques lignes pour recevoir une invitation d'auteur.
      </p>
      <Suspense fallback={<div className="mt-8 h-72 rounded-lg bg-surface/60" />}>
        <AccessRequestContent />
      </Suspense>
    </div>
  );
}
