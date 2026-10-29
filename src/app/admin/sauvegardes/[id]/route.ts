import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { backup } from "@/db/schema";
import { readBackup } from "@/lib/backup-service";
import { getOptionalSession } from "@/lib/permissions";

export async function GET(_request: Request, { params }: RouteContext<"/admin/sauvegardes/[id]">) {
  const current = await getOptionalSession();
  if (current?.user.role !== "superadmin") return new Response("Non autorisé", { status: 403 });
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return new Response("Introuvable", { status: 404 });

  const row = await db.query.backup.findFirst({ where: eq(backup.id, parsed.data) });
  const body = row?.status === "success" ? await readBackup(row.blobPath) : null;
  if (!row || !body) return new Response("Introuvable", { status: 404 });

  const name = row.blobPath.split("/").pop() ?? "stanza-backup.json.gz";
  return new Response(body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
