"use client";

import { useState } from "react";
import { toast } from "sonner";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/field";
import type { AccessRequestStatus } from "@/db/schema";
import { copyAbsoluteLink } from "@/lib/clipboard";
import { approveAccessRequestAction, setAccessRequestStatusAction } from "../actions";
import { Badge, EmptyState } from "../ui";

type Request = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: AccessRequestStatus;
  date: string;
};

const LABELS: Record<AccessRequestStatus, string> = {
  pending: "En attente",
  approved: "Acceptée",
  rejected: "Refusée",
  archived: "Archivée",
};

export function AccessRequests({ initial }: { initial: Request[] }) {
  const [rows, setRows] = useState(initial);
  const [showHandled, setShowHandled] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const visible = rows.filter((r) => (showHandled ? r.status !== "pending" : r.status === "pending"));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  function update(id: string, status: AccessRequestStatus) {
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function approve(r: Request) {
    setBusy(r.id);
    const res = await approveAccessRequestAction(r.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    update(r.id, "approved");
    await copyAbsoluteLink(res.path, `Invitation pour ${r.name} copiée`);
  }

  async function setStatus(r: Request, status: "rejected" | "archived") {
    setBusy(r.id);
    const res = await setAccessRequestStatusAction(r.id, status);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    update(r.id, status);
    toast(status === "rejected" ? "Demande refusée" : "Demande archivée");
  }

  return (
    <>
      <div className="mb-5 inline-flex rounded-full border border-line p-1 text-sm">
        {[
          { value: false, label: `En attente (${pendingCount})` },
          { value: true, label: "Traitées" },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-pressed={showHandled === tab.value}
            onClick={() => setShowHandled(tab.value)}
            className={`tap rounded-full px-4 transition-colors ${
              showHandled === tab.value ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState>{showHandled ? "Aucune demande traitée." : "Aucune demande en attente."}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="rounded-xl border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="font-medium">{r.name}</span>{" "}
                  <a href={`mailto:${r.email}`} className="text-sm text-muted hover:underline">
                    {r.email}
                  </a>
                </p>
                <span className="text-xs text-muted">{r.date}</span>
              </div>
              <p className="mt-3 font-serif text-lg whitespace-pre-line">{r.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {r.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => approve(r)}
                      className={primaryButtonClass}
                    >
                      Accepter et copier le lien
                    </button>
                    <button
                      type="button"
                      disabled={busy === r.id}
                      onClick={() => setStatus(r, "rejected")}
                      className={secondaryButtonClass}
                    >
                      Refuser
                    </button>
                  </>
                ) : (
                  <Badge tone={r.status === "approved" ? "accent" : "muted"}>{LABELS[r.status]}</Badge>
                )}
                {r.status !== "archived" && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => setStatus(r, "archived")}
                    className="tap rounded-full px-4 text-sm text-muted hover:bg-surface"
                  >
                    Archiver
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
