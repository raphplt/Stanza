"use server";

import { z } from "zod";
import { getAuthorPosts, getPublicProfile, parseSort, toPostCardData } from "@/lib/public-data";

const schema = z.object({
  username: z.string().min(1).max(30),
  query: z.string().max(100),
  sort: z.string(),
  cursor: z.string().max(500),
});

export async function loadMoreProfilePostsAction(input: z.infer<typeof schema>) {
  const data = schema.safeParse(input);
  if (!data.success) return { posts: [], nextCursor: null };
  const profile = await getPublicProfile(data.data.username);
  if (!profile) return { posts: [], nextCursor: null };
  const page = await getAuthorPosts(
    profile.author.id,
    data.data.query,
    parseSort(data.data.sort),
    data.data.cursor,
  );
  return {
    posts: page.posts.map((p) => toPostCardData(p, profile.author.username)),
    nextCursor: page.nextCursor,
  };
}
