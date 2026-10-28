import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db/client";
import { passwordReset } from "@/db/schema";
import { sha256Hex } from "@/lib/id";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe",
};

async function ResetPasswordContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = sha256Hex(token.trim());
  const row = await db.query.passwordReset.findFirst({
    where: eq(passwordReset.tokenHash, tokenHash),
  });

  if (!row || row.usedAt || row.expiresAt <= new Date()) {
    return (
      <div className="mt-8 rounded-xl border border-line bg-surface/50 p-6">
        <p className="font-serif text-xl font-medium">Lien invalide ou expiré</p>
        <p className="mt-2 text-sm text-muted">
          Ce lien de réinitialisation a expiré (24 heures) ou a déjà été utilisé. Demandez un nouveau lien à
          l'administrateur.
        </p>
        <Link
          href="/connexion"
          className="tap mt-6 inline-flex items-center rounded-full border border-line px-5 text-sm transition-colors hover:bg-surface"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}

export default function ReinitialiserPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-muted">Choisissez un nouveau mot de passe pour votre compte Stanza.</p>
      <Suspense fallback={<div className="mt-8 h-64 rounded-lg bg-surface/60" />}>
        <ResetPasswordContent params={params} />
      </Suspense>
    </div>
  );
}
