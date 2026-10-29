import fs from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { exportDatabaseGzip } from "@/db/backup";
import { db } from "@/db/client";
import { backup, post, session, user, verification } from "@/db/schema";
import { uuidv7 } from "@/lib/id";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_DIR = path.join(process.cwd(), ".local-blobs");
const hasBlobToken = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function runBackup() {
  const id = uuidv7();
  const name = `backups/stanza-${new Date().toISOString().replace(/[:.]/g, "-")}.json.gz`;
  try {
    const bytes = await exportDatabaseGzip();
    let blobPath = name;
    if (hasBlobToken()) {
      const result = await put(name, Buffer.from(bytes), {
        access: "private",
        contentType: "application/gzip",
        addRandomSuffix: true,
      });
      blobPath = result.pathname;
    } else {
      await fs.mkdir(path.join(LOCAL_DIR, "backups"), { recursive: true });
      await fs.writeFile(path.join(LOCAL_DIR, name), bytes);
    }
    await db.insert(backup).values({ id, blobPath, sizeBytes: bytes.length, status: "success" });
    return { id, status: "success" as const, sizeBytes: bytes.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.insert(backup).values({ id, blobPath: name, status: "failed", error });
    return { id, status: "failed" as const, error };
  }
}

export async function readBackup(blobPath: string): Promise<ReadableStream<Uint8Array> | Blob | null> {
  if (hasBlobToken()) {
    const result = await get(blobPath, { access: "private" });
    return result?.statusCode === 200 ? result.stream : null;
  }
  const file = path.resolve(LOCAL_DIR, blobPath);
  if (!file.startsWith(LOCAL_DIR)) return null;
  try {
    return new Blob([new Uint8Array(await fs.readFile(file))]);
  } catch {
    return null;
  }
}

async function removeBackupFiles(paths: string[]) {
  if (paths.length === 0) return;
  if (hasBlobToken()) {
    await del(paths);
    return;
  }
  await Promise.all(paths.map((p) => fs.rm(path.resolve(LOCAL_DIR, p), { force: true })));
}

export async function pruneExpired(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_MS);
  const oldBackups = await db.delete(backup).where(lt(backup.createdAt, cutoff)).returning({
    blobPath: backup.blobPath,
    status: backup.status,
  });
  await removeBackupFiles(oldBackups.filter((b) => b.status === "success").map((b) => b.blobPath));

  const [purgedUsers, purgedPosts] = await Promise.all([
    db
      .delete(user)
      .where(and(eq(user.status, "deleted"), isNotNull(user.deletedAt), lt(user.deletedAt, cutoff)))
      .returning({ id: user.id }),
    db
      .delete(post)
      .where(and(isNotNull(post.deletedAt), lt(post.deletedAt, cutoff)))
      .returning({ id: post.id }),
    db.delete(session).where(lt(session.expiresAt, now)),
    db.delete(verification).where(lt(verification.expiresAt, now)),
  ]);

  return { backups: oldBackups.length, users: purgedUsers.length, posts: purgedPosts.length };
}
