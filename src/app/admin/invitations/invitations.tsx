"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { inputClass, primaryButtonClass } from "@/components/ui/field";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { copyAbsoluteLink } from "@/lib/clipboard";
import { createInvitationAction, revokeInvitationAction } from "../actions";
import { Badge, EmptyState, TableShell, tdClass, thClass } from "../ui";

export type InvitationRow = {
  id: string;
  email: string | null;
  note: string | null;
  state: "pending" | "used" | "expired" | "revoked";
  usedBy: string | null;
  createdAt: string;
  expiresAt: string;
  path: string | null;
};

const STATES = {
  pending: { label: "En attente", tone: "accent" },
  used: { label: "Utilisée", tone: "ink" },
  expired: { label: "Expirée", tone: "muted" },
  revoked: { label: "Révoquée", tone: "danger" },
} as const;

export function Invitations({ initial }: { initial: InvitationRow[] }) {
  const [rows, setRows] = useState(initial);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(7);
  const [pending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createInvitationAction({ email, note, days });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((list) => [
        {
          id: res.id,
          email: email || null,
          note: note || null,
          state: "pending",
          usedBy: null,
          createdAt: "À l'instant",
          expiresAt: `Dans ${days} jour${days > 1 ? "s" : ""}`,
          path: res.path,
        },
        ...list,
      ]);
      setEmail("");
      setNote("");
      await copyAbsoluteLink(res.path, "Invitation créée, lien copié");
    });
  }

  async function revoke(row: InvitationRow) {
    const res = await revokeInvitationAction(row.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, state: "revoked", path: null } : r)));
    toast("Invitation révoquée");
  }

  function items(row: InvitationRow): MenuItem[] {
    const path = row.path;
    if (row.state !== "pending" || !path) return [];
    return [
      { label: "Copier le lien", onSelect: () => copyAbsoluteLink(path) },
      { label: "Révoquer", danger: true, onSelect: () => revoke(row) },
    ];
  }

  return (
    <>
      <form
        onSubmit={create}
        className="mb-8 grid gap-3 rounded-xl border border-line p-5 sm:grid-cols-[1fr_1fr_auto_auto]"
      >
        <input
          type="email"
          aria-label="Email (optionnel)"
          placeholder="Email (optionnel)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Note (optionnelle)"
          placeholder="Note, ex. : Camille, rencontrée à l'atelier"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
        <select
          aria-label="Durée de validité"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="tap rounded-lg border border-line bg-paper px-3 text-sm"
        >
          {[1, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {d} jour{d > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          Créer et copier
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState>Aucune invitation pour l'instant.</EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th className={thClass}>Destinataire</th>
              <th className={thClass}>Statut</th>
              <th className={thClass}>Création</th>
              <th className={thClass}>Expiration</th>
              <th className={thClass}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={tdClass}>
                  <span className="block">{row.email ?? <span className="text-muted">Sans email</span>}</span>
                  {row.note && <span className="block text-xs text-muted">{row.note}</span>}
                </td>
                <td className={tdClass}>
                  <Badge tone={STATES[row.state].tone}>{STATES[row.state].label}</Badge>
                  {row.usedBy && <span className="ml-2 text-xs text-muted">@{row.usedBy}</span>}
                </td>
                <td className={`${tdClass} text-muted`}>{row.createdAt}</td>
                <td className={`${tdClass} text-muted`}>{row.expiresAt}</td>
                <td className={`${tdClass} text-right`}>
                  {row.state === "pending" && <Menu label="Actions" items={items(row)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
