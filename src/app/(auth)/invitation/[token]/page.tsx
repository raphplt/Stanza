import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { invitation } from "@/db/schema";
import { sha256Hex } from "@/lib/id";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = {
  title: "Invitation",
};

async function InvitationContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = sha256Hex(token.trim());
  const inv = await db.query.invitation.findFirst({
    where: eq(invitation.tokenHash, tokenHash),
  });

  if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt <= new Date()) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface/50 p-6">
        <p className="font-serif text-xl font-medium">Invitation invalide ou expirée</p>
        <p className="mt-2 text-sm text-muted">
          Ce lien d'invitation a déjà été utilisé, a expiré ou a été révoqué par l'administrateur.
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

  return <InvitationForm token={token} defaultEmail={inv.email} />;
}

export default function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Bienvenue sur Stanza</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Vous avez été invité à rejoindre Stanza. Choisissez votre nom et votre pseudo d'auteur.
      </p>
      <Suspense fallback={<div className="mt-8 h-80 rounded-lg bg-surface/60" />}>
        <InvitationContent params={params} />
      </Suspense>
    </div>
  );
}
