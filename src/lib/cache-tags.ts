import { revalidateTag, updateTag } from "next/cache";

export const LANDING_TAG = "landing";
export const SETTINGS_TAG = "settings";
export const SITEMAP_TAG = "sitemap";
export const REDIRECTS_TAG = "redirects";

export function postTag(postId: string): string {
  return `post:${postId}`;
}

export function postShareTag(shareId: string): string {
  return `share:${shareId}`;
}

export function authorTag(authorId: string): string {
  return `author:${authorId}`;
}

export function authorUsernameTag(username: string): string {
  return `author-username:${username.toLowerCase()}`;
}

export function touchTag(tag: string) {
  try {
    updateTag(tag);
  } catch {
    try {
      revalidateTag(tag, "max");
    } catch {}
  }
}

export function invalidatePostPublicCache(opts: {
  postId: string;
  authorId: string;
  username?: string;
  shareId?: string;
}) {
  touchTag(postTag(opts.postId));
  touchTag(authorTag(opts.authorId));
  if (opts.username) {
    touchTag(authorUsernameTag(opts.username));
  }
  if (opts.shareId) {
    touchTag(postShareTag(opts.shareId));
  }
  touchTag(LANDING_TAG);
  touchTag(SITEMAP_TAG);
}

export function invalidateAuthorPublicCache(authorId: string, username?: string) {
  touchTag(authorTag(authorId));
  if (username) {
    touchTag(authorUsernameTag(username));
  }
  touchTag(LANDING_TAG);
  touchTag(SITEMAP_TAG);
}

export function invalidateSettingsCache() {
  touchTag(SETTINGS_TAG);
  touchTag(LANDING_TAG);
}
