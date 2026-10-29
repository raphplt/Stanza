import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/permissions";
import { ProfileEditor } from "./profile-editor";

export const metadata: Metadata = { title: "Profil" };

export default function ProfileSettingsPage() {
  return (
    <div className="mx-auto max-w-read">
      <h1 className="font-serif text-3xl font-medium tracking-tight">Profil</h1>
      <p className="mt-1 text-sm text-muted">Ce que voient vos lecteurs. Chaque champ s'enregistre seul.</p>
      <div className="mt-10">
        <Suspense fallback={<div className="h-96 rounded-xl bg-surface/60" aria-hidden="true" />}>
          <ProfileLoader />
        </Suspense>
      </div>
    </div>
  );
}

async function ProfileLoader() {
  const { user } = await requireUser();
  return (
    <ProfileEditor
      initial={{
        id: user.id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        image: user.image,
        links: user.links,
      }}
    />
  );
}
