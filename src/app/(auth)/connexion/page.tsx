import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function ConnexionPage() {
  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Se connecter</h1>
      <p className="mt-2 text-sm text-muted">Accédez à votre studio d'écriture sur Stanza.</p>
      <Suspense fallback={<div className="mt-8 h-64 rounded-lg bg-surface/60" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
