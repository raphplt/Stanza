import { toast } from "sonner";

export async function copyAbsoluteLink(path: string, message = "Lien copié dans le presse-papiers") {
  const url = new URL(path, window.location.origin).href;
  try {
    await navigator.clipboard.writeText(url);
    toast(message);
  } catch {
    toast("Copiez ce lien", {
      description: url,
      duration: Number.POSITIVE_INFINITY,
      closeButton: true,
      classNames: { description: "!text-paper/80 select-all break-all" },
    });
  }
  return url;
}
