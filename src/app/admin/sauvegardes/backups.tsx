"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { primaryButtonClass } from "@/components/ui/field";
import { runBackupNowAction } from "../actions";
import { Badge, EmptyState, TableShell, tdClass, thClass } from "../ui";

type BackupRow = {
  id: string;
  sizeBytes: number;
  status: "success" | "failed";
  error: string | null;
  dateLabel: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function Backups({ initial }: { initial: BackupRow[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, startTransition] = useTransition();

  function runNow() {
    startTransition(async () => {
      const res = await runBackupNowAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows((list) => [res.backup, ...list]);
      toast("Sauvegarde terminée");
    });
  }

  return (
    <>
      <div className="mb-5">
        <button type="button" onClick={runNow} disabled={pending} className={primaryButtonClass}>
          {pending ? "Sauvegarde en cours…" : "Lancer une sauvegarde"}
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState>
          Aucune sauvegarde. La première sera créée cette nuit, ou lancez-la maintenant.
        </EmptyState>
      ) : (
        <TableShell>
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>Statut</th>
              <th className={`${thClass} text-right`}>Taille</th>
              <th className={thClass}>
                <span className="sr-only">Télécharger</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td className={tdClass}>{b.dateLabel}</td>
                <td className={tdClass}>
                  <Badge tone={b.status === "success" ? "accent" : "danger"}>
                    {b.status === "success" ? "Réussie" : "Échec"}
                  </Badge>
                  {b.error && <span className="mt-1 block text-xs text-danger">{b.error}</span>}
                </td>
                <td className={`${tdClass} text-right text-muted tabular-nums`}>
                  {b.status === "success" ? formatSize(b.sizeBytes) : "—"}
                </td>
                <td className={`${tdClass} text-right`}>
                  {b.status === "success" && (
                    <a
                      href={`/admin/sauvegardes/${b.id}`}
                      download
                      className="text-sm underline-offset-4 hover:underline"
                    >
                      Télécharger
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
