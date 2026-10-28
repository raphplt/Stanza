import type { AnyExtension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

export function isAllowedLinkHref(href: unknown): href is string {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|mailto:)/i.test(trimmed);
}

export function isAllowedImageSrc(src: unknown): src is string {
  if (typeof src !== "string") return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return /^(https?:\/\/|\/api\/upload\/local\/)/i.test(trimmed);
}

export const StanzaImage = Image.extend({
  name: "image",
  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: "",
      },
      caption: {
        default: null,
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const img = el.querySelector("img");
          if (!img || !isAllowedImageSrc(img.getAttribute("src"))) return false;
          const figcaption = el.querySelector("figcaption");
          return {
            src: img.getAttribute("src"),
            alt: img.getAttribute("alt") ?? "",
            caption: figcaption?.textContent ?? null,
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          if (!isAllowedImageSrc(el.getAttribute("src"))) return false;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt") ?? "",
            caption: el.getAttribute("title") ?? null,
          };
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const src = isAllowedImageSrc(HTMLAttributes.src) ? HTMLAttributes.src.trim() : "";
    const alt = typeof HTMLAttributes.alt === "string" ? HTMLAttributes.alt : "";
    const caption =
      typeof HTMLAttributes.caption === "string" && HTMLAttributes.caption.trim().length > 0
        ? HTMLAttributes.caption.trim()
        : null;

    if (!src) {
      return ["span"];
    }

    if (caption) {
      return [
        "figure",
        {},
        ["img", { src, alt, loading: "lazy", decoding: "async" }],
        ["figcaption", {}, caption],
      ];
    }

    return ["figure", {}, ["img", { src, alt, loading: "lazy", decoding: "async" }]];
  },
});

export function getStanzaCoreExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: [2, 3, 4],
      },
      code: false,
      codeBlock: false,
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
        isAllowedUri: (url) => isAllowedLinkHref(url),
      },
    }),
    StanzaImage,
  ];
}
