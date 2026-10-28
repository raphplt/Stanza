"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { logoutAction } from "@/app/(auth)/actions";
import { createDraftPostAction } from "@/app/studio/actions";

export type HeaderUser = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  role: "author" | "superadmin";
};

export function SiteHeader({
  user,
  autoHideOnScroll = false,
  readOnlyMode = false,
}: {
  user: HeaderUser | null;
  autoHideOnScroll?: boolean;
  readOnlyMode?: boolean;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoHideOnScroll) return;
    let lastY = window.scrollY;
    function onScroll() {
      const currentY = window.scrollY;
      if (currentY > 120 && currentY > lastY + 8) {
        setHidden(true);
        setMenuOpen(false);
      } else if (currentY < lastY - 8 || currentY <= 60) {
        setHidden(false);
      }
      lastY = currentY;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHideOnScroll]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleNewDraft() {
    startTransition(async () => {
      const res = await createDraftPostAction();
      if (res.ok) {
        router.push(`/studio/ecrire/${res.postId}`);
      }
    });
  }

  function handleLogout() {
    setMenuOpen(false);
    startTransition(async () => {
      await logoutAction();
      router.push("/");
    });
  }

  return (
    <>
      {readOnlyMode && (
        <div className="border-b border-line bg-surface px-4 py-2 text-center text-xs text-muted">
          Mode lecture seule activé (maintenance en cours). Les modifications sont temporairement suspendues.
        </div>
      )}
      <header
        className={`sticky top-0 z-30 border-b border-line/70 bg-paper/95 backdrop-blur transition-transform duration-200 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-serif text-xl font-medium tracking-tight text-ink">
            Stanza
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={handleNewDraft}
                  disabled={isPending || readOnlyMode}
                  className="tap inline-flex items-center rounded-full bg-ink px-4 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  Écrire
                </button>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    aria-label="Menu du compte"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                    className="tap flex items-center justify-center rounded-full p-1"
                  >
                    {user.image ? (
                      <Image
                        src={user.image}
                        alt={user.name}
                        width={32}
                        height={32}
                        className="size-8 rounded-full border border-line object-cover"
                      />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface font-serif text-sm font-medium text-ink">
                        {user.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-paper py-1.5 shadow-sm"
                    >
                      <div className="border-b border-line px-3.5 py-2">
                        <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                        <p className="truncate text-xs text-muted">@{user.username}</p>
                      </div>
                      <Link
                        href={`/${user.username}`}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center px-3.5 py-2 text-sm text-ink hover:bg-surface"
                      >
                        Mon profil
                      </Link>
                      <Link
                        href="/studio"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center px-3.5 py-2 text-sm text-ink hover:bg-surface"
                      >
                        Studio
                      </Link>
                      <Link
                        href="/studio/profil"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center px-3.5 py-2 text-sm text-ink hover:bg-surface"
                      >
                        Modifier le profil
                      </Link>
                      <Link
                        href="/studio/compte"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center px-3.5 py-2 text-sm text-ink hover:bg-surface"
                      >
                        Compte
                      </Link>
                      {user.role === "superadmin" && (
                        <Link
                          href="/admin"
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center border-t border-line px-3.5 py-2 text-sm text-ink hover:bg-surface"
                        >
                          Admin
                        </Link>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center border-t border-line px-3.5 py-2 text-left text-sm text-danger hover:bg-surface"
                      >
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/connexion"
                className="tap inline-flex items-center rounded-full border border-line px-4 text-sm text-ink transition-colors hover:bg-surface"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
