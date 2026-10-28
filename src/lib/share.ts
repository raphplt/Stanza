import { toast } from "sonner";

export function postPublicPath(post: { status: string; slug: string; shareId: string }, username: string) {
  return post.status === "unlisted" ? `/s/${post.shareId}` : `/${username}/${post.slug}`;
}

export async function shareLink(title: string, path: string) {
  const url = new URL(path, window.location.origin).toString();
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  if (isTouch && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Lien copié");
  } catch {
    toast.error("Impossible de copier le lien.");
  }
}
