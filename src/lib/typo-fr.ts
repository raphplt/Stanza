import type { JSONContent } from "@tiptap/core";

const NBSP = "\u00A0";
const URL_OR_SPACED_PUNCT = /(^|\s)(https?:\/\/\S+|mailto:\S+)|([ \t\u00A0\u202F]+)([;:!?])/gi;
const URL_OR_GLUED_PUNCT = /(^|\s)(https?:\/\/\S+|mailto:\S+)|(\p{L}|\p{N}|\)|»|”)([;:!?])(?=$|[\s\p{P}])/gu;

export function applyFrenchTypographyToText(input: string): string {
  if (!input) return input;

  let out = input;

  out = out.replace(/(\p{L})'(\p{L})/gu, "$1\u2019$2");
  out = out.replace(/"([^"\n]+)"/g, `«${NBSP}$1${NBSP}»`);
  out = out.replace(/«[ \t\u00A0\u202F]*/g, `«${NBSP}`);
  out = out.replace(/[ \t\u00A0\u202F]*»/g, `${NBSP}»`);
  out = out.replace(URL_OR_SPACED_PUNCT, (_match, urlPrefix, url, _spaces, punct) =>
    url ? `${urlPrefix}${url}` : `${NBSP}${punct}`,
  );
  out = out.replace(URL_OR_GLUED_PUNCT, (_match, urlPrefix, url, prevChar, punct) =>
    url ? `${urlPrefix}${url}` : `${prevChar}${NBSP}${punct}`,
  );

  return out;
}

export function applyFrenchTypographyToDoc(node: JSONContent): JSONContent {
  if (node.type === "text" && typeof node.text === "string") {
    return { ...node, text: applyFrenchTypographyToText(node.text) };
  }
  if (!Array.isArray(node.content)) return node;
  return { ...node, content: node.content.map(applyFrenchTypographyToDoc) };
}
