import Link from "next/link";
import { getOptionalSession, isReadOnlyMode } from "@/lib/permissions";
import { SiteHeader } from "./site-header";

export async function SiteHeaderServer({ autoHideOnScroll = false }: { autoHideOnScroll?: boolean }) {
  const [session, readOnlyMode] = await Promise.all([getOptionalSession(), isReadOnlyMode()]);
  const user = session
    ? {
        id: session.user.id,
        name: session.user.name,
        username: session.user.username,
        image: session.user.image,
        role: session.user.role,
        theme: session.user.theme,
      }
    : null;
  return <SiteHeader user={user} autoHideOnScroll={autoHideOnScroll} readOnlyMode={readOnlyMode} />;
}

export function SiteHeaderFallback() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/95">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-4 sm:px-6">
        <Link href="/" className="font-serif text-xl font-medium tracking-tight text-ink">
          Stanza
        </Link>
      </div>
    </header>
  );
}
