"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/comptes", label: "Comptes" },
  { href: "/admin/textes", label: "Textes" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/demandes", label: "Demandes" },
  { href: "/admin/reglages", label: "Réglages" },
  { href: "/admin/sauvegardes", label: "Sauvegardes" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Administration"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-1 border-b border-line">
        {LINKS.map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`tap -mb-px flex items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors ${
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
