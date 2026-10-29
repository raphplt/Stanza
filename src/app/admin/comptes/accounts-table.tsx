"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { copyAbsoluteLink } from "@/lib/clipboard";
import {
  createResetLinkAction,
  deleteUserAction,
  reactivateUserAction,
  restoreUserAction,
  revokeUserSessionsAction,
  suspendUserAction,
} from "../actions";
import { Badge, TableShell, tdClass, thClass } from "../ui";

export type AccountState = "active" | "deactivated" | "suspended" | "deleted";

export type AccountRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  image: string | null;
  isSelf: boolean;
  isSuperAdmin: boolean;
  state: AccountState;
  posts: number;
  lastSeen: string;
  createdAt: string;
};

const STATES: Record<AccountState, { label: string; tone: "accent" | "muted" | "danger" }> = {
  active: { label: "Actif", tone: "accent" },
  deactivated: { label: "Désactivé", tone: "muted" },
  suspended: { label: "Suspendu", tone: "danger" },
  deleted: { label: "Supprimé", tone: "danger" },
};

export function AccountsTable({ accounts }: { accounts: AccountRow[] }) {
  const [rows, setRows] = useState(accounts);
  const [confirm, setConfirm] = useState<{ row: AccountRow; kind: "suspend" | "delete" } | null>(null);
  const [pending, setPending] = useState(false);

  async function act(
    row: AccountRow,
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    next: Partial<AccountRow>,
    message: string,
  ) {
    setPending(true);
    const res = await action();
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...next } : r)));
    toast(message);
    return true;
  }

  async function resetLink(row: AccountRow) {
    const res = await createResetLinkAction(row.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    await copyAbsoluteLink(res.path, "Lien de réinitialisation copié (valable 24 h)");
  }

  async function revokeSessions(row: AccountRow) {
    const res = await revokeUserSessionsAction(row.id);
    if (res.ok) toast(res.count > 0 ? `${res.count} session(s) révoquée(s)` : "Aucune session active");
    else toast.error(res.error);
  }

  function items(row: AccountRow): MenuItem[] {
    const list: MenuItem[] = [];
    if (row.state !== "deleted") {
      list.push({ label: "Voir le profil", onSelect: () => window.open(`/${row.username}`, "_blank") });
    }
    list.push({ label: "Lien de réinitialisation", onSelect: () => resetLink(row) });
    list.push({ label: "Révoquer les sessions", onSelect: () => revokeSessions(row) });
    if (row.isSelf) return list;
    if (row.state === "suspended") {
      list.push({
        label: "Réactiver",
        onSelect: () => act(row, () => reactivateUserAction(row.id), { state: "active" }, "Compte réactivé"),
      });
    } else if (row.state !== "deleted") {
      list.push({ label: "Suspendre", onSelect: () => setConfirm({ row, kind: "suspend" }) });
    }
    if (row.state === "deleted") {
      list.push({
        label: "Restaurer",
        onSelect: () => act(row, () => restoreUserAction(row.id), { state: "active" }, "Compte restauré"),
      });
    } else {
      list.push({ label: "Supprimer", danger: true, onSelect: () => setConfirm({ row, kind: "delete" }) });
    }
    return list;
  }

  async function confirmAction() {
    if (!confirm) return;
    const { row, kind } = confirm;
    const ok =
      kind === "suspend"
        ? await act(row, () => suspendUserAction(row.id), { state: "suspended" }, "Compte suspendu")
        : await act(row, () => deleteUserAction(row.id), { state: "deleted" }, "Compte supprimé");
    if (ok) setConfirm(null);
  }

  return (
    <>
      <TableShell>
        <thead>
          <tr>
            <th className={thClass}>Auteur</th>
            <th className={thClass}>Email</th>
            <th className={thClass}>Statut</th>
            <th className={`${thClass} text-right`}>Textes</th>
            <th className={thClass}>Dernière connexion</th>
            <th className={thClass}>Création</th>
            <th className={thClass}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className={tdClass}>
                <div className="flex items-center gap-3">
                  {row.image ? (
                    <Image
                      src={row.image}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 rounded-full border border-line object-cover"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full border border-line bg-surface font-serif">
                      {row.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span>
                    <span className="block font-medium">
                      {row.name}
                      {row.isSuperAdmin && <span className="ml-2 text-xs text-muted">admin</span>}
                    </span>
                    <span className="block text-xs text-muted">@{row.username}</span>
                  </span>
                </div>
              </td>
              <td className={`${tdClass} text-muted`}>{row.email}</td>
              <td className={tdClass}>
                <Badge tone={STATES[row.state].tone}>{STATES[row.state].label}</Badge>
              </td>
              <td className={`${tdClass} text-right tabular-nums`}>{row.posts}</td>
              <td className={`${tdClass} text-muted`}>{row.lastSeen}</td>
              <td className={`${tdClass} text-muted`}>{row.createdAt}</td>
              <td className={`${tdClass} text-right`}>
                <Menu label={`Actions pour ${row.name}`} items={items(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === "delete" ? "Supprimer ce compte ?" : "Suspendre ce compte ?"}
        confirmLabel={confirm?.kind === "delete" ? "Supprimer" : "Suspendre"}
        pending={pending}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      >
        {confirm?.kind === "delete"
          ? `Le profil et les textes de ${confirm.row.name} passent en 404. Le compte reste restaurable pendant 30 jours, puis il est purgé.`
          : `${confirm?.row.name} ne pourra plus se connecter et son contenu public passera en 404, jusqu'à réactivation.`}
      </ConfirmDialog>
    </>
  );
}
