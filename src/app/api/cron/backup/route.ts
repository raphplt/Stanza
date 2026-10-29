import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { pruneExpired, runBackup } from "@/lib/backup-service";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const result = await runBackup();
  const pruned = await pruneExpired();
  return NextResponse.json({ backup: result, pruned }, { status: result.status === "success" ? 200 : 500 });
}
