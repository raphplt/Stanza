import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string";
import { getStanzaCoreExtensions, isAllowedImageSrc, isAllowedLinkHref } from "@/lib/editor-extensions";
import { applyFrenchTypographyToDoc } from "@/lib/typo-fr";

const ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
  "hardBreak",
  "image",
]);

const ALLOWED_MARK_TYPES = new Set(["bold", "italic", "strike", "link"]);

type MarkItem = NonNullable<JSONContent["marks"]>[number];

function sanitizeMarks(marks: JSONContent["marks"]): MarkItem[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const cleaned: MarkItem[] = [];
  for (const mark of marks) {
    if (!mark || typeof mark.type !== "string" || !ALLOWED_MARK_TYPES.has(mark.type)) {
      continue;
    }
    if (mark.type === "link") {
      const href = mark.attrs?.href;
      if (!isAllowedLinkHref(href)) {
        continue;
      }
      cleaned.push({
        type: "link",
        attrs: {
          href: href.trim(),
          rel: "noopener noreferrer",
          target: "_blank",
        },
      });
    } else {
      cleaned.push({ type: mark.type });
    }
  }
  return cleaned.length > 0 ? cleaned : undefined;
}

function sanitizeNode(node: JSONContent): JSONContent | null {
  if (!node || typeof node.type !== "string" || !ALLOWED_NODE_TYPES.has(node.type)) {
    return null;
  }

  if (node.type === "text") {
    if (typeof node.text !== "string" || node.text.length === 0) {
      return null;
    }
    const marks = sanitizeMarks(node.marks);
    return marks ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
  }

  if (node.type === "hardBreak" || node.type === "horizontalRule") {
    return { type: node.type };
  }

  if (node.type === "image") {
    const src = node.attrs?.src;
    if (!isAllowedImageSrc(src)) {
      return null;
    }
    const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 300) : "";
    const caption =
      typeof node.attrs?.caption === "string" && node.attrs.caption.trim().length > 0
        ? node.attrs.caption.trim().slice(0, 300)
        : null;
    return {
      type: "image",
      attrs: {
        src: src.trim(),
        alt,
        caption,
      },
    };
  }

  const children = Array.isArray(node.content)
    ? (node.content.map(sanitizeNode).filter(Boolean) as JSONContent[])
    : [];

  if (node.type === "heading") {
    const rawLevel = Number(node.attrs?.level ?? 2);
    const level = rawLevel <= 2 ? 2 : rawLevel === 3 ? 3 : 4;
    return {
      type: "heading",
      attrs: { level },
      ...(children.length > 0 ? { content: children } : {}),
    };
  }

  if (node.type === "orderedList") {
    const start = Number.isInteger(node.attrs?.start) && node.attrs?.start > 0 ? node.attrs?.start : 1;
    return {
      type: "orderedList",
      attrs: { start },
      ...(children.length > 0 ? { content: children } : {}),
    };
  }

  return {
    type: node.type,
    ...(children.length > 0 ? { content: children } : {}),
  };
}

export function sanitizeProseMirrorJson(input: unknown): JSONContent {
  if (!input || typeof input !== "object") {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const root = input as JSONContent;
  if (root.type !== "doc") {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const sanitized = sanitizeNode(root);
  if (!sanitized || !Array.isArray(sanitized.content) || sanitized.content.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  return sanitized;
}

function withoutTrailingEmptyParagraphs(doc: JSONContent): JSONContent {
  const content = [...(doc.content ?? [])];
  while (content.length > 1 && content.at(-1)?.type === "paragraph" && !content.at(-1)?.content) {
    content.pop();
  }
  return { ...doc, content };
}

export function renderProseMirrorToHtml(
  input: unknown,
  options: { frenchTypography?: boolean } = {},
): string {
  const doc = withoutTrailingEmptyParagraphs(sanitizeProseMirrorJson(input));
  return renderToHTMLString({
    content: (options.frenchTypography ?? true) ? applyFrenchTypographyToDoc(doc) : doc,
    extensions: getStanzaCoreExtensions(),
  });
}

export function extractPlainText(input: unknown): string {
  const doc = sanitizeProseMirrorJson(input);
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
      return;
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
      return;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
      if (
        node.type === "paragraph" ||
        node.type === "heading" ||
        node.type === "blockquote" ||
        node.type === "listItem"
      ) {
        parts.push("\n");
      }
    }
  }

  walk(doc);
  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function computeReadingStats(
  title: string,
  content: unknown,
): {
  wordCount: number;
  readingMinutes: number;
} {
  const text = `${title ?? ""} ${extractPlainText(content)}`.trim();
  if (!text) {
    return { wordCount: 0, readingMinutes: 1 };
  }
  const words = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const wordCount = words.length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  return { wordCount, readingMinutes };
}

export function generateDefaultExcerpt(content: unknown, maxLength = 160): string {
  const plain = extractPlainText(content).replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

export function extractImageUrls(content: unknown): string[] {
  const urls: string[] = [];

  function walk(node: JSONContent) {
    if (node.type === "image" && typeof node.attrs?.src === "string") {
      urls.push(node.attrs.src);
    }
    node.content?.forEach(walk);
  }

  walk(sanitizeProseMirrorJson(content));
  return [...new Set(urls)];
}

export function extractFirstImageUrl(content: unknown): string | null {
  return extractImageUrls(content)[0] ?? null;
}

export function serializePostToMarkdown(post: {
  title: string;
  slug: string;
  status: string;
  publishedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  content: unknown;
}): string {
  const doc = sanitizeProseMirrorJson(post.content);
  const manager = new MarkdownManager({
    extensions: getStanzaCoreExtensions(),
  });
  const body = manager.serialize(doc).trim();
  const frontmatter = [
    "---",
    `title: ${JSON.stringify(post.title || "Sans titre")}`,
    `slug: ${JSON.stringify(post.slug)}`,
    `status: ${post.status}`,
    post.publishedAt ? `publishedAt: ${new Date(post.publishedAt).toISOString()}` : null,
    `createdAt: ${new Date(post.createdAt).toISOString()}`,
    `updatedAt: ${new Date(post.updatedAt).toISOString()}`,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return `${frontmatter}\n\n# ${post.title || "Sans titre"}\n\n${body}\n`;
}
