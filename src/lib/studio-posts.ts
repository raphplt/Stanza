import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { post } from "@/db/schema";

export async function getOwnedPostOrNotFound(postId: string, userId: string) {
  if (!z.uuid().safeParse(postId).success) notFound();
  const row = await db.query.post.findFirst({ where: eq(post.id, postId) });
  if (!row || row.authorId !== userId) notFound();
  return row;
}
