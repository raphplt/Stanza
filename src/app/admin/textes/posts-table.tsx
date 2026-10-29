"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { hidePostAsAdminAction, unpublishPostAsAdminAction } from "../actions";
import { Badge, EmptyState, TableShell, tdClass, thClass } from "../ui";

type AdminPost = {
  id: string;
  title: string;
  href: string;
  status: "published" | "unlisted";
  author: string;
  date: string;
};

export function PostsTable({
  posts,
  authors,
  authorFilter,
}: {
  posts: AdminPost[];
  authors: { username: string; name: string }[];
  authorFilter: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(posts);
  const [filtering, startFiltering] = useTransition();

  async function unpublish(p: AdminPost) {
    const res = await unpublishPostAsAdminAction(p.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows((list) => list.filter((r) => r.id !== p.id));
    toast("Texte dépublié, il retourne dans les brouillons de l'auteur");
  }

  async function hide(p: AdminPost) {
    const res = await hidePostAsAdminAction(p.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows((list) => list.map((r) => (r.id === p.id ? { ...r, status: "unlisted" } : r)));
    toast("Texte retiré du profil et de l'index");
  }

  function items(p: AdminPost): MenuItem[] {
    const list: MenuItem[] = [{ label: "Ouvrir", onSelect: () => window.open(p.href, "_blank") }];
    if (p.status === "published") list.push({ label: "Masquer (non listé)", onSelect: () => hide(p) });
    list.push({ label: "Dépublier", danger: true, onSelect: () => unpublish(p) });
    return list;
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="author-filter" className="text-sm text-muted">
          Auteur
        </label>
        <select
          id="author-filter"
          value={authorFilter}
          disabled={filtering}
          onChange={(e) =>
            startFiltering(() =>
              router.replace(e.target.value ? `?auteur=${encodeURIComponent(e.target.value)}` : "?"),
            )
          }
          className="tap rounded-lg border border-line bg-paper px-3 text-sm"
        >
          <option value="">Tous</option>
          {authors.map((a) => (
            <option key={a.username} value={a.username}>
              {a.name} (@{a.username})
            </option>
          ))}
        </select>
      </div>
      {rows.length === 0 ? (
        <EmptyState>Aucun texte en ligne.</EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th className={thClass}>Titre</th>
              <th className={thClass}>Auteur</th>
              <th className={thClass}>Statut</th>
              <th className={thClass}>Publication</th>
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className={filtering ? "opacity-60" : undefined}>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={`${tdClass} font-serif text-base`}>
                  <a href={p.href} target="_blank" rel="noreferrer" className="hover:underline">
                    {p.title}
                  </a>
                </td>
                <td className={`${tdClass} text-muted`}>{p.author}</td>
                <td className={tdClass}>
                  <Badge tone={p.status === "published" ? "accent" : "muted"}>
                    {p.status === "published" ? "Publié" : "Non listé"}
                  </Badge>
                </td>
                <td className={`${tdClass} text-muted`}>{p.date}</td>
                <td className={`${tdClass} text-right`}>
                  <Menu label={`Actions pour ${p.title}`} items={items(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
