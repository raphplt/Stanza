import { describe, expect, it } from "vitest";
import {
  computeReadingStats,
  extractImageUrls,
  generateDefaultExcerpt,
  renderProseMirrorToHtml,
  sanitizeProseMirrorJson,
} from "@/lib/render";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function p(text: string, marks?: unknown[]) {
  return { type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] };
}

describe("renderProseMirrorToHtml", () => {
  it("escapes HTML and keeps entities intact with French typography", () => {
    const html = renderProseMirrorToHtml(doc(p("Tom & Jerry <script>alert(1)</script>")));
    expect(html).toBe("<p>Tom &amp; Jerry &lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });

  it("drops links with forbidden protocols but keeps the text", () => {
    const html = renderProseMirrorToHtml(
      doc(p("clic", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])),
    );
    expect(html).toBe("<p>clic</p>");
  });

  it("renders allowed links with safe rel attributes", () => {
    const html = renderProseMirrorToHtml(
      doc(p("site", [{ type: "link", attrs: { href: "https://exemple.fr", onclick: "x" } }])),
    );
    expect(html).toContain('href="https://exemple.fr"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("onclick");
  });

  it("strips unknown nodes and marks", () => {
    const html = renderProseMirrorToHtml(
      doc(
        { type: "codeBlock", content: [{ type: "text", text: "code" }] },
        p("souligné", [{ type: "underline" }, { type: "bold" }]),
      ),
    );
    expect(html).toBe("<p><strong>souligné</strong></p>");
  });

  it("clamps heading levels to h2-h4", () => {
    const html = renderProseMirrorToHtml(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A" }] },
        { type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "B" }] },
      ),
    );
    expect(html).toBe("<h2>A</h2><h4>B</h4>");
  });

  it("renders images as figures and rejects unsafe sources", () => {
    const html = renderProseMirrorToHtml(
      doc(
        { type: "image", attrs: { src: "https://x.fr/a.png", alt: "Un chat", caption: "Minou" } },
        { type: "image", attrs: { src: "data:image/png;base64,AAAA", alt: "" } },
      ),
    );
    expect(html).toContain('<img src="https://x.fr/a.png" alt="Un chat"');
    expect(html).toContain("<figcaption>Minou</figcaption>");
    expect(html).not.toContain("data:");
  });

  it("drops trailing empty paragraphs", () => {
    expect(renderProseMirrorToHtml(doc(p("fin"), { type: "paragraph" }, { type: "paragraph" }))).toBe(
      "<p>fin</p>",
    );
  });

  it("renders hard breaks and the section separator", () => {
    const html = renderProseMirrorToHtml(
      doc(
        {
          type: "paragraph",
          content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }],
        },
        { type: "horizontalRule" },
      ),
      { frenchTypography: false },
    );
    expect(html).toBe("<p>a<br/>b</p><hr/>");
  });
});

describe("sanitizeProseMirrorJson", () => {
  it("returns an empty document for invalid input", () => {
    expect(sanitizeProseMirrorJson("nope")).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    expect(sanitizeProseMirrorJson({ type: "paragraph" })).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("text helpers", () => {
  it("computes word count and reading time", () => {
    const words = Array.from({ length: 450 }, () => "mot").join(" ");
    expect(computeReadingStats("Titre", doc(p(words)))).toEqual({ wordCount: 451, readingMinutes: 3 });
  });

  it("truncates the default excerpt with an ellipsis", () => {
    const excerpt = generateDefaultExcerpt(doc(p("a".repeat(200))));
    expect(excerpt).toHaveLength(160);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("lists unique image URLs in order", () => {
    const image = (src: string) => ({ type: "image", attrs: { src, alt: "" } });
    expect(
      extractImageUrls(
        doc(image("https://a.fr/1.png"), image("https://a.fr/2.png"), image("https://a.fr/1.png")),
      ),
    ).toEqual(["https://a.fr/1.png", "https://a.fr/2.png"]);
  });
});
